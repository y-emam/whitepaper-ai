"use client";

import { Fragment, useCallback, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Clock, Cpu } from "lucide-react";
import type { AskResponse, Citation } from "@whitepaper-ai/shared";
import { CitationBadge } from "@/components/citation-badge";
import { CitationDrawer } from "@/components/citation-drawer";
import { formatLatency } from "@/lib/utils";

interface AnswerBlockProps {
  response: AskResponse;
  question: string;
}

const INLINE_CITATION = /\[((?:c\d+)(?:\s*,\s*c\d+)*)\]/gi;

export function AnswerBlock({ response, question }: AnswerBlockProps) {
  const [activeCitation, setActiveCitation] = useState<Citation | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const labelToIndex = useMemo(() => {
    const map = new Map<string, number>();
    response.citations.forEach((c, i) => map.set(c.label.toLowerCase(), i + 1));
    return map;
  }, [response.citations]);

  const handleCitationClick = useCallback(
    (label: string) => {
      const c = response.citations.find((x) => x.label.toLowerCase() === label.toLowerCase());
      if (c) {
        setActiveCitation(c);
        setDrawerOpen(true);
      }
    },
    [response.citations]
  );

  const segments = useMemo(
    () => renderAnswer(response.answer, labelToIndex, handleCitationClick),
    [response.answer, labelToIndex, handleCitationClick]
  );

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="mt-8 space-y-6"
    >
      <header className="border-l-2 border-primary/60 pl-3">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Question</p>
        <h2 className="mt-1 text-base text-foreground">{question}</h2>
      </header>

      {response.citations.length === 0 ? (
        <div className="flex items-start gap-3 rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-yellow-400" />
          <div>
            <p className="text-sm font-medium text-yellow-100">Insufficient context</p>
            <p className="mt-0.5 text-xs text-yellow-100/70">
              The retrieved passages don&apos;t cover this question. Try rephrasing or narrowing the topic.
            </p>
          </div>
        </div>
      ) : null}

      <article className="prose prose-invert prose-sm max-w-none text-[15px] leading-relaxed text-foreground/95">
        {segments}
      </article>

      <footer className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border/60 pt-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Cpu className="h-3 w-3" />
          {response.model}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Clock className="h-3 w-3" />
          {formatLatency(response.latency_ms)}
        </span>
        <span>
          {response.citations.length} citation{response.citations.length === 1 ? "" : "s"}
        </span>
      </footer>

      {response.citations.length > 0 ? (
        <section className="mt-4">
          <h3 className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Sources</h3>
          <ol className="space-y-2">
            {response.citations.map((c, i) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => handleCitationClick(c.label)}
                  className="group flex w-full items-start gap-3 rounded-xl border border-border/60 bg-card/40 p-3 text-left transition-colors hover:border-primary/40 hover:bg-card"
                >
                  <span className="mt-0.5 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md bg-primary/15 text-[10px] font-semibold tabular-nums text-primary">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{c.paper_title}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {c.page ? `Page ${c.page} · ` : ""}
                      {c.heading_path ?? "—"}
                    </p>
                    <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground/80">{c.excerpt}</p>
                  </div>
                </button>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <CitationDrawer citation={activeCitation} open={drawerOpen} onOpenChange={setDrawerOpen} />
    </motion.section>
  );
}

function renderAnswer(
  text: string,
  labelToIndex: Map<string, number>,
  onClick: (label: string) => void
): React.ReactNode {
  const paragraphs = text.split(/\n{2,}/).filter((p) => p.trim().length > 0);
  return paragraphs.map((para, pIdx) => {
    const nodes: React.ReactNode[] = [];
    let lastEnd = 0;
    let counter = 0;
    for (const match of para.matchAll(INLINE_CITATION)) {
      const start = match.index ?? 0;
      const end = start + match[0].length;
      const inner = match[1] ?? "";
      if (start > lastEnd) {
        nodes.push(
          <Fragment key={`t-${pIdx}-${counter}`}>{para.slice(lastEnd, start)}</Fragment>
        );
      }
      const labels = inner.split(/\s*,\s*/).map((s) => s.toLowerCase()).filter(Boolean);
      labels.forEach((label, j) => {
        const idx = labelToIndex.get(label);
        if (idx) {
          nodes.push(
            <CitationBadge
              key={`c-${pIdx}-${counter}-${j}`}
              label={label}
              index={idx}
              onClick={onClick}
            />
          );
        }
      });
      lastEnd = end;
      counter += 1;
    }
    if (lastEnd < para.length) {
      nodes.push(<Fragment key={`t-end-${pIdx}`}>{para.slice(lastEnd)}</Fragment>);
    }
    return (
      <p key={`p-${pIdx}`} className="mb-4 last:mb-0">
        {nodes}
      </p>
    );
  });
}
