"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight, Database, ShieldCheck, Sparkles } from "lucide-react";
import type { AskResponse } from "@whitepaper-ai/shared";
import { SearchInput } from "@/components/search-input";
import { ExamplePrompts } from "@/components/example-prompts";
import { AnswerBlock } from "@/components/answer-block";
import { AnswerSkeleton } from "@/components/answer-skeleton";

interface ErrorState {
  message: string;
}

export default function HomePage() {
  const [question, setQuestion] = useState("");
  const [submittedQuestion, setSubmittedQuestion] = useState<string | null>(null);
  const [response, setResponse] = useState<AskResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ErrorState | null>(null);

  const ask = async () => {
    const q = question.trim();
    if (q.length < 3) return;
    setLoading(true);
    setError(null);
    setResponse(null);
    setSubmittedQuestion(q);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q })
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message ?? `Request failed (${res.status})`);
      }
      setResponse(json as AskResponse);
    } catch (e) {
      setError({ message: e instanceof Error ? e.message : "Unknown error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {!submittedQuestion ? <Hero /> : null}

      <section className={submittedQuestion ? "pt-2" : "pt-6"}>
        <SearchInput
          value={question}
          onChange={setQuestion}
          onSubmit={ask}
          loading={loading}
          autoFocus
        />
        {!submittedQuestion ? <ExamplePrompts onPick={(q) => { setQuestion(q); }} disabled={loading} /> : null}
      </section>

      {loading ? <AnswerSkeleton /> : null}

      {error && !loading ? (
        <div className="mt-8 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error.message}
        </div>
      ) : null}

      {response && submittedQuestion && !loading ? (
        <AnswerBlock response={response} question={submittedQuestion} />
      ) : null}

      {!submittedQuestion ? <FeatureGrid /> : null}
    </div>
  );
}

function Hero() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="mb-8 text-center sm:mb-12"
    >
      <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground">
        <Sparkles className="h-3 w-3 text-primary" />
        <span>Citation-grounded RAG over 39 AWS whitepapers</span>
      </div>
      <h1 className="mt-5 text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
        <span className="gradient-text">Ask AWS whitepapers</span>
        <br />
        <span className="text-primary">anything.</span>
      </h1>
      <p className="mx-auto mt-4 max-w-xl text-balance text-sm text-muted-foreground sm:text-base">
        Every answer carries inline citations that resolve to the exact source passage.
        No hallucinated facts — when the corpus doesn&apos;t know, it says so.
      </p>
    </motion.section>
  );
}

function FeatureGrid() {
  const features = [
    {
      icon: Database,
      title: "Hybrid retrieval",
      body: "pgvector cosine similarity + Postgres full-text search, ranked together. Same logic powers web and MCP."
    },
    {
      icon: ShieldCheck,
      title: "Citation-grounded",
      body: "Every claim links to a specific chunk with page number and heading path. Hallucinated citations are rejected server-side."
    },
    {
      icon: Sparkles,
      title: "Honest refusal",
      body: "If the top retrieval score is below threshold, the system says so instead of inventing an answer."
    }
  ];
  return (
    <section className="mt-20 grid gap-3 sm:grid-cols-3">
      {features.map((f) => (
        <div
          key={f.title}
          className="rounded-2xl border border-border/60 bg-card/40 p-5 transition-colors hover:border-border"
        >
          <f.icon className="h-4 w-4 text-primary" />
          <h3 className="mt-3 text-sm font-semibold text-foreground">{f.title}</h3>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{f.body}</p>
        </div>
      ))}
      <div className="rounded-2xl border border-border/60 bg-card/40 p-5 sm:col-span-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Use the same corpus inside Claude Desktop
            </h3>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              An MCP server exposes <span className="font-mono">search_papers</span>,{" "}
              <span className="font-mono">list_papers</span>, and{" "}
              <span className="font-mono">get_paper</span> as tools. Configure once and Claude
              fetches grounded AWS context automatically.
            </p>
          </div>
          <Link
            href="/mcp"
            className="inline-flex items-center gap-1 self-end whitespace-nowrap rounded-md border border-border px-3 py-1.5 text-xs text-foreground transition-colors hover:border-primary hover:text-primary"
          >
            Setup guide <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </section>
  );
}
