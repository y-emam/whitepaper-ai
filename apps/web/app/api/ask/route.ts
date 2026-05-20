import { NextResponse } from "next/server";
import {
  AskRequestSchema,
  generateAnswer,
  isBelowRefusalThreshold,
  loadEnv,
  REFUSAL_ANSWER,
  retrieve,
  type AskResponse,
  type Citation
} from "@whitepaper-ai/shared";
import { getAdminClient } from "@whitepaper-ai/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ApiError {
  error: { type: string; message: string };
}

function errorResponse(status: number, type: string, message: string): NextResponse<ApiError> {
  return NextResponse.json({ error: { type, message } }, { status });
}

export async function POST(req: Request): Promise<NextResponse<AskResponse | ApiError>> {
  const start = Date.now();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse(400, "invalid_json", "Request body must be valid JSON.");
  }

  const parsed = AskRequestSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(400, "invalid_input", parsed.error.issues.map((i) => i.message).join("; "));
  }

  const env = loadEnv();
  const { question } = parsed.data;

  let chunks;
  try {
    chunks = await retrieve(question);
  } catch (e) {
    console.error("[ask] retrieval failed:", e);
    const msg = e instanceof Error ? e.message : String(e);
    if (/429|rate|quota/i.test(msg)) {
      return errorResponse(
        429,
        "rate_limited",
        "The embedding service is currently rate-limited. Please retry in about a minute."
      );
    }
    return errorResponse(500, "retrieval_failed", "Could not search the corpus. Try again.");
  }

  if (isBelowRefusalThreshold(chunks)) {
    const response: AskResponse = {
      answer: REFUSAL_ANSWER,
      citations: [],
      sufficient_context: false,
      model: env.GEMINI_LLM_MODEL,
      latency_ms: Date.now() - start
    };
    void logQuery(question, response).catch((err) => console.error("[ask] log query failed:", err));
    return NextResponse.json(response);
  }

  let result;
  try {
    result = await generateAnswer({ question, chunks });
  } catch (e) {
    console.error("[ask] generation failed:", e);
    const msg = e instanceof Error ? e.message : String(e);
    if (/429|rate|quota/i.test(msg)) {
      return errorResponse(
        429,
        "rate_limited",
        "The LLM service is currently rate-limited. Please retry in about a minute."
      );
    }
    return errorResponse(500, "generation_failed", "Failed to generate an answer. Try again.");
  }

  const citations: Citation[] = result.answer.cited_chunks
    .map((label) => {
      const chunk = result.labelToChunk.get(label);
      if (!chunk) return null;
      return {
        id: chunk.id,
        label,
        paper_title: chunk.paper_title ?? "Unknown",
        paper_slug: chunk.paper_slug ?? "",
        page: chunk.page_number,
        heading_path: chunk.heading_path,
        excerpt: chunk.content.slice(0, 400)
      } satisfies Citation;
    })
    .filter((c): c is Citation => c !== null);

  const response: AskResponse = {
    answer: result.answer.answer,
    citations,
    sufficient_context: result.answer.sufficient_context,
    model: result.model,
    latency_ms: Date.now() - start
  };

  void logQuery(question, response).catch((err) => console.error("[ask] log query failed:", err));

  return NextResponse.json(response);
}

async function logQuery(question: string, response: AskResponse): Promise<void> {
  try {
    const env = loadEnv();
    if (!env.SUPABASE_SERVICE_ROLE_KEY) return;
    const supabase = getAdminClient();
    await supabase.from("queries").insert({
      question,
      answer: response.answer,
      cited_chunk_ids: response.citations.map((c) => c.id),
      sufficient_context: response.sufficient_context,
      latency_ms: response.latency_ms
    });
  } catch {
    // analytics is best-effort
  }
}
