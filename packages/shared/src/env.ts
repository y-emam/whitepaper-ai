import { z } from "zod";

const EnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),

  VOYAGE_API_KEY: z.string().min(1),
  VOYAGE_EMBED_MODEL: z.string().default("voyage-3-large"),
  VOYAGE_EMBED_DIMENSIONS: z.coerce.number().int().positive().default(1024),

  GEMINI_API_KEY: z.string().min(1),
  GEMINI_LLM_MODEL: z.string().default("gemini-2.5-flash"),

  RETRIEVAL_TOP_K: z.coerce.number().int().positive().default(8),
  RETRIEVAL_VECTOR_WEIGHT: z.coerce.number().min(0).max(1).default(0.6),
  RETRIEVAL_FTS_WEIGHT: z.coerce.number().min(0).max(1).default(0.4),
  RETRIEVAL_REFUSAL_THRESHOLD: z.coerce.number().min(0).max(1).default(0.4),

  INGEST_CONCURRENCY: z.coerce.number().int().positive().default(2)
});

export type AppEnv = z.infer<typeof EnvSchema>;

let cached: AppEnv | null = null;

export function loadEnv(): AppEnv {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(
      `Invalid or missing environment variables:\n${issues}\n` +
        `Check your .env.local and .env.example.`
    );
  }
  cached = parsed.data;
  return cached;
}

export function requireServiceRole(): string {
  const env = loadEnv();
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required for this operation but is not set."
    );
  }
  return env.SUPABASE_SERVICE_ROLE_KEY;
}
