# whitepaper-ai — Product Design Document

## 1. Problem statement

AWS publishes ~150+ whitepapers covering compute, storage, networking, security, and architecture. The information is authoritative but the format is hostile to fast research:

- PDFs are not searchable across the corpus — you have to know which paper to open
- Concepts span multiple papers (e.g., a security question may pull from "Security Best Practices," "Well-Architected Framework," and "S3 Security")
- Engineers searching for specific guidance (cold start mitigation, VPC peering tradeoffs, etc.) end up either reading 80 pages or trusting Stack Overflow answers of unknown accuracy
- AWS certification studiers need cross-paper synthesis that AWS's own docs don't provide

**The gap:** there is no fast, citation-backed way to query the AWS whitepaper corpus in natural language.

## 2. Target user

Primary persona: **Mid-level DevOps / Cloud Engineer**, 2–8 years experience, working in an AWS environment.

- Reads whitepapers for both certification prep and on-the-job reference
- Doesn't have time to read full 60-page documents to answer a specific question
- Distrusts AI answers that don't cite sources
- Comfortable with technical UIs, doesn't need hand-holding

Secondary persona: **Solutions Architect preparing for AWS certifications.**

- Needs to synthesize concepts across multiple whitepapers
- Studies in time-boxed sessions
- Values being able to "ask follow-up questions" on a topic

Non-target users (explicitly out of scope):

- Non-technical buyers looking for "Cloud strategy" content
- Users wanting to upload their own corpus (this is a curated AWS-only system)
- Users wanting general AI chat about AWS (we are research-grounded only)

## 3. Core user journey

```
Land on whitepaper-ai
   ↓
See a clean search interface + 3 example questions
   ↓
Type a question (e.g., "How does Lambda handle cold starts?")
   ↓
Wait ~5–10 seconds for retrieval + answer generation
   ↓
Read an AI-generated answer (2–4 paragraphs) with inline citations [1] [2] [3]
   ↓
Hover or click citation badge → see the exact source passage with paper title, page, excerpt
   ↓
(Optional) Ask a follow-up question, with prior context preserved
```

Secondary journey: **MCP integration**

```
User has Claude Desktop installed
   ↓
Adds whitepaper-ai MCP server to their config
   ↓
In any Claude Desktop conversation, asks AWS-related questions
   ↓
Claude calls the MCP tools to fetch grounded answers
```

## 4. Feature priorities

### MVP — must ship by Day 10

1. **Search and answer** — natural language input → cited AI answer
2. **Inline citations** — every claim links to a specific chunk; user can see the source
3. **Source viewer** — click a citation, see the original paper title, page number, and the actual passage that was retrieved
4. **Curated corpus** — 20–30 AWS whitepapers ingested at launch (we pick them, not the user)
5. **MCP server** — exposes 3 tools: `search_papers`, `get_paper`, `list_papers`. Documented setup instructions in README.
6. **Refusal logic** — if no relevant context is retrieved (score below threshold), the AI explicitly says "the corpus doesn't contain enough information to answer this" rather than hallucinating

### Stretch — nice to have if time allows

7. Filter search by paper or topic
8. Follow-up questions with conversation context
9. Browse view (list all papers, click into one to see structure)
10. Query history (anonymized analytics view of common questions)

### Explicitly out of scope (v1)

- User authentication (anonymous use only)
- User-uploaded papers
- Non-AWS corpora
- Highlighting / annotation
- Export of answers
- Multi-language support (English only)
- Mobile-native app (web only, but responsive)

## 5. Success criteria

The product is **shipped** when:

- A user can ask a non-trivial AWS question and get an answer with at least 2 inline citations that resolve to the correct source passages
- The system honestly refuses to answer when the corpus doesn't contain the information
- The MCP server runs in Claude Desktop and returns the same answers the web UI does
- The deployed Vercel URL works for the same flows as localhost
- The corpus has ≥20 whitepapers ingested

The product is **portfolio-grade** when:

- The deployed site looks production-quality (not a Figma mockup)
- A skeptical reviewer (engineer or hiring manager) can use it for 60 seconds and walk away thinking "this is a real product"
- The repo has a clear README with screenshots, architecture description, and live demo link
- Both documents (PDD, TDD) are in `docs/` for visibility

## 6. Non-functional requirements

- **Response time:** answer returned in ≤15 seconds for fresh queries, ≤2 seconds for fully-cached queries
- **Refusal floor:** if retrieval similarity score is below threshold, refuse rather than hallucinate. Better to say "I don't know" than to invent.
- **Citation accuracy:** every citation [n] in the answer must map to a real chunk that contains the cited claim. Hallucinated citations are a hard failure.
- **Mobile:** the entire experience works on a 390px viewport. Not "mostly works" — works.
- **Cost:** average query cost ≤$0.005 (Gemini Flash + embedding query is well within this)

## 7. Risks and assumptions

**Risk 1: PDF parsing quality with `pdf-parse`**
`pdf-parse` is lower-fidelity than Python-based extractors. AWS whitepapers vary in formatting. Tables and diagrams may be lost.
*Mitigation:* Focus on text-heavy sections. Hand-curate the initial corpus to favor text-dense papers. Accept that some content (diagrams, tables) is not searchable in v1.

**Risk 2: Retrieval quality without a reranker**
Hybrid (vector + full-text) is good but not state-of-the-art.
*Mitigation:* Tune chunking carefully — semantic chunking on headings, ~500-token chunks with overlap. Use Gemini's most recent embedding model.

**Risk 3: Gemini hallucination despite citation requirements**
LLMs sometimes invent citations.
*Mitigation:* Strict structured output with chunk IDs that must come from a provided list. Server-side validation that every cited chunk ID was in the retrieved set. Reject and retry on validation failure.

**Risk 4: 10-day timeline overrun**
Aggressive for a 5–15 hr/week schedule with full-time job.
*Mitigation:* Strict daily scoping. End-of-day commits. Hard deadline at Day 10, regardless of polish level.

## 8. What the portfolio reviewer should see

A client or hiring manager visiting the repo and the live site should leave with:

- "This person can build a complete AI-powered web product end-to-end"
- "They understand RAG specifically — chunking, hybrid retrieval, citation-grounded generation, refusal logic"
- "They architect for reuse — same retrieval layer powers web UI and MCP server"
- "They communicate decisions in writing — PDD and TDD are visible in the repo"
- "They ship with quality — typed, tested critical paths, error handling, mobile-responsive"
