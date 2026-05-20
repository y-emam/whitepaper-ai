import Link from "next/link";
import { ArrowUpRight, FileText } from "lucide-react";
import { getPublicClient, type PaperSummary } from "@whitepaper-ai/shared";

export const dynamic = "force-dynamic";

async function loadPapers(): Promise<PaperSummary[]> {
  const supabase = getPublicClient();
  const { data, error } = await supabase
    .from("papers")
    .select("id, slug, title, total_pages, ingested_at")
    .order("title");
  if (error) {
    console.error("[papers] load failed:", error.message);
    return [];
  }
  return (data ?? []) as PaperSummary[];
}

export default async function PapersPage() {
  const papers = await loadPapers();

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Corpus</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {papers.length} AWS whitepaper{papers.length === 1 ? "" : "s"} indexed.
        </p>
      </header>

      {papers.length === 0 ? (
        <div className="rounded-xl border border-border bg-card/40 p-8 text-center">
          <FileText className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            No papers yet. Run the ingestion script to populate the corpus.
          </p>
          <code className="mt-3 inline-block rounded-md bg-secondary px-2 py-1 font-mono text-xs">
            pnpm ingest
          </code>
        </div>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {papers.map((p) => (
            <li key={p.id}>
              <Link
                href={`/papers/${p.slug}`}
                className="group flex h-full items-start justify-between gap-3 rounded-xl border border-border/60 bg-card/40 p-4 transition-colors hover:border-primary/40 hover:bg-card"
              >
                <div className="min-w-0">
                  <h2 className="line-clamp-2 text-sm font-medium text-foreground">{p.title}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {p.total_pages ? `${p.total_pages} pages` : "Pages unknown"}
                  </p>
                </div>
                <ArrowUpRight className="h-4 w-4 flex-shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
