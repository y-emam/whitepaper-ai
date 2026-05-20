import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { loadEnv } from "./env.js";
import { buildAnswerPrompt } from "./prompts/answer.js";
import { LlmAnswerSchema, type LlmAnswer, type RetrievedChunk } from "./types.js";

let client: GoogleGenerativeAI | null = null;

function getClient(): GoogleGenerativeAI {
  if (client) return client;
  const env = loadEnv();
  client = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  return client;
}

const ANSWER_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    answer: { type: SchemaType.STRING },
    cited_chunks: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING }
    },
    sufficient_context: { type: SchemaType.BOOLEAN }
  },
  required: ["answer", "cited_chunks", "sufficient_context"]
};

export interface GenerateAnswerInput {
  question: string;
  chunks: RetrievedChunk[];
}

export interface GenerateAnswerResult {
  answer: LlmAnswer;
  labelToChunk: Map<string, RetrievedChunk>;
  model: string;
}

/**
 * Call Gemini with the retrieved passages. Validates structured output and
 * retries once on parse / hallucinated-citation failure.
 */
export async function generateAnswer({ question, chunks }: GenerateAnswerInput): Promise<GenerateAnswerResult> {
  const env = loadEnv();
  const labeled = chunks.map((c, i) => ({ label: `c${i + 1}`, chunk: c }));
  const labelToChunk = new Map(labeled.map((p) => [p.label, p.chunk]));
  const allowedLabels = new Set(labeled.map((p) => p.label));

  const prompt = buildAnswerPrompt({ question, passages: labeled });
  const model = getClient().getGenerativeModel({
    model: env.GEMINI_LLM_MODEL,
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 1500,
      responseMimeType: "application/json",
      responseSchema: ANSWER_SCHEMA
    }
  });

  const attempt = async (extraInstruction?: string): Promise<LlmAnswer> => {
    const fullPrompt = extraInstruction ? `${prompt}\n\n[ADDITIONAL CONSTRAINTS]\n${extraInstruction}` : prompt;
    const result = await model.generateContent(fullPrompt);
    const text = result.response.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error(`Gemini returned non-JSON: ${text.slice(0, 200)}`);
    }
    const validated = LlmAnswerSchema.parse(parsed);
    for (const cited of validated.cited_chunks) {
      if (!allowedLabels.has(cited)) {
        throw new Error(`Gemini cited unknown label "${cited}". Allowed: ${[...allowedLabels].join(", ")}`);
      }
    }
    const inlineLabels = extractInlineLabels(validated.answer);
    for (const label of inlineLabels) {
      if (!allowedLabels.has(label)) {
        throw new Error(`Inline citation [${label}] in answer is not in the allowed list.`);
      }
    }
    return validated;
  };

  let lastError: unknown = null;
  for (let i = 0; i < 2; i += 1) {
    try {
      const answer = await attempt(
        i === 0
          ? undefined
          : `Your previous response was rejected. Cite ONLY these labels and use them inline in [c#] form: ${[
              ...allowedLabels
            ].join(", ")}. Return strict JSON, no prose outside JSON.`
      );
      return { answer, labelToChunk, model: env.GEMINI_LLM_MODEL };
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(
    `Gemini failed twice to return a valid grounded answer: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`
  );
}

export function extractInlineLabels(text: string): string[] {
  // Accepts both [c1] (single) and [c1, c2, c3] (bundled — Gemini sometimes
  // emits this even when instructed not to). Captures one bracket group at
  // a time and splits the inner content on commas.
  const re = /\[((?:c\d+)(?:\s*,\s*c\d+)*)\]/gi;
  const out: string[] = [];
  for (const match of text.matchAll(re)) {
    const inner = match[1];
    if (!inner) continue;
    for (const part of inner.split(/\s*,\s*/)) {
      if (part) out.push(part.toLowerCase());
    }
  }
  return out;
}
