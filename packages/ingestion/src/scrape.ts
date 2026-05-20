import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";
import pLimit from "p-limit";

const __envFilename = fileURLToPath(import.meta.url);
const __envDirname = path.dirname(__envFilename);
loadDotenv({ path: path.resolve(__envDirname, "..", "..", "..", ".env.local") });
loadDotenv({ path: path.resolve(__envDirname, "..", "..", "..", ".env") });

const __filename = __envFilename;
const __dirname = __envDirname;

const SEEDS_PATH = path.join(__dirname, "..", "data", "seeds.json");
const CORPUS_OUT_PATH = path.join(__dirname, "..", "data", "corpus.json");

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

interface Seed {
  slug: string;
  title: string;
  source_url?: string;
}

interface CorpusEntry {
  slug: string;
  title: string;
  source_url: string;
  size_bytes: number;
}

interface SeedsFile {
  seeds: Seed[];
}

function defaultUrlPatterns(slug: string): string[] {
  return [
    `https://docs.aws.amazon.com/pdfs/whitepapers/latest/${slug}/${slug}.pdf`,
    `https://docs.aws.amazon.com/whitepapers/latest/${slug}/${slug}.pdf`
  ];
}

async function probeUrl(url: string): Promise<{ ok: boolean; size: number; contentType: string; status: number }> {
  const res = await fetch(url, {
    method: "HEAD",
    redirect: "follow",
    headers: { "User-Agent": UA, Accept: "application/pdf,*/*" }
  });
  const ct = res.headers.get("content-type") ?? "";
  const size = Number(res.headers.get("content-length") ?? "0");
  return {
    ok: res.ok && ct.includes("pdf"),
    size,
    contentType: ct,
    status: res.status
  };
}

async function probeSeed(seed: Seed): Promise<CorpusEntry | null> {
  const candidates = seed.source_url ? [seed.source_url] : defaultUrlPatterns(seed.slug);
  for (const url of candidates) {
    try {
      const result = await probeUrl(url);
      if (result.ok) {
        process.stderr.write(
          `  [ok]   ${seed.slug} (${(result.size / 1024 / 1024).toFixed(1)} MB) ${url}\n`
        );
        return { slug: seed.slug, title: seed.title, source_url: url, size_bytes: result.size };
      }
      process.stderr.write(
        `  [try]  ${seed.slug} → HTTP ${result.status} / ${result.contentType || "?"} for ${url}\n`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      process.stderr.write(`  [err]  ${seed.slug} → ${msg} for ${url}\n`);
    }
  }
  process.stderr.write(`  [skip] ${seed.slug} → all candidates failed\n`);
  return null;
}

export async function scrape(): Promise<CorpusEntry[]> {
  const raw = await fs.readFile(SEEDS_PATH, "utf-8");
  const { seeds } = JSON.parse(raw) as SeedsFile;

  process.stderr.write(`Probing ${seeds.length} seed URLs...\n`);
  const limit = pLimit(6);
  const results = await Promise.all(seeds.map((s) => limit(() => probeSeed(s))));
  const corpus = results.filter((r): r is CorpusEntry => r !== null);

  await fs.writeFile(CORPUS_OUT_PATH, JSON.stringify({ corpus }, null, 2) + "\n", "utf-8");
  process.stderr.write(
    `\nWrote ${corpus.length} validated entries to ${path.relative(process.cwd(), CORPUS_OUT_PATH)}\n` +
      `Dropped ${seeds.length - corpus.length} unreachable seeds.\n`
  );
  return corpus;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  scrape().catch((err) => {
    console.error("[scrape] fatal:", err);
    process.exit(1);
  });
}
