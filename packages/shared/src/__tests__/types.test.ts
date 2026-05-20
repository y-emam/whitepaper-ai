import { describe, it, expect } from "vitest";
import { AskRequestSchema, LlmAnswerSchema } from "../types.js";

describe("AskRequestSchema", () => {
  it("accepts a well-formed question with no history", () => {
    const parsed = AskRequestSchema.parse({ question: "What is AWS Lambda?" });
    expect(parsed.question).toBe("What is AWS Lambda?");
    expect(parsed.history).toEqual([]);
  });

  it("trims whitespace before length validation", () => {
    const parsed = AskRequestSchema.parse({ question: "   Lambda?   " });
    expect(parsed.question).toBe("Lambda?");
  });

  it("rejects an empty question", () => {
    expect(() => AskRequestSchema.parse({ question: "" })).toThrow();
  });

  it("rejects a whitespace-only question (after trim it's empty)", () => {
    expect(() => AskRequestSchema.parse({ question: "   " })).toThrow();
  });

  it("rejects a question shorter than 3 characters", () => {
    expect(() => AskRequestSchema.parse({ question: "ai" })).toThrow();
  });

  it("rejects a question longer than 500 characters", () => {
    const huge = "a".repeat(501);
    expect(() => AskRequestSchema.parse({ question: huge })).toThrow();
  });

  it("accepts a 500-character question (boundary)", () => {
    const max = "a".repeat(500);
    const parsed = AskRequestSchema.parse({ question: max });
    expect(parsed.question.length).toBe(500);
  });

  it("rejects history with more than 10 turns", () => {
    const history = Array.from({ length: 11 }, () => ({
      role: "user" as const,
      content: "hi"
    }));
    expect(() => AskRequestSchema.parse({ question: "hello?", history })).toThrow();
  });

  it("rejects history turns with invalid roles", () => {
    expect(() =>
      AskRequestSchema.parse({
        question: "hello?",
        history: [{ role: "system", content: "no" }]
      })
    ).toThrow();
  });

  it("accepts up to 10 history turns", () => {
    const history = Array.from({ length: 10 }, (_, i) => ({
      role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
      content: `turn ${i}`
    }));
    const parsed = AskRequestSchema.parse({ question: "ok?", history });
    expect(parsed.history).toHaveLength(10);
  });
});

describe("LlmAnswerSchema", () => {
  it("accepts a fully formed answer", () => {
    const parsed = LlmAnswerSchema.parse({
      answer: "Lambda is serverless [c1].",
      cited_chunks: ["c1"],
      sufficient_context: true
    });
    expect(parsed.answer).toContain("[c1]");
    expect(parsed.cited_chunks).toEqual(["c1"]);
    expect(parsed.sufficient_context).toBe(true);
  });

  it("defaults cited_chunks to an empty array when omitted", () => {
    const parsed = LlmAnswerSchema.parse({
      answer: "x",
      sufficient_context: false
    });
    expect(parsed.cited_chunks).toEqual([]);
  });

  it("rejects when answer is missing", () => {
    expect(() =>
      LlmAnswerSchema.parse({ cited_chunks: [], sufficient_context: true })
    ).toThrow();
  });

  it("rejects when answer is an empty string", () => {
    expect(() =>
      LlmAnswerSchema.parse({
        answer: "",
        cited_chunks: [],
        sufficient_context: true
      })
    ).toThrow();
  });

  it("rejects when sufficient_context is missing", () => {
    expect(() =>
      LlmAnswerSchema.parse({ answer: "x", cited_chunks: [] })
    ).toThrow();
  });

  it("rejects when sufficient_context is not a boolean", () => {
    expect(() =>
      LlmAnswerSchema.parse({
        answer: "x",
        cited_chunks: [],
        sufficient_context: "yes"
      })
    ).toThrow();
  });

  it("rejects when cited_chunks is not an array of strings", () => {
    expect(() =>
      LlmAnswerSchema.parse({
        answer: "x",
        cited_chunks: [1, 2, 3],
        sufficient_context: true
      })
    ).toThrow();
  });
});
