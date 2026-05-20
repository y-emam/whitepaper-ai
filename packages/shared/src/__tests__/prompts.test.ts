import { describe, it, expect } from "vitest";
import { buildAnswerPrompt, REFUSAL_ANSWER } from "../prompts/answer.js";
import type { RetrievedChunk } from "../types.js";

function makeChunk(overrides: Partial<RetrievedChunk> = {}): RetrievedChunk {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    paper_id: "00000000-0000-0000-0000-000000000002",
    chunk_index: 0,
    heading_path: "Reliability Pillar",
    content: "Design for failure by isolating fault domains.",
    page_number: 12,
    vec_score: 0.8,
    fts_score: 0.7,
    combined_score: 0.75,
    paper_title: "AWS Well-Architected",
    paper_slug: "aws-well-architected",
    ...overrides
  };
}

describe("buildAnswerPrompt", () => {
  it("injects the user question into the prompt", () => {
    const prompt = buildAnswerPrompt({
      question: "What is a cold start?",
      passages: [{ label: "c1", chunk: makeChunk() }]
    });
    expect(prompt).toContain("What is a cold start?");
    expect(prompt).toContain("[USER QUESTION]");
  });

  it("lists every passage with its [c#] label, page number, and heading", () => {
    const prompt = buildAnswerPrompt({
      question: "Q",
      passages: [
        { label: "c1", chunk: makeChunk({ page_number: 5, heading_path: "Intro" }) },
        { label: "c2", chunk: makeChunk({ page_number: 9, heading_path: "Scale" }) }
      ]
    });
    expect(prompt).toContain("Passage [c1]:");
    expect(prompt).toContain("Passage [c2]:");
    expect(prompt).toContain("page 5");
    expect(prompt).toContain("page 9");
    expect(prompt).toContain('section "Intro"');
    expect(prompt).toContain('section "Scale"');
  });

  it("renders 'page unknown' when page_number is null", () => {
    const prompt = buildAnswerPrompt({
      question: "Q",
      passages: [{ label: "c1", chunk: makeChunk({ page_number: null }) }]
    });
    expect(prompt).toContain("page unknown");
    expect(prompt).not.toContain("page null");
  });

  it("omits the section clause when heading_path is null", () => {
    const prompt = buildAnswerPrompt({
      question: "Q",
      passages: [{ label: "c1", chunk: makeChunk({ heading_path: null }) }]
    });
    expect(prompt).not.toContain("section \"");
  });

  it("constrains the model to the exact list of valid labels", () => {
    const prompt = buildAnswerPrompt({
      question: "Q",
      passages: [
        { label: "c1", chunk: makeChunk() },
        { label: "c2", chunk: makeChunk() },
        { label: "c3", chunk: makeChunk() }
      ]
    });
    expect(prompt).toContain("[c1] [c2] [c3]");
    expect(prompt).toContain("ONLY from this list");
  });

  it("includes the trimmed content body for each passage", () => {
    const prompt = buildAnswerPrompt({
      question: "Q",
      passages: [
        {
          label: "c1",
          chunk: makeChunk({ content: "  Lambda autoscales horizontally.  " })
        }
      ]
    });
    expect(prompt).toContain("Lambda autoscales horizontally.");
  });

  it("includes the paper title in each passage citation", () => {
    const prompt = buildAnswerPrompt({
      question: "Q",
      passages: [
        { label: "c1", chunk: makeChunk({ paper_title: "Serverless Best Practices" }) }
      ]
    });
    expect(prompt).toContain('"Serverless Best Practices"');
  });

  it("instructs the model to emit JSON matching the LlmAnswer shape", () => {
    const prompt = buildAnswerPrompt({
      question: "Q",
      passages: [{ label: "c1", chunk: makeChunk() }]
    });
    expect(prompt).toContain('"answer"');
    expect(prompt).toContain('"cited_chunks"');
    expect(prompt).toContain('"sufficient_context"');
  });

  it("warns against bundled citations", () => {
    const prompt = buildAnswerPrompt({
      question: "Q",
      passages: [{ label: "c1", chunk: makeChunk() }]
    });
    expect(prompt).toContain("SEPARATE brackets");
    expect(prompt).toMatch(/Do NOT bundle/);
  });

  it("handles zero passages without throwing (degenerate but defined)", () => {
    const prompt = buildAnswerPrompt({ question: "Q", passages: [] });
    expect(typeof prompt).toBe("string");
    expect(prompt).toContain("[USER QUESTION]");
  });
});

describe("REFUSAL_ANSWER", () => {
  it("is a non-empty user-facing string", () => {
    expect(typeof REFUSAL_ANSWER).toBe("string");
    expect(REFUSAL_ANSWER.length).toBeGreaterThan(20);
  });
});
