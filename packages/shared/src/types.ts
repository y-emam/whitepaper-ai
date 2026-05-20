import { z } from "zod";

export const PaperSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  title: z.string(),
  source_url: z.string().url(),
  pdf_path: z.string().nullable(),
  total_pages: z.number().int().nullable(),
  ingested_at: z.string(),
  metadata: z.record(z.unknown()).default({})
});
export type Paper = z.infer<typeof PaperSchema>;

export const ChunkSchema = z.object({
  id: z.string().uuid(),
  paper_id: z.string().uuid(),
  chunk_index: z.number().int(),
  heading_path: z.string().nullable(),
  content: z.string(),
  page_number: z.number().int().nullable()
});
export type Chunk = z.infer<typeof ChunkSchema>;

export const RetrievedChunkSchema = ChunkSchema.extend({
  vec_score: z.number(),
  fts_score: z.number(),
  combined_score: z.number(),
  paper_title: z.string().optional(),
  paper_slug: z.string().optional()
});
export type RetrievedChunk = z.infer<typeof RetrievedChunkSchema>;

export const CitationSchema = z.object({
  id: z.string().uuid(),
  label: z.string(),
  paper_title: z.string(),
  paper_slug: z.string(),
  page: z.number().int().nullable(),
  heading_path: z.string().nullable(),
  excerpt: z.string()
});
export type Citation = z.infer<typeof CitationSchema>;

export const AskRequestSchema = z.object({
  question: z.string().trim().min(3).max(500),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string()
      })
    )
    .max(10)
    .default([])
});
export type AskRequest = z.infer<typeof AskRequestSchema>;

export const AskResponseSchema = z.object({
  answer: z.string(),
  citations: z.array(CitationSchema),
  sufficient_context: z.boolean(),
  model: z.string(),
  latency_ms: z.number().int()
});
export type AskResponse = z.infer<typeof AskResponseSchema>;

export const LlmAnswerSchema = z.object({
  answer: z.string().min(1),
  cited_chunks: z.array(z.string()).default([]),
  sufficient_context: z.boolean()
});
export type LlmAnswer = z.infer<typeof LlmAnswerSchema>;

export const PaperSummarySchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  title: z.string(),
  total_pages: z.number().int().nullable(),
  ingested_at: z.string()
});
export type PaperSummary = z.infer<typeof PaperSummarySchema>;
