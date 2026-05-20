"use client";

import { Sparkles } from "lucide-react";

export const EXAMPLE_QUESTIONS = [
  "How does AWS Lambda mitigate cold starts in production?",
  "What are the five pillars of the Well-Architected Framework?",
  "When should I choose S3 over EFS for shared storage?",
  "How do I design a multi-Region active-active architecture?",
  "What encryption options exist for data at rest in RDS?"
];

interface ExamplePromptsProps {
  onPick: (q: string) => void;
  disabled?: boolean;
}

export function ExamplePrompts({ onPick, disabled }: ExamplePromptsProps) {
  return (
    <div className="mt-6 grid gap-2 sm:grid-cols-2">
      {EXAMPLE_QUESTIONS.slice(0, 4).map((q) => (
        <button
          key={q}
          type="button"
          onClick={() => onPick(q)}
          disabled={disabled}
          className="group flex items-start gap-2.5 rounded-xl border border-border/60 bg-card/40 px-4 py-3 text-left text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-card hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Sparkles className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-primary/70 group-hover:text-primary" />
          <span>{q}</span>
        </button>
      ))}
    </div>
  );
}
