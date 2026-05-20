"use client";

import { ExternalLink, FileText } from "lucide-react";
import type { Citation } from "@whitepaper-ai/shared";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";

interface CitationDrawerProps {
  citation: Citation | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CitationDrawer({ citation, open, onOpenChange }: CitationDrawerProps) {
  if (!citation) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-primary">
            <span className="rounded-md bg-primary/15 px-2 py-0.5">[{citation.label}]</span>
            <span className="text-muted-foreground">cited passage</span>
          </div>
          <DialogTitle className="mt-1 text-xl">{citation.paper_title}</DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            {citation.page ? <span>Page {citation.page}</span> : null}
            {citation.heading_path ? (
              <>
                <span className="text-border">•</span>
                <span className="truncate">{citation.heading_path}</span>
              </>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 rounded-xl border border-border/60 bg-background/60 p-4">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
            {citation.excerpt}
          </p>
        </div>

        <div className="mt-4 flex items-center justify-between text-xs">
          <a
            href={`/papers/${citation.paper_slug}`}
            className="inline-flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-primary"
          >
            <FileText className="h-3.5 w-3.5" />
            View paper structure
          </a>
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <ExternalLink className="h-3.5 w-3.5" />
            id: <span className="font-mono">{citation.id.slice(0, 8)}</span>
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
