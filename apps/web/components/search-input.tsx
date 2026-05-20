"use client";

import { ArrowRight, Loader2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface SearchInputProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  loading?: boolean;
  autoFocus?: boolean;
}

export function SearchInput({ value, onChange, onSubmit, loading, autoFocus }: SearchInputProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (autoFocus && ref.current) ref.current.focus();
  }, [autoFocus]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!loading && value.trim().length >= 3) onSubmit();
      }}
      className={cn(
        "relative flex items-end gap-2 rounded-2xl border border-border bg-card/60 p-2 shadow-lg backdrop-blur",
        "focus-within:border-primary/50 focus-within:shadow-[0_0_0_3px_rgba(255,153,0,0.08)]",
        "transition-all"
      )}
    >
      <textarea
        ref={ref}
        rows={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (!loading && value.trim().length >= 3) onSubmit();
          }
        }}
        placeholder="Ask anything about AWS architecture, security, services…"
        disabled={loading}
        className="flex-1 resize-none bg-transparent px-3 py-2.5 text-base text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-60"
      />
      <button
        type="submit"
        disabled={loading || value.trim().length < 3}
        className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
        aria-label="Ask"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
      </button>
    </form>
  );
}
