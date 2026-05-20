import { embed } from "./embed.js";
import { loadEnv } from "./env.js";
import { getPublicClient } from "./supabase.js";
import type { RetrievedChunk } from "./types.js";

export interface RetrieveOptions {
  topK?: number;
  vectorWeight?: number;
  ftsWeight?: number;
  paperFilter?: string | null;
}

interface HybridRow {
  id: string;
  paper_id: string;
  chunk_index: number;
  heading_path: string | null;
  content: string;
  page_number: number | null;
  vec_score: number;
  fts_score: number;
  combined_score: number;
}

interface PaperLookup {
  id: string;
  title: string;
  slug: string;
}

/**
 * Hybrid retrieval (vector + FTS) via Postgres RPC `hybrid_search`.
 * Joins paper title/slug onto each chunk for citation rendering.
 */
export async function retrieve(query: string, opts: RetrieveOptions = {}): Promise<RetrievedChunk[]> {
  const env = loadEnv();
  const topK = opts.topK ?? env.RETRIEVAL_TOP_K;
  const vectorWeight = opts.vectorWeight ?? env.RETRIEVAL_VECTOR_WEIGHT;
  const ftsWeight = opts.ftsWeight ?? env.RETRIEVAL_FTS_WEIGHT;

  const supabase = getPublicClient();
  const queryEmbedding = await embed(query);

  const { data, error } = await supabase.rpc("hybrid_search", {
    query_embedding: queryEmbedding,
    query_text: query,
    match_count: topK,
    vector_weight: vectorWeight,
    fts_weight: ftsWeight,
    paper_filter: opts.paperFilter ?? null
  });

  if (error) {
    throw new Error(`hybrid_search RPC failed: ${error.message}`);
  }

  const rows = (data ?? []) as HybridRow[];
  if (rows.length === 0) return [];

  const paperIds = Array.from(new Set(rows.map((r) => r.paper_id)));
  const { data: papers, error: papersError } = await supabase
    .from("papers")
    .select("id, title, slug")
    .in("id", paperIds);

  if (papersError) {
    throw new Error(`papers lookup failed: ${papersError.message}`);
  }

  const titleById = new Map<string, PaperLookup>();
  for (const p of (papers ?? []) as PaperLookup[]) {
    titleById.set(p.id, p);
  }

  return rows.map((r) => ({
    id: r.id,
    paper_id: r.paper_id,
    chunk_index: r.chunk_index,
    heading_path: r.heading_path,
    content: r.content,
    page_number: r.page_number,
    vec_score: r.vec_score,
    fts_score: r.fts_score,
    combined_score: r.combined_score,
    paper_title: titleById.get(r.paper_id)?.title ?? "Unknown",
    paper_slug: titleById.get(r.paper_id)?.slug ?? ""
  }));
}

/**
 * Returns true when the top retrieved chunk's combined score is below the
 * refusal floor, meaning we should not attempt a grounded answer.
 */
export function isBelowRefusalThreshold(chunks: RetrievedChunk[]): boolean {
  const env = loadEnv();
  if (chunks.length === 0) return true;
  const top = chunks[0];
  if (!top) return true;
  return top.combined_score < env.RETRIEVAL_REFUSAL_THRESHOLD;
}
