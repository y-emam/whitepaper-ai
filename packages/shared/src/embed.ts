import { GoogleGenerativeAI } from "@google/generative-ai";
import { loadEnv } from "./env.js";

let client: GoogleGenerativeAI | null = null;

function getClient(): GoogleGenerativeAI {
  if (client) return client;
  const env = loadEnv();
  client = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  return client;
}

/**
 * Embed a single text into a 768-dim vector via Gemini text-embedding-004.
 * Truncates very long inputs to ~8192 chars to stay within Gemini limits.
 */
export async function embed(text: string): Promise<number[]> {
  const env = loadEnv();
  const trimmed = text.length > 8192 ? text.slice(0, 8192) : text;
  const model = getClient().getGenerativeModel({ model: env.GEMINI_EMBED_MODEL });
  const result = await model.embedContent(trimmed);
  const values = result.embedding?.values;
  if (!values || values.length === 0) {
    throw new Error("Gemini embedding returned empty vector.");
  }
  return values;
}

/**
 * Embed many texts. Uses sequential calls with a small concurrency window to
 * avoid hammering rate limits. Returns vectors in the same order as inputs.
 */
export async function embedBatch(texts: string[], concurrency = 4): Promise<number[][]> {
  const results: number[][] = new Array(texts.length);
  let cursor = 0;
  async function worker() {
    while (cursor < texts.length) {
      const i = cursor++;
      const input = texts[i];
      if (!input) {
        results[i] = [];
        continue;
      }
      results[i] = await embed(input);
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, texts.length) }, worker);
  await Promise.all(workers);
  return results;
}
