#!/usr/bin/env node
import "dotenv/config";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { getPublicClient, loadEnv, retrieve } from "@whitepaper-ai/shared";

const SearchPapersInput = z.object({
  query: z.string().min(3),
  limit: z.number().int().positive().max(20).default(5)
});

const GetPaperInput = z.object({
  slug: z.string().min(1)
});

async function main(): Promise<void> {
  try {
    loadEnv();
  } catch (err) {
    console.error("[mcp] env validation failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  }

  const supabase = getPublicClient();
  const { error: ping } = await supabase.from("papers").select("id").limit(1);
  if (ping) {
    console.error("[mcp] could not reach Supabase:", ping.message);
    process.exit(1);
  }

  const server = new Server(
    { name: "whitepaper-ai", version: "0.1.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "search_papers",
        description:
          "Search AWS whitepapers for information relevant to a query. Use this when answering AWS-related questions to find authoritative source material before responding. Returns ranked passages with paper title, page number, and section heading.",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Natural-language search query" },
            limit: { type: "number", description: "Max passages to return (default 5)", default: 5 }
          },
          required: ["query"]
        }
      },
      {
        name: "list_papers",
        description: "List all available AWS whitepapers in the corpus.",
        inputSchema: { type: "object", properties: {} }
      },
      {
        name: "get_paper",
        description: "Get full details and structure of a specific whitepaper by slug.",
        inputSchema: {
          type: "object",
          properties: {
            slug: { type: "string", description: "Paper slug, e.g. aws-well-architected-framework" }
          },
          required: ["slug"]
        }
      }
    ]
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args } = req.params;
    try {
      if (name === "search_papers") {
        const input = SearchPapersInput.parse(args ?? {});
        const chunks = await retrieve(input.query, { topK: input.limit });
        const results = chunks.map((c) => ({
          paper_title: c.paper_title,
          paper_slug: c.paper_slug,
          page: c.page_number,
          heading_path: c.heading_path,
          excerpt: c.content.slice(0, 600),
          combined_score: Number(c.combined_score.toFixed(3))
        }));
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ query: input.query, results }, null, 2)
            }
          ]
        };
      }

      if (name === "list_papers") {
        const { data, error } = await supabase
          .from("papers")
          .select("slug, title, total_pages")
          .order("title");
        if (error) throw new Error(error.message);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ papers: data ?? [] }, null, 2)
            }
          ]
        };
      }

      if (name === "get_paper") {
        const input = GetPaperInput.parse(args ?? {});
        const { data: paper, error: paperErr } = await supabase
          .from("papers")
          .select("id, slug, title, source_url, total_pages, ingested_at")
          .eq("slug", input.slug)
          .maybeSingle();
        if (paperErr) throw new Error(paperErr.message);
        if (!paper) {
          return {
            isError: true,
            content: [{ type: "text", text: `Paper "${input.slug}" not found.` }]
          };
        }

        const { data: chunks, error: chunksErr } = await supabase
          .from("chunks")
          .select("heading_path, page_number")
          .eq("paper_id", paper.id)
          .order("chunk_index");
        if (chunksErr) throw new Error(chunksErr.message);

        const seen = new Set<string>();
        const toc: Array<{ heading: string; page: number | null }> = [];
        for (const c of chunks ?? []) {
          if (!c.heading_path) continue;
          if (seen.has(c.heading_path)) continue;
          seen.add(c.heading_path);
          toc.push({ heading: c.heading_path, page: c.page_number });
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  slug: paper.slug,
                  title: paper.title,
                  source_url: paper.source_url,
                  total_pages: paper.total_pages,
                  table_of_contents: toc
                },
                null,
                2
              )
            }
          ]
        };
      }

      return {
        isError: true,
        content: [{ type: "text", text: `Unknown tool: ${name}` }]
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[mcp] tool ${name} failed:`, message);
      return {
        isError: true,
        content: [{ type: "text", text: `Tool ${name} failed: ${message}` }]
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[mcp] whitepaper-ai server ready on stdio");
}

main().catch((err) => {
  console.error("[mcp] fatal:", err);
  process.exit(1);
});
