# whitepaper-ai — Technical Design Document

## 1. System overview

Three subsystems sharing one data layer:

```
                   ┌──────────────────┐
                   │  Supabase        │
                   │  - papers table  │
                   │  - chunks table  │
                   │  - pgvector idx  │
                   │  - tsvector idx  │
                   └────────▲─────────┘
                            │
   ┌────────────────────────┼────────────────────────┐
   │                        │                        │
┌──────┴──────┐         ┌──────┴──────┐         ┌──────┴──────┐
│ Ingestion   │         │ Next.js     │         │ MCP Server  │
│ (local CLI) │         │ (Vercel)    │         │ (local)     │
└─────────────┘         └─────────────┘         └─────────────┘
```

- **Ingestion:** local Node.js script. Run once, or rarely. Downloads PDFs, chunks, embeds, inserts.
- **Next.js app:** the user-facing product. Search, answer, browse, citation display.
- **MCP server:** TypeScript Node.js process. Exposes the corpus to Claude Desktop via stdio transport.

All three share `packages/shared` — one retrieval implementation, three consumers.

## 2. Tech stack

| Layer | Choice | Reason |
|---|---|---|
| Frontend | Next.js 14 App Router, TypeScript strict | Same as repocheck, proven. |
| Styling | Tailwind + shadcn/ui + framer-motion | Same as repocheck. |
| Backend | Next.js API routes (serverless Node) | No separate backend; Vercel handles it. |
| Database | Supabase Postgres + pgvector | Vector + relational + free tier. |
| Embeddings | Gemini `text-embedding-004` (768 dims) | API-based, no local compute, free quota. |
| LLM | Gemini 2.5 Flash | Cheap, fast, supports structured output via JSON schema. |
| PDF parsing | `pdf-parse` (npm) | Lower fidelity than Python options. Acceptable for AWS whitepapers (text-heavy). |
| MCP | `@modelcontextprotocol/sdk` TypeScript | Standard MCP TypeScript SDK. |
| Hosting | Vercel (web) + local (MCP server, ingestion) | Free tier, zero infra. |
| Monorepo | pnpm workspaces | `apps/web`, `packages/shared`, `packages/mcp-server`, `packages/ingestion`. |

## 3. Data model

### Table: `papers`

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | gen_random_uuid() |
| slug | text unique | URL-safe identifier, e.g. `aws-well-architected-framework` |
| title | text | Display title |
| source_url | text | Where the PDF was downloaded from |
| pdf_path | text | Local or storage path |
| total_pages | int | For pagination in source view |
| ingested_at | timestamptz | default now() |
| metadata | jsonb | Optional: tags, topic, author, year |

### Table: `chunks`

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | gen_random_uuid() |
| paper_id | uuid FK | references papers(id) on delete cascade |
| chunk_index | int | Ordering within the paper |
| heading_path | text | e.g. "Introduction > Cold Start Mitigation" |
| content | text | The chunk text |
| page_number | int | Source page in PDF |
| embedding | vector(768) | Gemini text-embedding-004 |
| fts | tsvector | Generated column from content |
| created_at | timestamptz | default now() |

### Indexes

- `chunks` HNSW index on `embedding` (cosine ops) — vector similarity
- `chunks` GIN index on `fts` — full-text search
- `chunks(paper_id)` — for paper-scoped queries
- `papers(slug)` — for slug lookups

### Optional table: `queries` (analytics)

| Column | Type |
|---|---|
| id | uuid PK |
| question | text |
| answer | text |
| cited_chunk_ids | uuid[] |
| sufficient_context | boolean |
| latency_ms | int |
| created_at | timestamptz |

## 4. Retrieval algorithm

The single most important technical decision in this project. Implemented as a Postgres function `hybrid_search` (one round trip).

**Hybrid retrieval** combining vector and full-text search, ranked together:

- Top 30 by cosine distance (vector_hits)
- Top 30 by `ts_rank` on websearch tsquery (fts_hits)
- Outer-join, weighted sum: `0.6 * vec_score + 0.4 * fts_score`
- Return top `match_count` (default 8)

Weights are starting values. Tune after seeing real outputs.

**Refusal threshold:** if top result's `combined_score < 0.4`, treat as "no relevant context" and have Gemini refuse rather than answer.

## 5. Answer generation

### Prompt structure (in `packages/shared/src/prompts/answer.ts`)

```
[ROLE]
You are a senior AWS cloud engineer answering a technical question
strictly using the provided source passages. Never invent information.
Every factual claim in your answer must reference one of the provided
passage IDs.

[USER QUESTION]
{{ question }}

[RETRIEVED PASSAGES]
Each passage has an ID. Reference these as [c#] in your answer.

Passage [c1]: (from "AWS Well-Architected Framework", page 23)
{{ content }}

Passage [c2]: (from "S3 Security Best Practices", page 12)
{{ content }}
...

[TASK]
Write a clear, technical answer in 2–4 paragraphs.

Every factual claim must include an inline citation in [c#] format.
If the passages don't fully answer the question, say so honestly.
Do NOT cite a passage ID that isn't in the list above.

[OUTPUT FORMAT]
JSON matching this schema:
{
  "answer": "string with inline [c1] [c2] citations",
  "cited_chunks": ["c1", "c2", ...],
  "sufficient_context": boolean
}
```

### Gemini call

- Model: `gemini-2.5-flash`
- `responseMimeType: "application/json"` + `responseSchema`
- Temperature: 0.2 (low — we want factual, not creative)
- Max output tokens: 1500
- Timeout: 15 seconds

### Server-side validation

After Gemini returns:

1. Parse JSON. If parse fails, retry once with stricter prompt.
2. Verify every `cited_chunks` ID exists in the retrieved set. If any ID is hallucinated, retry once.
3. Verify inline citation IDs in `answer` match `cited_chunks`. If mismatch, reject.
4. If `sufficient_context` is false but retrieval scores were high, log for review.

## 6. API contracts

### `POST /api/ask`

Request:

```json
{ "question": "string", "history": [] }
```

Response (success):

```json
{
  "answer": "string with [c1] [c2] citations",
  "citations": [
    {
      "id": "uuid",
      "label": "c1",
      "paper_title": "AWS Well-Architected Framework",
      "paper_slug": "aws-well-architected-framework",
      "page": 23,
      "heading_path": "Reliability Pillar > Failure Management",
      "excerpt": "string (first 200 chars of chunk content)"
    }
  ],
  "sufficient_context": true,
  "model": "gemini-2.5-flash",
  "latency_ms": 6432
}
```

Response (insufficient context):

```json
{
  "answer": "The corpus does not contain enough information to answer this question. The closest passages discuss [...]",
  "citations": [],
  "sufficient_context": false
}
```

Error responses: 400 (bad input), 429 (rate limit), 500 (server error). Structured `{ error: { type, message } }`.

### `GET /api/papers`

Returns list of all papers with id, slug, title, page count.

### `GET /api/papers/:slug`

Returns full paper metadata + list of chunks (with heading paths, page numbers).

## 7. MCP server design

Separate package: `packages/mcp-server/`.

### Tools exposed

**`search_papers`**

> Search AWS whitepapers for information relevant to a query. Use this when answering AWS-related questions to find authoritative source material before responding.

Input: `{ query: string, limit?: number (default 5) }`
Output: array of `{ paper_title, page, heading_path, excerpt }`

**`list_papers`**

> List all available AWS whitepapers in the corpus.

Input: `{}`
Output: array of `{ slug, title, total_pages }`

**`get_paper`**

> Get full details and structure of a specific whitepaper.

Input: `{ slug: string }`
Output: `{ title, total_pages, table_of_contents: [{ heading, page }] }`

### Implementation notes

- Use stdio transport
- Reuse retrieval from `packages/shared` — same code, same behavior
- Connection string to Supabase via env vars (server-only)
- Startup: validate Supabase connection. Exit cleanly with descriptive error if unreachable.

## 8. Error handling policy

- Never throw raw exceptions from API routes. Always return structured `{ error: { type, message } }` with proper status.
- Never silently swallow. If something fails, log to stderr.
- User-facing messages are different from log messages.
- Retries: Gemini calls retry once on parse failure or schema mismatch. No retries on user-input errors (400) or rate limits (429).

## 9. Quality bar

- TypeScript strict mode, no `any`, no `@ts-ignore`
- No `console.log` in committed code (only `console.error` for actual errors)
- No hardcoded secrets, URLs, or magic numbers — all in env or constants
- Every API route has input validation (Zod)
- Every external API call has error handling
- All UI states (loading, empty, error, success) are explicitly designed
- Mobile breakpoint tested manually

## 10. Deployment

- **Web app:** Vercel. Single project. Env vars set in Vercel dashboard for prod.
- **MCP server:** runs locally on user machines. Distributed via `npx` or repo clone.
- **Ingestion:** local Node.js script. Run on developer machine.
- **Database:** Supabase free tier.

## 11. Out of scope (v1)

- Real-time updates, caching layer beyond Supabase, user auth, rate limiting, webhooks, background queues, multi-tenancy, reranker model, OCR for image-based PDFs, file upload.

## 12. Future flexibility

- Swap LLM provider → change `packages/shared/src/llm.ts`.
- Swap embedding provider → change `packages/shared/src/embed.ts` (re-embed corpus on dim change).
- Add new corpora → `papers.metadata` already supports tags; UI may need filter.
- Add user accounts → Supabase Auth available, add `users` table.
- Switch retrieval algorithm → all retrieval through `packages/shared/src/retrieval.ts`.

## 13. References

- Gemini API: https://ai.google.dev/docs
- pgvector: https://github.com/pgvector/pgvector
- MCP TypeScript SDK: https://github.com/modelcontextprotocol/typescript-sdk
- shadcn/ui: https://ui.shadcn.com
