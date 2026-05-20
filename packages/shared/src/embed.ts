import { loadEnv } from "./env.js";

const VOYAGE_ENDPOINT = "https://api.voyageai.com/v1/embeddings";

const VOYAGE_MAX_INPUTS_PER_REQUEST = 128;
const VOYAGE_MAX_INPUT_CHARS = 32_000;
const CHARS_PER_TOKEN = 4;
const MAX_429_RETRIES = 4;

// Voyage rate limits depend on your billing tier:
// - Free (no card): 3 RPM / 10K TPM — set VOYAGE_REQUEST_INTERVAL_MS=62000 and VOYAGE_TOKEN_BUDGET=8000
// - Tier 1 (card on file): ~2K RPM / millions TPM — defaults below are safe
// The throttle serializes all calls through one chain; setting interval to 0
// skips the wait entirely.
const REQUEST_INTERVAL_MS = parseInt(process.env.VOYAGE_REQUEST_INTERVAL_MS ?? "0", 10);
const TOKEN_BUDGET_PER_REQUEST = parseInt(process.env.VOYAGE_TOKEN_BUDGET ?? "120000", 10);

interface VoyageEmbedResponse {
  data: Array<{ embedding: number[]; index: number }>;
  model: string;
  usage: { total_tokens: number };
}

interface VoyageError {
  detail?: string;
  error?: { message?: string };
}

export type EmbedTaskType = "document" | "query";

function trim(text: string): string {
  return text.length > VOYAGE_MAX_INPUT_CHARS ? text.slice(0, VOYAGE_MAX_INPUT_CHARS) : text;
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / CHARS_PER_TOKEN));
}

let throttleChain: Promise<void> = Promise.resolve();

function throttle<T>(work: () => Promise<T>): Promise<T> {
  if (REQUEST_INTERVAL_MS <= 0) {
    // No throttle configured — run concurrently, let Voyage's own rate
    // limits push back if anything goes wrong (handled by the 429 retry).
    return work();
  }
  const my = throttleChain.then(async () => {
    const started = Date.now();
    try {
      return await work();
    } finally {
      const elapsed = Date.now() - started;
      const wait = REQUEST_INTERVAL_MS - elapsed;
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    }
  });
  throttleChain = my.then(
    () => undefined,
    () => undefined
  );
  return my;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function callVoyageOnce(inputs: string[], taskKind: EmbedTaskType): Promise<number[][]> {
  const env = loadEnv();
  const body = {
    model: env.VOYAGE_EMBED_MODEL,
    input: inputs.map(trim),
    input_type: taskKind,
    output_dimension: env.VOYAGE_EMBED_DIMENSIONS
  };
  const res = await fetch(VOYAGE_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.VOYAGE_API_KEY}`
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    let message = `Voyage API ${res.status}`;
    try {
      const err = (await res.json()) as VoyageError;
      message += `: ${err.detail ?? err.error?.message ?? "unknown"}`;
    } catch {
      message += `: ${await res.text()}`;
    }
    throw new Error(message);
  }

  const json = (await res.json()) as VoyageEmbedResponse;
  const sorted = [...json.data].sort((a, b) => a.index - b.index);
  return sorted.map((d) => d.embedding);
}

async function callVoyageWithRetry(inputs: string[], taskKind: EmbedTaskType): Promise<number[][]> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < MAX_429_RETRIES; attempt += 1) {
    try {
      return await throttle(() => callVoyageOnce(inputs, taskKind));
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("429") && !/rate/i.test(msg) && !/quota/i.test(msg)) {
        throw err;
      }
      const backoff = Math.min(120_000, 60_000 * (attempt + 1));
      process.stderr.write(
        `  [rate] voyage 429 — sleeping ${(backoff / 1000).toFixed(0)}s before retry ${attempt + 1}\n`
      );
      await sleep(backoff);
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Voyage embed failed after retries");
}

export function packBatches(texts: string[]): string[][] {
  const batches: string[][] = [];
  let current: string[] = [];
  let tokens = 0;
  for (const raw of texts) {
    const text = raw ?? "";
    const trimmed = trim(text);
    const tk = estimateTokens(trimmed);
    const wouldOverflow =
      tokens + tk > TOKEN_BUDGET_PER_REQUEST || current.length >= VOYAGE_MAX_INPUTS_PER_REQUEST;
    if (wouldOverflow && current.length > 0) {
      batches.push(current);
      current = [];
      tokens = 0;
    }
    current.push(trimmed);
    tokens += tk;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

/**
 * Embed one text. The throttle ensures we obey the 60s-between-requests rule
 * even when called interleaved with batch ingestion from another caller.
 */
export async function embed(
  text: string,
  taskKind: EmbedTaskType = "document"
): Promise<number[]> {
  const vectors = await callVoyageWithRetry([text], taskKind);
  const v = vectors[0];
  if (!v || v.length === 0) {
    throw new Error("Voyage returned an empty embedding vector.");
  }
  return v;
}

/**
 * Embed many texts in TPM-safe batches. Voyage allows up to 128 inputs per
 * request but the free tier's 10K TPM is the real cap, so each batch is
 * packed to roughly 8K tokens.
 */
export async function embedBatch(
  texts: string[],
  _concurrency = 1,
  taskKind: EmbedTaskType = "document"
): Promise<number[][]> {
  const batches = packBatches(texts);
  const results: number[][] = new Array(texts.length);
  let written = 0;
  process.stderr.write(`  embedding ${texts.length} texts in ${batches.length} batch(es)\n`);
  for (let i = 0; i < batches.length; i += 1) {
    const batch = batches[i];
    if (!batch || batch.length === 0) continue;
    const vectors = await callVoyageWithRetry(batch, taskKind);
    for (let j = 0; j < vectors.length; j += 1) {
      const vec = vectors[j];
      results[written + j] = vec ?? [];
    }
    written += batch.length;
    process.stderr.write(`    batch ${i + 1}/${batches.length} done (${written}/${texts.length})\n`);
  }
  return results;
}
