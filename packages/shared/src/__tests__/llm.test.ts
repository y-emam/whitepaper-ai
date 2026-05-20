import { describe, it, expect } from "vitest";
import { extractInlineLabels } from "../llm.js";

describe("extractInlineLabels", () => {
  it("returns labels found in bracketed citations", () => {
    expect(extractInlineLabels("Cold starts add latency [c1] and can be mitigated [c2].")).toEqual([
      "c1",
      "c2"
    ]);
  });

  it("normalizes case to lowercase", () => {
    expect(extractInlineLabels("see [C3] and [c4]")).toEqual(["c3", "c4"]);
  });

  it("handles multiple citations of the same label", () => {
    expect(extractInlineLabels("[c1] then [c2] then [c1] again")).toEqual(["c1", "c2", "c1"]);
  });

  it("returns an empty array when there are no citations", () => {
    expect(extractInlineLabels("This answer has no citations.")).toEqual([]);
  });

  it("ignores non-c-prefixed bracketed text", () => {
    expect(extractInlineLabels("a [note] and [c5] mix")).toEqual(["c5"]);
  });

  it("expands bundled citations like [c1, c2, c3] into individual labels", () => {
    expect(extractInlineLabels("The framework has six pillars [c1, c2, c3].")).toEqual([
      "c1",
      "c2",
      "c3"
    ]);
  });

  it("handles mixed bundled and single citations", () => {
    expect(
      extractInlineLabels("First claim [c1, c2] and second claim [c3] and third [C4, c5].")
    ).toEqual(["c1", "c2", "c3", "c4", "c5"]);
  });
});
