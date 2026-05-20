import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const ORIGINAL_ENV = process.env;

const embedMock = vi.fn();
const rpcMock = vi.fn();
const fromMock = vi.fn();

vi.mock("../embed.js", () => ({
  embed: (...args: unknown[]) => embedMock(...args)
}));

vi.mock("../supabase.js", () => ({
  getPublicClient: () => ({
    rpc: rpcMock,
    from: fromMock
  })
}));

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "00000000-0000-0000-0000-000000000010",
    paper_id: "00000000-0000-0000-0000-0000000000aa",
    chunk_index: 0,
    heading_path: "Heading",
    content: "content",
    page_number: 1,
    vec_score: 0.9,
    fts_score: 0.5,
    combined_score: 0.7,
    ...overrides
  };
}

function buildPapersSelect(result: { data: unknown; error: unknown }) {
  // Mirrors supabase-js chain: from("papers").select(...).in(...)
  return {
    select: vi.fn().mockReturnValue({
      in: vi.fn().mockResolvedValue(result)
    })
  };
}

beforeEach(() => {
  vi.resetModules();
  embedMock.mockReset();
  rpcMock.mockReset();
  fromMock.mockReset();
  process.env = {
    ...ORIGINAL_ENV,
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
    VOYAGE_API_KEY: "v",
    GEMINI_API_KEY: "g",
    RETRIEVAL_TOP_K: "8",
    RETRIEVAL_VECTOR_WEIGHT: "0.6",
    RETRIEVAL_FTS_WEIGHT: "0.4"
  };
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
});

describe("retrieve", () => {
  it("returns an empty array when no rows match", async () => {
    embedMock.mockResolvedValueOnce([0.1, 0.2, 0.3]);
    rpcMock.mockResolvedValueOnce({ data: [], error: null });
    const { retrieve } = await import("../retrieval.js");
    const rows = await retrieve("anything");
    expect(rows).toEqual([]);
    // No paper lookup needed when no rows.
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("joins paper title and slug onto each returned chunk", async () => {
    const paperIdA = "00000000-0000-0000-0000-0000000000aa";
    const paperIdB = "00000000-0000-0000-0000-0000000000bb";
    embedMock.mockResolvedValueOnce([0.1]);
    rpcMock.mockResolvedValueOnce({
      data: [
        makeRow({ id: "row-1", paper_id: paperIdA }),
        makeRow({ id: "row-2", paper_id: paperIdB }),
        makeRow({ id: "row-3", paper_id: paperIdA })
      ],
      error: null
    });
    fromMock.mockReturnValueOnce(
      buildPapersSelect({
        data: [
          { id: paperIdA, title: "Lambda Whitepaper", slug: "lambda" },
          { id: paperIdB, title: "Security Pillar", slug: "security" }
        ],
        error: null
      })
    );

    const { retrieve } = await import("../retrieval.js");
    const rows = await retrieve("q");
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      id: "row-1",
      paper_title: "Lambda Whitepaper",
      paper_slug: "lambda"
    });
    expect(rows[1]).toMatchObject({
      id: "row-2",
      paper_title: "Security Pillar",
      paper_slug: "security"
    });
    expect(rows[2]).toMatchObject({
      id: "row-3",
      paper_title: "Lambda Whitepaper",
      paper_slug: "lambda"
    });
  });

  it("falls back to placeholders when the papers lookup is missing an entry", async () => {
    const knownId = "00000000-0000-0000-0000-0000000000aa";
    const orphanId = "00000000-0000-0000-0000-0000000000cc";
    embedMock.mockResolvedValueOnce([0.1]);
    rpcMock.mockResolvedValueOnce({
      data: [makeRow({ paper_id: knownId }), makeRow({ paper_id: orphanId })],
      error: null
    });
    fromMock.mockReturnValueOnce(
      buildPapersSelect({
        data: [{ id: knownId, title: "Known", slug: "known" }],
        error: null
      })
    );

    const { retrieve } = await import("../retrieval.js");
    const rows = await retrieve("q");
    expect(rows[0]?.paper_title).toBe("Known");
    expect(rows[1]?.paper_title).toBe("Unknown");
    expect(rows[1]?.paper_slug).toBe("");
  });

  it("passes user-supplied options through to the RPC call", async () => {
    embedMock.mockResolvedValueOnce([0.1]);
    rpcMock.mockResolvedValueOnce({ data: [], error: null });
    const { retrieve } = await import("../retrieval.js");
    await retrieve("q", {
      topK: 5,
      vectorWeight: 0.8,
      ftsWeight: 0.2,
      paperFilter: "specific-paper-id"
    });
    expect(rpcMock).toHaveBeenCalledTimes(1);
    const [name, args] = rpcMock.mock.calls[0]!;
    expect(name).toBe("hybrid_search");
    expect(args).toMatchObject({
      query_text: "q",
      match_count: 5,
      vector_weight: 0.8,
      fts_weight: 0.2,
      paper_filter: "specific-paper-id"
    });
    expect(args.query_embedding).toEqual([0.1]);
  });

  it("uses env defaults when no options are passed", async () => {
    embedMock.mockResolvedValueOnce([0.1]);
    rpcMock.mockResolvedValueOnce({ data: [], error: null });
    const { retrieve } = await import("../retrieval.js");
    await retrieve("q");
    const [, args] = rpcMock.mock.calls[0]!;
    expect(args).toMatchObject({
      match_count: 8,
      vector_weight: 0.6,
      fts_weight: 0.4,
      paper_filter: null
    });
  });

  it("throws when the RPC call returns an error", async () => {
    embedMock.mockResolvedValueOnce([0.1]);
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { message: "boom" }
    });
    const { retrieve } = await import("../retrieval.js");
    await expect(retrieve("q")).rejects.toThrow(/hybrid_search RPC failed.*boom/);
  });

  it("throws when the papers lookup returns an error", async () => {
    embedMock.mockResolvedValueOnce([0.1]);
    rpcMock.mockResolvedValueOnce({ data: [makeRow()], error: null });
    fromMock.mockReturnValueOnce(
      buildPapersSelect({ data: null, error: { message: "no select" } })
    );
    const { retrieve } = await import("../retrieval.js");
    await expect(retrieve("q")).rejects.toThrow(/papers lookup failed.*no select/);
  });

  it("deduplicates paper_id list before the lookup", async () => {
    const paperId = "00000000-0000-0000-0000-0000000000aa";
    embedMock.mockResolvedValueOnce([0.1]);
    rpcMock.mockResolvedValueOnce({
      data: [
        makeRow({ id: "r1", paper_id: paperId }),
        makeRow({ id: "r2", paper_id: paperId }),
        makeRow({ id: "r3", paper_id: paperId })
      ],
      error: null
    });
    const papersTable = buildPapersSelect({
      data: [{ id: paperId, title: "T", slug: "t" }],
      error: null
    });
    fromMock.mockReturnValueOnce(papersTable);

    const { retrieve } = await import("../retrieval.js");
    await retrieve("q");
    const selectResult = papersTable.select.mock.results[0]!.value as {
      in: ReturnType<typeof vi.fn>;
    };
    const [, ids] = selectResult.in.mock.calls[0]!;
    expect(ids).toEqual([paperId]);
  });

  it("embeds the query with the 'query' task type", async () => {
    embedMock.mockResolvedValueOnce([0.1]);
    rpcMock.mockResolvedValueOnce({ data: [], error: null });
    const { retrieve } = await import("../retrieval.js");
    await retrieve("how does it scale?");
    expect(embedMock).toHaveBeenCalledWith("how does it scale?", "query");
  });
});
