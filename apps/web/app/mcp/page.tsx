import { Terminal, ArrowLeft, CheckCircle2 } from "lucide-react";
import Link from "next/link";

export default function McpPage() {
  return (
    <article>
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" /> Back to search
      </Link>

      <header className="mt-4 border-b border-border/60 pb-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground">
          <Terminal className="h-3 w-3 text-primary" />
          MCP integration
        </div>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
          Use whitepaper-ai inside Claude Desktop
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          The MCP server exposes three tools — <span className="font-mono">search_papers</span>,{" "}
          <span className="font-mono">list_papers</span>, and{" "}
          <span className="font-mono">get_paper</span> — so Claude can pull grounded AWS context
          into any conversation.
        </p>
      </header>

      <section className="mt-8 space-y-6">
        <Step n={1} title="Clone and build">
          <CodeBlock>{`git clone https://github.com/your-user/whitepaper-ai
cd whitepaper-ai
pnpm install
pnpm mcp:build`}</CodeBlock>
        </Step>

        <Step n={2} title="Set env variables for the server">
          <p className="mb-3 text-sm text-muted-foreground">
            The MCP server reads the same Supabase + Gemini env as the web app. Use the values from your{" "}
            <span className="font-mono">.env.local</span>.
          </p>
        </Step>

        <Step n={3} title="Add to Claude Desktop config">
          <p className="mb-3 text-sm text-muted-foreground">
            Edit <span className="font-mono">~/Library/Application Support/Claude/claude_desktop_config.json</span>{" "}
            (macOS) or the equivalent on your OS:
          </p>
          <CodeBlock>{`{
  "mcpServers": {
    "whitepaper-ai": {
      "command": "node",
      "args": ["/absolute/path/to/whitepaper-ai/packages/mcp-server/dist/index.js"],
      "env": {
        "NEXT_PUBLIC_SUPABASE_URL": "...",
        "NEXT_PUBLIC_SUPABASE_ANON_KEY": "...",
        "GEMINI_API_KEY": "..."
      }
    }
  }
}`}</CodeBlock>
        </Step>

        <Step n={4} title="Restart Claude Desktop and try it">
          <p className="text-sm text-muted-foreground">
            Open a new chat and ask an AWS question. Claude will call{" "}
            <span className="font-mono">search_papers</span> automatically when relevant.
          </p>
        </Step>
      </section>

      <section className="mt-12 rounded-2xl border border-border/60 bg-card/40 p-5">
        <h2 className="text-sm font-semibold text-foreground">Tools exposed</h2>
        <ul className="mt-4 space-y-3">
          <Tool
            name="search_papers"
            description="Hybrid retrieval (vector + FTS) across the corpus. Returns ranked passages with paper title, page, and heading."
            args="{ query: string, limit?: number = 5 }"
          />
          <Tool
            name="list_papers"
            description="Lists every whitepaper in the corpus."
            args="{}"
          />
          <Tool
            name="get_paper"
            description="Returns a paper's metadata and inferred table of contents by slug."
            args="{ slug: string }"
          />
        </ul>
      </section>
    </article>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <span className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-full border border-primary/30 bg-primary/10 text-xs font-semibold text-primary">
        {n}
      </span>
      <div className="flex-1 pt-0.5">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <div className="mt-2">{children}</div>
      </div>
    </div>
  );
}

function CodeBlock({ children }: { children: React.ReactNode }) {
  return (
    <pre className="overflow-x-auto rounded-xl border border-border/60 bg-background/60 p-4 text-xs leading-relaxed text-foreground/90 scrollbar-thin">
      <code className="font-mono">{children}</code>
    </pre>
  );
}

function Tool({ name, description, args }: { name: string; description: string; args: string }) {
  return (
    <li className="flex items-start gap-3">
      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-primary" />
      <div>
        <p className="text-sm font-mono text-foreground">{name}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        <p className="mt-1 font-mono text-[11px] text-muted-foreground/70">{args}</p>
      </div>
    </li>
  );
}
