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
});
