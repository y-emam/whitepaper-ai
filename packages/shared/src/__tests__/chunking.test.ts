import { describe, it, expect } from "vitest";
import { chunkPages } from "../chunking.js";

describe("chunkPages", () => {
  it("splits paginated text into chunks and attaches page numbers", () => {
    const chunks = chunkPages([
      {
        pageNumber: 1,
        text:
          "Introduction\n" +
          "AWS Lambda is a serverless compute service. It runs code without provisioning servers. " +
          "Functions scale with demand."
      },
      {
        pageNumber: 2,
        text:
          "Cold Starts\n" +
          "A cold start occurs when a new execution environment must be initialized. " +
          "This adds latency to the first invocation."
      }
    ]);

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.every((c) => c.content.length >= 50)).toBe(true);
    expect(chunks.map((c) => c.pageNumber).sort()).toEqual([1, 2]);
  });

  it("detects heading-style lines and tracks a heading path", () => {
    const chunks = chunkPages([
      {
        pageNumber: 1,
        text:
          "Reliability Pillar\n" +
          "This pillar covers reliability of workloads. " +
          "Includes recovery, failure management, and capacity planning."
      },
      {
        pageNumber: 1,
        text:
          "Failure Management\n" +
          "Design for failure by isolating fault domains. " +
          "Use cells, shuffle-sharding, and bulkheads to limit blast radius."
      }
    ]);

    const headings = chunks.map((c) => c.headingPath);
    expect(headings).toContain("Reliability Pillar");
    expect(headings.some((h) => h?.includes("Failure Management"))).toBe(true);
  });

  it("drops chunks shorter than 50 characters", () => {
    const chunks = chunkPages([{ pageNumber: 1, text: "Too short." }]);
    expect(chunks).toHaveLength(0);
  });

  it("handles empty input", () => {
    expect(chunkPages([])).toEqual([]);
  });

  it("does not invent heading paths for sentence-style lines", () => {
    const chunks = chunkPages([
      {
        pageNumber: 1,
        text:
          "Amazon S3 provides durable storage for objects of any size, " +
          "stored across multiple Availability Zones with strong read-after-write consistency."
      }
    ]);
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0]?.headingPath).toBeNull();
  });

  it("respects target chunk size on long content (rough upper bound)", () => {
    const longText = Array.from({ length: 80 }, (_, i) =>
      `Sentence ${i + 1} of a long technical passage about AWS architecture and best practices for production workloads.`
    ).join("\n");
    const chunks = chunkPages([{ pageNumber: 1, text: longText }]);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      expect(c.content.length).toBeLessThanOrEqual(2500);
    }
  });
});
