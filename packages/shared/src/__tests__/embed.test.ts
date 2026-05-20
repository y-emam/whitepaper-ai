import { describe, it, expect } from "vitest";
import { packBatches } from "../embed.js";

// Voyage free-tier constraints these tests pin down:
const MAX_INPUTS_PER_REQUEST = 128;
const TOKEN_BUDGET_PER_REQUEST = 8_000;
const CHARS_PER_TOKEN = 4;

function tokensFor(text: string): number {
  return Math.max(1, Math.ceil(text.length / CHARS_PER_TOKEN));
}

function batchTokens(batch: string[]): number {
  return batch.reduce((acc, t) => acc + tokensFor(t), 0);
}

describe("packBatches", () => {
  it("returns an empty array for no inputs", () => {
    expect(packBatches([])).toEqual([]);
  });

  it("packs a small number of short texts into a single batch", () => {
    const texts = ["alpha", "beta", "gamma"];
    const batches = packBatches(texts);
    expect(batches).toHaveLength(1);
    expect(batches[0]).toEqual(texts);
  });

  it("never places more than 128 inputs in one batch", () => {
    const texts = Array.from({ length: 300 }, () => "x");
    const batches = packBatches(texts);
    expect(batches.length).toBeGreaterThan(1);
    for (const b of batches) {
      expect(b.length).toBeLessThanOrEqual(MAX_INPUTS_PER_REQUEST);
    }
    // All inputs preserved.
    expect(batches.flat()).toHaveLength(texts.length);
  });

  it("never exceeds the 8K token budget per batch", () => {
    // Each text is 4_000 chars = 1_000 tokens. Eight per batch would be 8_000
    // (right at the budget); the ninth must spill into a new batch.
    const piece = "a".repeat(4_000);
    const texts = Array.from({ length: 20 }, () => piece);
    const batches = packBatches(texts);
    expect(batches.length).toBeGreaterThan(1);
    for (const b of batches) {
      expect(batchTokens(b)).toBeLessThanOrEqual(TOKEN_BUDGET_PER_REQUEST);
    }
  });

  it("trims any single text longer than 32_000 chars before packing", () => {
    // 50K chars -> trimmed to 32K -> 8_000 tokens, which fits in exactly one batch.
    const huge = "z".repeat(50_000);
    const batches = packBatches([huge]);
    expect(batches).toHaveLength(1);
    const onlyBatch = batches[0]!;
    expect(onlyBatch[0]!.length).toBe(32_000);
  });

  it("handles a single text whose token count would exceed the budget by giving it its own batch", () => {
    // Even after trimming, an oversized item should still occupy a batch alone
    // — the implementation only splits BEFORE adding when there's already
    // content, so a lone huge item still goes through.
    const huge = "z".repeat(50_000); // trimmed to 32_000 chars = 8_000 tokens
    const small = "ok";
    const batches = packBatches([huge, small]);
    // First batch is the huge item alone (or with small if it still fits at exactly 8_000).
    // The packer only spills when tokens + tk > budget OR current.length >= 128,
    // so the second item (1 token) keeps the total at 8_001 -> overflow -> new batch.
    expect(batches.length).toBe(2);
    expect(batches[0]).toHaveLength(1);
    expect(batches[1]).toEqual(["ok"]);
  });

  it("preserves input order across batches", () => {
    const texts = Array.from({ length: 200 }, (_, i) => `item-${i}`);
    const batches = packBatches(texts);
    expect(batches.flat()).toEqual(texts);
  });

  it("treats nullish entries as empty strings without crashing", () => {
    // packBatches accepts string[] in TS, but at runtime defensively coerces
    // null/undefined to "". This exercises that guard.
    const texts = ["a", null as unknown as string, "b"];
    const batches = packBatches(texts);
    expect(batches.flat()).toHaveLength(3);
  });
});
