import type { RetrievedChunk } from "../types.js";

export interface AnswerPromptInput {
  question: string;
  passages: Array<{ label: string; chunk: RetrievedChunk }>;
}

/**
 * Build the prompt sent to Gemini. The model must return JSON matching
 * LlmAnswerSchema. The labels (c1, c2, …) bind the model's citations to
 * specific chunk UUIDs in the retrieved set.
 */
export function buildAnswerPrompt({ question, passages }: AnswerPromptInput): string {
  const passageBlock = passages
    .map(({ label, chunk }) => {
      const where = chunk.page_number
        ? `page ${chunk.page_number}`
        : "page unknown";
      const heading = chunk.heading_path ? `, section "${chunk.heading_path}"` : "";
      return `Passage [${label}]: (from "${chunk.paper_title}", ${where}${heading})\n${chunk.content.trim()}\n`;
    })
    .join("\n");

  const validLabels = passages.map((p) => `[${p.label}]`).join(" ");

  return `[ROLE]
You are a senior AWS cloud engineer answering a technical question strictly using the provided source passages. Never invent information. Every factual claim in your answer must reference one of the provided passage IDs.

[USER QUESTION]
${question}

[RETRIEVED PASSAGES]
Each passage has an ID. Reference these as [c#] in your answer.

${passageBlock}

[TASK]
Write a clear, technical answer in 2–4 paragraphs.
- Every factual claim must include an inline citation in [c#] format, drawn ONLY from this list: ${validLabels}
- When citing multiple sources for one claim, use SEPARATE brackets: [c1] [c2] [c3]. Do NOT bundle them like [c1, c2, c3].
- Cite at most three passages per sentence — pick the most relevant.
- If the passages don't fully answer the question, say so honestly and set sufficient_context to false.
- Do NOT cite a passage ID that isn't in the list above.
- Do NOT add citations to general background knowledge that does not come from the passages.

[OUTPUT FORMAT]
Return JSON matching this schema:
{
  "answer": "string with inline [c1] [c2] citations",
  "cited_chunks": ["c1", "c2", ...],
  "sufficient_context": boolean
}

If sufficient_context is false, the answer should explain what's missing.`;
}

export const REFUSAL_ANSWER =
  "The corpus does not contain enough information to confidently answer this question. The retrieved passages were not closely related to the query, so providing an answer would risk inventing details. Try rephrasing, narrowing the topic, or asking about a specific AWS service or whitepaper.";
