import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { RetrievedChunk } from "../types.js";

const ORIGINAL_ENV = process.env;

const generateContentMock = vi.fn();
const getGenerativeModelMock = vi.fn(() => ({ generateContent: generateContentMock }));

vi.mock("@google/generative-ai", () => {
  class GoogleGenerativeAI {
    constructor(public _key: string) {}
    getGenerativeModel = getGenerativeModelMock;
  }
  return {
    GoogleGenerativeAI,
    SchemaType: {
      OBJECT: "object",
      STRING: "string",
      ARRAY: "array",
      BOOLEAN: "boolean"
    }
  };
});

function makeChunk(i: number): RetrievedChunk {
  return {
    id: `00000000-0000-0000-0000-00000000000${i}`,
    paper_id: "00000000-0000-0000-0000-0000000000aa",
    chunk_index: i,
    heading_path: "Section",
    content: `content ${i}`,
    page_number: i,
    vec_score: 0.9,
    fts_score: 0.8,
    combined_score: 0.85,
    paper_title: "Paper",
    paper_slug: "paper"
  };
}

function geminiResponse(json: unknown) {
  return { response: { text: () => JSON.stringify(json) } };
}

beforeEach(() => {
  vi.resetModules();
  generateContentMock.mockReset();
  getGenerativeModelMock.mockClear();
  process.env = {
    ...ORIGINAL_ENV,
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
    VOYAGE_API_KEY: "v",
    GEMINI_API_KEY: "g",
    GEMINI_LLM_MODEL: "gemini-test-model"
  };
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
});

describe("generateAnswer", () => {
  it("returns the parsed answer on a valid first response", async () => {
    generateContentMock.mockResolvedValueOnce(
      geminiResponse({
        answer: "Lambda autoscales [c1] and handles bursts [c2].",
        cited_chunks: ["c1", "c2"],
        sufficient_context: true
      })
    );
    const { generateAnswer } = await import("../llm.js");
    const result = await generateAnswer({
      question: "How does Lambda scale?",
      chunks: [makeChunk(1), makeChunk(2)]
    });
    expect(result.answer.answer).toContain("[c1]");
    expect(result.answer.sufficient_context).toBe(true);
    expect(result.model).toBe("gemini-test-model");
    expect(result.labelToChunk.get("c1")?.chunk_index).toBe(1);
    expect(result.labelToChunk.get("c2")?.chunk_index).toBe(2);
    expect(generateContentMock).toHaveBeenCalledTimes(1);
  });

  it("retries when cited_chunks contains a hallucinated label, and succeeds on the second attempt", async () => {
    generateContentMock
      .mockResolvedValueOnce(
        geminiResponse({
          answer: "Bad [c99].",
          cited_chunks: ["c99"],
          sufficient_context: true
        })
      )
      .mockResolvedValueOnce(
        geminiResponse({
          answer: "Good [c1].",
          cited_chunks: ["c1"],
          sufficient_context: true
        })
      );
    const { generateAnswer } = await import("../llm.js");
    const result = await generateAnswer({
      question: "q?",
      chunks: [makeChunk(1)]
    });
    expect(result.answer.answer).toBe("Good [c1].");
    expect(generateContentMock).toHaveBeenCalledTimes(2);
    // Second call should carry the additional-constraints reminder.
    const secondPrompt = generateContentMock.mock.calls[1]![0];
    expect(secondPrompt).toContain("[ADDITIONAL CONSTRAINTS]");
  });

  it("retries when the inline [c#] label in the answer text is not in the allowed list", async () => {
    generateContentMock
      .mockResolvedValueOnce(
        geminiResponse({
          answer: "Inline hallucination [c42].",
          cited_chunks: ["c1"],
          sufficient_context: true
        })
      )
      .mockResolvedValueOnce(
        geminiResponse({
          answer: "Now valid [c1].",
          cited_chunks: ["c1"],
          sufficient_context: true
        })
      );
    const { generateAnswer } = await import("../llm.js");
    const result = await generateAnswer({
      question: "q?",
      chunks: [makeChunk(1)]
    });
    expect(result.answer.answer).toBe("Now valid [c1].");
    expect(generateContentMock).toHaveBeenCalledTimes(2);
  });

  it("retries when Gemini returns non-JSON text", async () => {
    generateContentMock
      .mockResolvedValueOnce({
        response: { text: () => "this is not JSON at all" }
      })
      .mockResolvedValueOnce(
        geminiResponse({
          answer: "Valid [c1].",
          cited_chunks: ["c1"],
          sufficient_context: true
        })
      );
    const { generateAnswer } = await import("../llm.js");
    const result = await generateAnswer({
      question: "q?",
      chunks: [makeChunk(1)]
    });
    expect(result.answer.answer).toBe("Valid [c1].");
    expect(generateContentMock).toHaveBeenCalledTimes(2);
  });

  it("throws after two failed attempts", async () => {
    generateContentMock
      .mockResolvedValueOnce(
        geminiResponse({
          answer: "Bad [c99].",
          cited_chunks: ["c99"],
          sufficient_context: true
        })
      )
      .mockResolvedValueOnce(
        geminiResponse({
          answer: "Still bad [c99].",
          cited_chunks: ["c99"],
          sufficient_context: true
        })
      );
    const { generateAnswer } = await import("../llm.js");
    await expect(
      generateAnswer({ question: "q?", chunks: [makeChunk(1)] })
    ).rejects.toThrow(/Gemini failed twice/);
    expect(generateContentMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry when the first attempt is fully valid", async () => {
    generateContentMock.mockResolvedValueOnce(
      geminiResponse({
        answer: "Good [c1].",
        cited_chunks: ["c1"],
        sufficient_context: true
      })
    );
    const { generateAnswer } = await import("../llm.js");
    await generateAnswer({ question: "q?", chunks: [makeChunk(1)] });
    expect(generateContentMock).toHaveBeenCalledTimes(1);
  });

  it("accepts bundled inline citations like [c1, c2] when both labels are allowed", async () => {
    generateContentMock.mockResolvedValueOnce(
      geminiResponse({
        answer: "Pillars include reliability and security [c1, c2].",
        cited_chunks: ["c1", "c2"],
        sufficient_context: true
      })
    );
    const { generateAnswer } = await import("../llm.js");
    const result = await generateAnswer({
      question: "q?",
      chunks: [makeChunk(1), makeChunk(2)]
    });
    expect(result.answer.cited_chunks).toEqual(["c1", "c2"]);
  });

  it("threads sufficient_context=false through unchanged", async () => {
    generateContentMock.mockResolvedValueOnce(
      geminiResponse({
        answer: "Not enough info here [c1].",
        cited_chunks: ["c1"],
        sufficient_context: false
      })
    );
    const { generateAnswer } = await import("../llm.js");
    const result = await generateAnswer({
      question: "q?",
      chunks: [makeChunk(1)]
    });
    expect(result.answer.sufficient_context).toBe(false);
  });
});
