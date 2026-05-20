import { loadEnv } from "./env.js";

const VOYAGE_ENDPOINT = "https://api.voyageai.com/v1/embeddings";
const MAX_INPUTS_PER_REQUEST = 128;
const MAX_INPUT_CHARS = 32_000;

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

function inputType(kind: EmbedTaskType): "document" | "query" {
  return kind;
}

function trim(text: string): string {
  return text.length > MAX_INPUT_CHARS ? text.slice(0, MAX_INPUT_CHARS) : text;
}

async function callVoyage(
  inputs: string[],
  taskKind: EmbedTaskType
): Promise<number[][]> {
  const env = loadEnv();
  const body = {
    model: env.VOYAGE_EMBED_MODEL,
    input: inputs.map(trim),
    input_type: inputType(taskKind),
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

/**
 * Embed a single text via Voyage voyage-3-large at the configured dimension.
 * Use taskKind="query" at retrieval time, "document" during ingestion — the
 * model projects each into asymmetric subspaces optimized for retrieval.
 */
export async function embed(
  text: string,
  taskKind: EmbedTaskType = "document"
): Promise<number[]> {
  const vectors = await callVoyage([text], taskKind);
  const v = vectors[0];
  if (!v || v.length === 0) {
    throw new Error("Voyage returned an empty embedding vector.");
  }
  return v;
}

/**
 * Embed many texts in one HTTP round trip when possible. Voyage accepts up to
 * 128 inputs per request, so a typical paper (50–200 chunks) fits in 1–2 calls.
 * `concurrency` is kept as a parameter for API compatibility but the per-call
 * batch is the real efficiency lever.
 */
export async function embedBatch(
  texts: string[],
  _concurrency = 4,
  taskKind: EmbedTaskType = "document"
): Promise<number[][]> {
  const results: number[][] = new Array(texts.length);
  for (let i = 0; i < texts.length; i += MAX_INPUTS_PER_REQUEST) {
    const slice = texts.slice(i, i + MAX_INPUTS_PER_REQUEST);
    const safeSlice = slice.map((t) => t ?? "");
    const vectors = await callVoyage(safeSlice, taskKind);
    for (let j = 0; j < vectors.length; j += 1) {
      const vec = vectors[j];
      if (vec) {
        results[i + j] = vec;
      } else {
        results[i + j] = [];
      }
    }
  }
  return results;
}
