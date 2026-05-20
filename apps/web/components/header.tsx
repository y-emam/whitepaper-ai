"use client";

import Link from "next/link";
import { useState } from "react";
import { BookOpen, Github, Menu, X } from "lucide-react";

const NAV = [
  { href: "/papers", label: "Browse papers" },
  { href: "/mcp", label: "MCP server" }
];

export function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          onClick={() => setOpen(false)}
          className="flex items-center gap-2 text-sm font-semibold tracking-tight"
        >
          <span className="grid h-7 w-7 place-items-center rounded-md bg-primary/15 text-primary">
            <BookOpen className="h-3.5 w-3.5" />
          </span>
          <span className="text-foreground">whitepaper</span>
          <span className="text-primary">.ai</span>
        </Link>

        <nav className="hidden items-center gap-1 text-sm text-muted-foreground sm:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-1.5 transition-colors hover:bg-accent hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
          <a
            href="https://github.com/y-emam/whitepaper-ai"
            target="_blank"
            rel="noreferrer"
            className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="GitHub"
          >
            <Github className="h-4 w-4" />
          </a>
        </nav>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      {open ? (
        <div className="border-t border-border/60 bg-background/95 backdrop-blur-xl sm:hidden">
          <nav className="mx-auto flex max-w-4xl flex-col gap-1 px-4 py-3 text-sm">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
            <a
              href="https://github.com/y-emam/whitepaper-ai"
              target="_blank"
              rel="noreferrer"
              onClick={() => setOpen(false)}
              className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Github className="h-4 w-4" /> View source on GitHub
            </a>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
