# whitepaper-ai

> Citation-grounded RAG search across 25+ AWS whitepapers, with a polished Next.js web UI and a Claude-Desktop-compatible MCP server. Same hybrid retrieval (pgvector + Postgres FTS) powers both.

[![Next.js](https://img.shields.io/badge/Next.js-14-black)]() [![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)]() [![Supabase](https://img.shields.io/badge/Supabase-pgvector-green)]() [![MCP](https://img.shields.io/badge/MCP-server-purple)]()

```
            ┌──────────────────┐
            │  Supabase        │
            │  papers · chunks │
            │  pgvector + FTS  │
            └────────▲─────────┘
                     │
    ┌────────────────┼────────────────┐
    │                │                │
┌───┴─────┐    ┌─────┴─────┐    ┌─────┴─────┐
│Ingestion│    │ Next.js   │    │MCP server │
│(local)  │    │(Vercel)   │    │(local)    │
└─────────┘    └───────────┘    └───────────┘
```

## What it does

- **Ask** — type an AWS question, get a 2–4 paragraph answer with inline `[c#]` citations that resolve to the exact source passage (paper title, page, heading path).
- **Refuse honestly** — if the top retrieval score is below threshold, the system says so instead of inventing facts.
- **Browse** — see the full corpus and per-paper structure.
- **MCP** — expose `search_papers`, `list_papers`, `get_paper` to Claude Desktop so it can fetch grounded AWS context inside any chat.

See [docs/PDD.md](./docs/PDD.md) for product design and [docs/TDD.md](./docs/TDD.md) for technical design.

## Quickstart

```bash
# 1. Install
pnpm install

# 2. Configure
cp .env.example .env.local
# fill in Supabase + Gemini keys

# 3. Validate corpus URLs (writes data/corpus.json)
pnpm ingest:scrape

# 4. Download, chunk, embed, insert
pnpm ingest

# 5. Run the web app
pnpm dev
# open http://localhost:3000
```

## Monorepo layout

```
apps/web/                    Next.js 14 App Router web app
packages/shared/             retrieval, embed, llm, supabase, types — one impl, three consumers
packages/mcp-server/         MCP stdio server for Claude Desktop
packages/ingestion/          local script: scrape → download → chunk → embed → insert
docs/                        PDD, TDD, GOAL
```

## Architecture in one paragraph

The ingestion script downloads AWS whitepaper PDFs from `docs.aws.amazon.com`, splits them into ~500-token chunks on heading boundaries, embeds each chunk via Gemini `text-embedding-004`, and inserts rows into Supabase with both a `vector(768)` column and a generated `tsvector`. At query time, both the Next.js app and the MCP server call `retrieve()` from `packages/shared`, which fires a single Postgres RPC (`hybrid_search`) that joins the top-30 vector hits with the top-30 FTS hits and ranks them by `0.6 * vec_score + 0.4 * fts_score`. The top 8 chunks are labeled `[c1] … [c8]` and sent to Gemini 2.5 Flash under a strict JSON schema; the server then verifies every citation label appears in the retrieved set before returning the response.

## Setting up Supabase

Create a free Supabase project, then run the SQL migration (also reproduced inside the project setup prompt). It creates `papers`, `chunks` (with `vector(768)` and generated `tsvector`), `queries`, an HNSW index for vector similarity, a GIN index for FTS, and an RPC `hybrid_search(query_embedding, query_text, match_count, vector_weight, fts_weight, paper_filter)`.

## Setting up the MCP server in Claude Desktop

```bash
pnpm mcp:build
```

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

```json
{
  "mcpServers": {
    "whitepaper-ai": {
      "command": "node",
      "args": ["/absolute/path/to/whitepaper-ai/packages/mcp-server/dist/index.js"],
      "env": {
        "NEXT_PUBLIC_SUPABASE_URL": "...",
        "NEXT_PUBLIC_SUPABASE_ANON_KEY": "...",
        "GEMINI_API_KEY": "..."
      }
    }
  }
}
```

Restart Claude Desktop. Try `"How does AWS Lambda handle cold starts?"` — Claude will call `search_papers` automatically.

## Environment variables

| Var | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Anon key for read access |
| `SUPABASE_SERVICE_ROLE_KEY` | ingestion + analytics | Service-role key (server-side only) |
| `GEMINI_API_KEY` | yes | https://aistudio.google.com/apikey |
| `GEMINI_LLM_MODEL` | no | default `gemini-2.5-flash` |
| `GEMINI_EMBED_MODEL` | no | default `text-embedding-004` |
| `RETRIEVAL_TOP_K` | no | default 8 |
| `RETRIEVAL_VECTOR_WEIGHT` | no | default 0.6 |
| `RETRIEVAL_FTS_WEIGHT` | no | default 0.4 |
| `RETRIEVAL_REFUSAL_THRESHOLD` | no | default 0.4 |
| `INGEST_CONCURRENCY` | no | default 2 |

## Scripts

```bash
pnpm dev               # next dev for apps/web
pnpm build             # build all workspaces
pnpm typecheck         # tsc --noEmit across all workspaces
pnpm ingest:scrape     # validate seed URLs → data/corpus.json
pnpm ingest            # download + parse + chunk + embed + insert
pnpm mcp               # start the MCP server (stdio)
pnpm mcp:build         # build the MCP server to dist/
```

## Quality bar

- TypeScript strict, no `any`
- Input validation via Zod at every API boundary
- Citation labels verified server-side; hallucinated citations cause one retry then a hard failure
- All UI states (loading, error, empty, refusal) explicitly designed
- Mobile responsive at 390px

## Future work

- Per-paper search filter in the UI
- Conversation history (follow-up questions)
- Reranker (cross-encoder) over the top-30 hybrid set
- OCR fallback for image-only PDFs

## License

MIT
