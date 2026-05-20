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

const GEMINI_FREE_TIER_RPM = 90;
const MIN_INTERVAL_MS = Math.ceil(60_000 / GEMINI_FREE_TIER_RPM);
let nextAvailableAt = 0;

async function throttle(): Promise<void> {
  const now = Date.now();
  const wait = nextAvailableAt - now;
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  nextAvailableAt = Math.max(now, nextAvailableAt) + MIN_INTERVAL_MS;
}

function parseRetryDelayMs(message: string): number | null {
  const m = message.match(/retry in ([\d.]+)s/i);
  if (m && m[1]) return Math.ceil(parseFloat(m[1]) * 1000);
  const m2 = message.match(/"retryDelay"\s*:\s*"(\d+)s"/);
  if (m2 && m2[1]) return parseInt(m2[1], 10) * 1000;
  return null;
}

export type EmbedTaskType = "document" | "query";

async function embedOnce(text: string, taskKind: EmbedTaskType): Promise<number[]> {
  const env = loadEnv();
  const model = getClient().getGenerativeModel({ model: env.GEMINI_EMBED_MODEL });
  // outputDimensionality is supported by the API but not yet in @google/generative-ai types.
  const request = {
    content: { role: "user", parts: [{ text }] },
    taskType: taskKind === "query" ? TaskType.RETRIEVAL_QUERY : TaskType.RETRIEVAL_DOCUMENT,
    outputDimensionality: TARGET_DIMENSIONS
  } as unknown as Parameters<typeof model.embedContent>[0];
  const result = await model.embedContent(request);
  const values = result.embedding?.values;
  if (!values || values.length === 0) {
    throw new Error("Gemini embedding returned empty vector.");
  }
  return values;
}

/**
 * Embed a single text into a 768-dim vector via Gemini gemini-embedding-001.
 * Self-throttles to stay under the free-tier 100 RPM limit, and retries up
 * to 3 times on 429 quota errors using the suggested retryDelay.
 */
export async function embed(text: string, taskKind: EmbedTaskType = "document"): Promise<number[]> {
  const trimmed = text.length > 8192 ? text.slice(0, 8192) : text;
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await throttle();
    try {
      return await embedOnce(trimmed, taskKind);
    } catch (err) {
      lastError = err;
      const message = err instanceof Error ? err.message : String(err);
      if (!message.includes("429") && !/quota/i.test(message)) throw err;
      const suggested = parseRetryDelayMs(message);
      const backoff = suggested ?? Math.min(60_000, 2_000 * 2 ** attempt);
      process.stderr.write(`  [rate] embed 429 — sleeping ${(backoff / 1000).toFixed(1)}s before retry ${attempt + 1}\n`);
      await new Promise((r) => setTimeout(r, backoff + 250));
      nextAvailableAt = Date.now();
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Gemini embed failed after retries");
}

/**
 * Embed many texts. Concurrency is bounded but the per-call throttle is the
 * real rate gate, so it's safe to keep the worker count modest.
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
