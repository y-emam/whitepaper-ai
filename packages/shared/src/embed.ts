import { GoogleGenerativeAI, TaskType } from "@google/generative-ai";
import { loadEnv } from "./env.js";

let client: GoogleGenerativeAI | null = null;

function getClient(): GoogleGenerativeAI {
  if (client) return client;
  const env = loadEnv();
  client = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  return client;
}

const TARGET_DIMENSIONS = 768;

export type EmbedTaskType = "document" | "query";

/**
 * Embed a single text into a 768-dim vector via Gemini gemini-embedding-001.
 * Uses task-type-specific embeddings so that document indexing and query
 * retrieval are projected into compatible subspaces.
 */
export async function embed(text: string, taskKind: EmbedTaskType = "document"): Promise<number[]> {
  const env = loadEnv();
  const trimmed = text.length > 8192 ? text.slice(0, 8192) : text;
  const model = getClient().getGenerativeModel({ model: env.GEMINI_EMBED_MODEL });
  const result = await model.embedContent({
    content: { role: "user", parts: [{ text: trimmed }] },
    taskType: taskKind === "query" ? TaskType.RETRIEVAL_QUERY : TaskType.RETRIEVAL_DOCUMENT,
    outputDimensionality: TARGET_DIMENSIONS
  });
  const values = result.embedding?.values;
  if (!values || values.length === 0) {
    throw new Error("Gemini embedding returned empty vector.");
  }
  return values;
}

/**
 * Embed many texts. Uses a small concurrency window to avoid hammering
 * rate limits. Returns vectors in the same order as inputs.
 */
export async function embedBatch(
  texts: string[],
  concurrency = 4,
  taskKind: EmbedTaskType = "document"
): Promise<number[][]> {
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
      results[i] = await embed(input, taskKind);
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, texts.length) }, worker);
  await Promise.all(workers);
  return results;
}
