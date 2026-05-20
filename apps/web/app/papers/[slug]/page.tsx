import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { getPublicClient } from "@whitepaper-ai/shared";

export const dynamic = "force-dynamic";

interface PaperRow {
  id: string;
  slug: string;
  title: string;
  source_url: string;
  total_pages: number | null;
  ingested_at: string;
  metadata: Record<string, unknown>;
}

interface ChunkRow {
  id: string;
  heading_path: string | null;
  page_number: number | null;
  content: string;
}

async function loadPaper(slug: string): Promise<{ paper: PaperRow; chunks: ChunkRow[] } | null> {
  const supabase = getPublicClient();
  const { data: paper, error } = await supabase
    .from("papers")
    .select("id, slug, title, source_url, total_pages, ingested_at, metadata")
    .eq("slug", slug)
    .maybeSingle();
  if (error || !paper) return null;
  const { data: chunks } = await supabase
    .from("chunks")
    .select("id, heading_path, page_number, content")
    .eq("paper_id", paper.id)
    .order("chunk_index");
  return { paper: paper as PaperRow, chunks: (chunks ?? []) as ChunkRow[] };
}

interface PageProps {
  params: { slug: string };
}

export default async function PaperDetailPage({ params }: PageProps) {
  const result = await loadPaper(params.slug);
  if (!result) notFound();
  const { paper, chunks } = result;

  const sections: Array<{ heading: string; page: number | null }> = [];
  const seen = new Set<string>();
  for (const c of chunks) {
    if (!c.heading_path) continue;
    if (seen.has(c.heading_path)) continue;
    seen.add(c.heading_path);
    sections.push({ heading: c.heading_path, page: c.page_number });
  }

  return (
    <article>
      <Link
        href="/papers"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" /> Back to corpus
      </Link>

      <header className="mt-4 border-b border-border/60 pb-6">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{paper.title}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span>{paper.total_pages ? `${paper.total_pages} pages` : ""}</span>
          <span className="text-border">•</span>
          <span>{chunks.length} chunks</span>
          <span className="text-border">•</span>
          <a
            href={paper.source_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 transition-colors hover:text-primary"
          >
            Source PDF <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </header>

      <section className="mt-8">
        <h2 className="text-xs uppercase tracking-wider text-muted-foreground">Table of contents</h2>
        {sections.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No headings detected. The chunks below are ordered by their position in the PDF.
          </p>
        ) : (
          <ol className="mt-3 space-y-1">
            {sections.map((s, i) => (
              <li key={`${s.heading}-${i}`} className="flex items-baseline gap-2 text-sm">
                <span className="font-mono text-xs text-muted-foreground tabular-nums">
                  {s.page ? `p${s.page}` : "—"}
                </span>
                <span className="text-foreground">{s.heading}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-xs uppercase tracking-wider text-muted-foreground">Chunks</h2>
        <ol className="mt-3 space-y-3">
          {chunks.slice(0, 30).map((c) => (
            <li
              key={c.id}
              className="rounded-xl border border-border/40 bg-card/30 p-4 text-sm leading-relaxed text-foreground/90"
            >
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {c.page_number ? <span>Page {c.page_number}</span> : null}
                {c.heading_path ? (
                  <>
                    <span className="text-border">•</span>
                    <span className="truncate">{c.heading_path}</span>
                  </>
                ) : null}
              </div>
              <p className="line-clamp-4">{c.content}</p>
            </li>
          ))}
          {chunks.length > 30 ? (
            <li className="text-center text-xs text-muted-foreground">
              + {chunks.length - 30} more chunks
            </li>
          ) : null}
        </ol>
      </section>
    </article>
  );
}
