"use client";

import { cn } from "@/lib/utils";

interface CitationBadgeProps {
  label: string;
  index: number;
  onClick: (label: string) => void;
  active?: boolean;
}

export function CitationBadge({ label, index, onClick, active }: CitationBadgeProps) {
  return (
    <button
      type="button"
      onClick={() => onClick(label)}
      className={cn(
        "ml-0.5 inline-flex h-[18px] min-w-[18px] -translate-y-[2px] items-center justify-center rounded-md border px-1 text-[10px] font-semibold tabular-nums leading-none transition-all align-baseline",
        active
          ? "border-primary bg-primary/20 text-primary"
          : "border-border/80 bg-secondary text-muted-foreground hover:border-primary/60 hover:bg-primary/10 hover:text-primary"
      )}
      aria-label={`Citation ${index}`}
    >
      {index}
    </button>
  );
}
