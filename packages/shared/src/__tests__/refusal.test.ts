import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { RetrievedChunk } from "../types.js";

function chunk(combined_score: number): RetrievedChunk {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    paper_id: "00000000-0000-0000-0000-000000000002",
    chunk_index: 0,
    heading_path: null,
    content: "any",
    page_number: 1,
    vec_score: combined_score,
    fts_score: 0,
    combined_score,
    paper_title: "any",
    paper_slug: "any"
  };
}

describe("isBelowRefusalThreshold", () => {
  const ORIGINAL = process.env;

  beforeEach(() => {
    process.env = {
      ...ORIGINAL,
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
      VOYAGE_API_KEY: "test",
      GEMINI_API_KEY: "test",
      RETRIEVAL_REFUSAL_THRESHOLD: "0.4"
    };
  });

  afterEach(() => {
    process.env = ORIGINAL;
  });

  it("refuses when the chunk list is empty", async () => {
    const mod = await import("../retrieval.js");
    expect(mod.isBelowRefusalThreshold([])).toBe(true);
  });

  it("refuses when the top combined_score is below the configured floor", async () => {
    const mod = await import("../retrieval.js");
    expect(mod.isBelowRefusalThreshold([chunk(0.3)])).toBe(true);
  });

  it("answers when the top combined_score exceeds the floor", async () => {
    const mod = await import("../retrieval.js");
    expect(mod.isBelowRefusalThreshold([chunk(0.5)])).toBe(false);
  });
});
