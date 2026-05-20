import { NextResponse } from "next/server";
import { getPublicClient } from "@whitepaper-ai/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: { slug: string };
}

export async function GET(_req: Request, { params }: RouteContext): Promise<NextResponse> {
  const supabase = getPublicClient();

  const { data: paper, error: paperError } = await supabase
    .from("papers")
    .select("id, slug, title, source_url, total_pages, ingested_at, metadata")
    .eq("slug", params.slug)
    .maybeSingle();

  if (paperError) {
    return NextResponse.json(
      { error: { type: "db_error", message: paperError.message } },
      { status: 500 }
    );
  }
  if (!paper) {
    return NextResponse.json(
      { error: { type: "not_found", message: "Paper not found" } },
      { status: 404 }
    );
  }

  const { data: chunks, error: chunksError } = await supabase
    .from("chunks")
    .select("id, chunk_index, heading_path, page_number, content")
    .eq("paper_id", paper.id)
    .order("chunk_index");

  if (chunksError) {
    return NextResponse.json(
      { error: { type: "db_error", message: chunksError.message } },
      { status: 500 }
    );
  }

  const seenHeadings = new Set<string>();
  const tableOfContents: Array<{ heading: string; page: number | null }> = [];
  for (const c of chunks ?? []) {
    if (!c.heading_path) continue;
    if (seenHeadings.has(c.heading_path)) continue;
    seenHeadings.add(c.heading_path);
    tableOfContents.push({ heading: c.heading_path, page: c.page_number });
  }

  return NextResponse.json({
    paper,
    chunk_count: chunks?.length ?? 0,
    table_of_contents: tableOfContents
  });
}
