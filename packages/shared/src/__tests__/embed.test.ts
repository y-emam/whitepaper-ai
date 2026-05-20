import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { packBatches } from "../embed.js";

const MAX_INPUTS_PER_REQUEST = 128;
const CHARS_PER_TOKEN = 4;

function tokensFor(text: string): number {
  return Math.max(1, Math.ceil(text.length / CHARS_PER_TOKEN));
}

function batchTokens(batch: string[]): number {
  return batch.reduce((acc, t) => acc + tokensFor(t), 0);
}

describe("packBatches (default budget)", () => {
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
    expect(batches.flat()).toHaveLength(texts.length);
  });

  it("trims any single text longer than 32_000 chars before packing", () => {
    const huge = "z".repeat(50_000);
    const batches = packBatches([huge]);
    expect(batches).toHaveLength(1);
    const onlyBatch = batches[0]!;
    expect(onlyBatch[0]!.length).toBe(32_000);
  });

  it("preserves input order across batches", () => {
    const texts = Array.from({ length: 200 }, (_, i) => `item-${i}`);
    const batches = packBatches(texts);
    expect(batches.flat()).toEqual(texts);
  });

  it("treats nullish entries as empty strings without crashing", () => {
    const texts = ["a", null as unknown as string, "b"];
    const batches = packBatches(texts);
    expect(batches.flat()).toHaveLength(3);
  });
});

describe("packBatches token budget (env-controlled)", () => {
  const ORIG = process.env;

  beforeEach(() => {
    process.env = { ...ORIG, VOYAGE_TOKEN_BUDGET: "8000" };
    vi.resetModules();
  });

  afterEach(() => {
    process.env = ORIG;
    vi.resetModules();
  });

  it("never exceeds the configured token budget per batch (8K)", async () => {
    const mod = await import("../embed.js");
    const piece = "a".repeat(4_000); // 1_000 tokens each
    const texts = Array.from({ length: 20 }, () => piece);
    const batches = mod.packBatches(texts);
    expect(batches.length).toBeGreaterThan(1);
    for (const b of batches) {
      expect(batchTokens(b)).toBeLessThanOrEqual(8_000);
    }
  });

  it("spills an over-budget item into its own batch", async () => {
    const mod = await import("../embed.js");
    const huge = "z".repeat(50_000); // trimmed to 32_000 chars = 8_000 tokens
    const small = "ok";
    const batches = mod.packBatches([huge, small]);
    // At the 8K budget, huge alone uses the full budget; adding small overflows
    // (8_000 + 1 > 8_000) → second item moves to a new batch.
    expect(batches.length).toBe(2);
    expect(batches[0]).toHaveLength(1);
    expect(batches[1]).toEqual(["ok"]);
  });
});
