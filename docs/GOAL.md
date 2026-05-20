# Goal

Ship `whitepaper-ai` — a portfolio-grade, citation-grounded RAG search engine over ~25 curated AWS whitepapers, with a polished Next.js web UI **and** a Claude-Desktop-compatible MCP server, both backed by the same hybrid (vector + FTS) retrieval over Supabase pgvector.

## Definition of done

1. Deployed Vercel URL works end-to-end (search → cited answer → source viewer).
2. MCP server runs locally in Claude Desktop and returns the same answers the web UI does.
3. Every answer carries inline `[c#]` citations that resolve to real source passages.
4. System honestly refuses ("the corpus doesn't contain enough information…") when context is insufficient (top combined score < 0.4).
5. Corpus has ≥20 AWS whitepapers ingested.
6. Repo README has architecture, screenshots, live URL, and setup instructions.
7. Mobile (≤390px) experience works.

## North-star quality bar

A skeptical reviewer (engineer or hiring manager) uses it for 60 seconds and walks away thinking *"this is a real product."*

See [PDD.md](./PDD.md) and [TDD.md](./TDD.md) for full product and technical design.
