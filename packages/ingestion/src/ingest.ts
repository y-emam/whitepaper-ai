import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";
import pLimit from "p-limit";

const __envFilename = fileURLToPath(import.meta.url);
const __envDirname = path.dirname(__envFilename);
loadDotenv({ path: path.resolve(__envDirname, "..", "..", "..", ".env.local") });
loadDotenv({ path: path.resolve(__envDirname, "..", "..", "..", ".env") });
import {
  chunkPages,
  embedBatch,
  getAdminClient,
  loadEnv
} from "@whitepaper-ai/shared";
import { parsePdf, type PageBlock } from "./pdf.js";
import { scrape } from "./scrape.js";

const __filename = __envFilename;
const __dirname = __envDirname;

const CORPUS_PATH = path.join(__dirname, "..", "data", "corpus.json");
const CACHE_DIR = path.join(__dirname, "..", "data", "cache");

interface CorpusEntry {
  slug: string;
  title: string;
  source_url: string;
  size_bytes: number;
}

interface CorpusFile {
  corpus: CorpusEntry[];
}

interface IngestStats {
  slug: string;
  status: "ok" | "skipped" | "error";
  chunks?: number;
  message?: string;
}

async function ensureCorpus(): Promise<CorpusEntry[]> {
  try {
    const raw = await fs.readFile(CORPUS_PATH, "utf-8");
    const parsed = JSON.parse(raw) as CorpusFile;
    if (parsed.corpus.length > 0) return parsed.corpus;
  } catch {
    // fall through
  }
  process.stderr.write("No corpus.json found, running scrape first...\n");
  return scrape();
}

async function downloadPdf(entry: CorpusEntry): Promise<Buffer> {
  await fs.mkdir(CACHE_DIR, { recursive: true });
  const cachePath = path.join(CACHE_DIR, `${entry.slug}.pdf`);
  try {
    const cached = await fs.readFile(cachePath);
    return cached;
  } catch {
    // not cached
  }
  const res = await fetch(entry.source_url);
  if (!res.ok) throw new Error(`Download failed (HTTP ${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(cachePath, buf);
  return buf;
}

async function ingestOne(entry: CorpusEntry): Promise<IngestStats> {
  const supabase = getAdminClient();
  process.stderr.write(`\n→ ${entry.slug}\n`);

  const { data: existing } = await supabase
    .from("papers")
    .select("id")
    .eq("slug", entry.slug)
    .maybeSingle();
  if (existing) {
    process.stderr.write(`  [skip] already ingested\n`);
    return { slug: entry.slug, status: "skipped", message: "already ingested" };
  }

  let buf: Buffer;
  try {
    buf = await downloadPdf(entry);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`  [err] download: ${msg}\n`);
    return { slug: entry.slug, status: "error", message: `download: ${msg}` };
  }

  let pages: PageBlock[];
  let totalPages: number;
  try {
    const parsed = await parsePdf(buf);
    pages = parsed.pages;
    totalPages = parsed.totalPages;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`  [err] parse: ${msg}\n`);
    return { slug: entry.slug, status: "error", message: `parse: ${msg}` };
  }

  const chunks = chunkPages(
    pages.map((p) => ({ text: p.text, pageNumber: p.pageNumber }))
  );
  if (chunks.length === 0) {
    process.stderr.write(`  [err] no chunks produced\n`);
    return { slug: entry.slug, status: "error", message: "no chunks produced" };
  }

  process.stderr.write(`  parsed: ${totalPages} pages → ${chunks.length} chunks. Embedding...\n`);
  let embeddings: number[][];
  try {
    embeddings = await embedBatch(
      chunks.map((c) => c.content),
      4
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`  [err] embed: ${msg}\n`);
    return { slug: entry.slug, status: "error", message: `embed: ${msg}` };
  }

  const { data: paper, error: paperError } = await supabase
    .from("papers")
    .insert({
      slug: entry.slug,
      title: entry.title,
      source_url: entry.source_url,
      total_pages: totalPages,
      metadata: { source: "aws-docs", size_bytes: entry.size_bytes }
    })
    .select("id")
    .single();

  if (paperError || !paper) {
    const msg = paperError?.message ?? "unknown";
    process.stderr.write(`  [err] insert paper: ${msg}\n`);
    return { slug: entry.slug, status: "error", message: `insert paper: ${msg}` };
  }

  const rows = chunks.map((c, i) => ({
    paper_id: paper.id,
    chunk_index: i,
    heading_path: c.headingPath,
    content: c.content,
    page_number: c.pageNumber,
    embedding: embeddings[i] ?? null
  }));

  const BATCH = 100;
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);
    const { error } = await supabase.from("chunks").insert(slice);
    if (error) {
      process.stderr.write(`  [err] insert chunks batch ${i}: ${error.message}\n`);
      return { slug: entry.slug, status: "error", message: `insert chunks: ${error.message}` };
    }
  }

  process.stderr.write(`  [ok] ${chunks.length} chunks inserted\n`);
  return { slug: entry.slug, status: "ok", chunks: chunks.length };
}

async function main(): Promise<void> {
  loadEnv();
  const corpus = await ensureCorpus();
  const env = loadEnv();
  const limit = pLimit(env.INGEST_CONCURRENCY);

  process.stderr.write(
    `\nIngesting ${corpus.length} papers (concurrency=${env.INGEST_CONCURRENCY})...\n`
  );

  const results = await Promise.all(corpus.map((c) => limit(() => ingestOne(c))));

  const ok = results.filter((r) => r.status === "ok");
  const skipped = results.filter((r) => r.status === "skipped");
  const errored = results.filter((r) => r.status === "error");

  process.stderr.write(
    `\n=== Done ===\n  ok:      ${ok.length}\n  skipped: ${skipped.length}\n  errored: ${errored.length}\n`
  );
  if (errored.length > 0) {
    process.stderr.write(`\nErrors:\n`);
    for (const e of errored) {
      process.stderr.write(`  ${e.slug}: ${e.message}\n`);
    }
  }
}

main().catch((err) => {
  console.error("[ingest] fatal:", err);
  process.exit(1);
});
