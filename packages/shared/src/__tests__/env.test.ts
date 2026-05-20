import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const ORIGINAL_ENV = process.env;

const BASE_ENV = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
  VOYAGE_API_KEY: "voyage-key",
  GEMINI_API_KEY: "gemini-key"
} as const;

beforeEach(() => {
  vi.resetModules();
  process.env = { ...ORIGINAL_ENV, ...BASE_ENV };
  // Strip any env vars from the parent shell that would otherwise interfere.
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.VOYAGE_EMBED_MODEL;
  delete process.env.VOYAGE_EMBED_DIMENSIONS;
  delete process.env.GEMINI_LLM_MODEL;
  delete process.env.RETRIEVAL_TOP_K;
  delete process.env.RETRIEVAL_VECTOR_WEIGHT;
  delete process.env.RETRIEVAL_FTS_WEIGHT;
  delete process.env.RETRIEVAL_REFUSAL_THRESHOLD;
  delete process.env.INGEST_CONCURRENCY;
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
});

describe("loadEnv", () => {
  it("parses required vars and applies defaults for optional ones", async () => {
    const { loadEnv } = await import("../env.js");
    const env = loadEnv();
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe("https://example.supabase.co");
    expect(env.VOYAGE_EMBED_MODEL).toBe("voyage-3-large");
    expect(env.VOYAGE_EMBED_DIMENSIONS).toBe(1024);
    expect(env.GEMINI_LLM_MODEL).toBe("gemini-2.5-flash");
    expect(env.RETRIEVAL_TOP_K).toBe(8);
    expect(env.RETRIEVAL_VECTOR_WEIGHT).toBeCloseTo(0.6);
    expect(env.RETRIEVAL_FTS_WEIGHT).toBeCloseTo(0.4);
    expect(env.RETRIEVAL_REFUSAL_THRESHOLD).toBeCloseTo(0.4);
    expect(env.INGEST_CONCURRENCY).toBe(2);
  });

  it("coerces numeric strings on optional vars", async () => {
    process.env.RETRIEVAL_TOP_K = "12";
    process.env.RETRIEVAL_VECTOR_WEIGHT = "0.7";
    process.env.VOYAGE_EMBED_DIMENSIONS = "768";
    const { loadEnv } = await import("../env.js");
    const env = loadEnv();
    expect(env.RETRIEVAL_TOP_K).toBe(12);
    expect(env.RETRIEVAL_VECTOR_WEIGHT).toBeCloseTo(0.7);
    expect(env.VOYAGE_EMBED_DIMENSIONS).toBe(768);
  });

  it("throws and lists every missing required var in the message", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.VOYAGE_API_KEY;
    delete process.env.GEMINI_API_KEY;
    const { loadEnv } = await import("../env.js");
    expect(() => loadEnv()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
    try {
      loadEnv();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      expect(msg).toMatch(/NEXT_PUBLIC_SUPABASE_ANON_KEY/);
      expect(msg).toMatch(/VOYAGE_API_KEY/);
      expect(msg).toMatch(/GEMINI_API_KEY/);
    }
  });

  it("throws when the supabase URL is not a valid URL", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "not-a-url";
    const { loadEnv } = await import("../env.js");
    expect(() => loadEnv()).toThrow();
  });

  it("rejects RETRIEVAL_VECTOR_WEIGHT outside [0,1]", async () => {
    process.env.RETRIEVAL_VECTOR_WEIGHT = "2";
    const { loadEnv } = await import("../env.js");
    expect(() => loadEnv()).toThrow();
  });

  it("caches the parsed env on repeated calls", async () => {
    const { loadEnv } = await import("../env.js");
    const a = loadEnv();
    const b = loadEnv();
    expect(a).toBe(b);
  });
});

describe("requireServiceRole", () => {
  it("returns the service role key when set", async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "super-secret";
    const { requireServiceRole } = await import("../env.js");
    expect(requireServiceRole()).toBe("super-secret");
  });

  it("throws a descriptive error when the service role key is not set", async () => {
    const { requireServiceRole } = await import("../env.js");
    expect(() => requireServiceRole()).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });
});
