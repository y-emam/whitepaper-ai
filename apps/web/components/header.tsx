import Link from "next/link";
import { BookOpen, Github } from "lucide-react";

export function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-primary/15 text-primary">
            <BookOpen className="h-3.5 w-3.5" />
          </span>
          <span className="text-foreground">whitepaper</span>
          <span className="text-primary">.ai</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm text-muted-foreground">
          <Link
            href="/papers"
            className="hidden rounded-md px-3 py-1.5 transition-colors hover:bg-accent hover:text-foreground sm:inline-block"
          >
            Browse papers
          </Link>
          <Link
            href="/mcp"
            className="hidden rounded-md px-3 py-1.5 transition-colors hover:bg-accent hover:text-foreground sm:inline-block"
          >
            MCP server
          </Link>
          <a
            href="https://github.com"
            target="_blank"
            rel="noreferrer"
            className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="GitHub"
          >
            <Github className="h-4 w-4" />
          </a>
        </nav>
      </div>
    </header>
  );
}
