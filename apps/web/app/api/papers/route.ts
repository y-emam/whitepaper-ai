import { NextResponse } from "next/server";
import { getPublicClient } from "@whitepaper-ai/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const supabase = getPublicClient();
  const { data, error } = await supabase
    .from("papers")
    .select("id, slug, title, total_pages, ingested_at")
    .order("title");

  if (error) {
    return NextResponse.json(
      { error: { type: "db_error", message: error.message } },
      { status: 500 }
    );
  }

  return NextResponse.json({ papers: data ?? [] });
}
