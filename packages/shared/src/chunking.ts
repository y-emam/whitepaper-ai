export interface ChunkInput {
  text: string;
  pageNumber: number;
}

export interface ParsedChunk {
  content: string;
  pageNumber: number;
  headingPath: string | null;
}

const TARGET_TOKENS = 500;
const OVERLAP_TOKENS = 75;
const CHARS_PER_TOKEN = 4;
const TARGET_CHARS = TARGET_TOKENS * CHARS_PER_TOKEN;
const OVERLAP_CHARS = OVERLAP_TOKENS * CHARS_PER_TOKEN;

const HEADING_REGEX = /^(?:#{1,6}\s+|\d+(?:\.\d+)*\s+)?[A-Z][A-Za-z0-9 ,:&\-\/()]{3,80}$/;

/**
 * Split paginated text into chunks roughly TARGET_TOKENS in size, with
 * heading-aware boundaries when possible. Maintains a running heading path
 * (e.g., "Reliability Pillar > Failure Management") inferred from short
 * Title-Case lines.
 */
export function chunkPages(pages: ChunkInput[]): ParsedChunk[] {
  const chunks: ParsedChunk[] = [];
  let headingStack: string[] = [];

  for (const { text, pageNumber } of pages) {
    const cleaned = normalizeText(text);
    if (!cleaned) continue;

    const lines = cleaned.split(/\n+/);
    let buffer = "";
    let bufferHeading: string[] = [...headingStack];

    const flush = () => {
      const content = buffer.trim();
      if (content.length === 0) return;
      chunks.push({
        content,
        pageNumber,
        headingPath: bufferHeading.length > 0 ? bufferHeading.join(" > ") : null
      });
      const tail = content.slice(-OVERLAP_CHARS);
      buffer = tail.length < content.length ? tail : "";
      bufferHeading = [...headingStack];
    };

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (isHeading(trimmed)) {
        if (buffer.trim().length > 0) flush();
        headingStack = updateHeadingStack(headingStack, trimmed);
        bufferHeading = [...headingStack];
        continue;
      }
      if (buffer.length + trimmed.length + 1 > TARGET_CHARS) {
        flush();
      }
      buffer += (buffer.length > 0 ? " " : "") + trimmed;
    }

    if (buffer.trim().length > 0) {
      flush();
    }
  }

  return chunks.filter((c) => c.content.length >= 50);
}

function normalizeText(input: string): string {
  return input
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/ /g, " ")
    .replace(/-\n(\w)/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isHeading(line: string): boolean {
  if (line.length > 80) return false;
  if (line.length < 4) return false;
  if (line.endsWith(".") || line.endsWith(",") || line.endsWith(":")) return false;
  if (!HEADING_REGEX.test(line)) return false;
  const words = line.split(/\s+/);
  if (words.length > 12) return false;
  return true;
}

function updateHeadingStack(stack: string[], heading: string): string[] {
  const level = inferHeadingLevel(heading);
  const next = stack.slice(0, level - 1);
  next.push(heading.replace(/^#{1,6}\s+/, "").trim());
  return next;
}

function inferHeadingLevel(heading: string): number {
  const hashMatch = heading.match(/^(#{1,6})\s+/);
  if (hashMatch && hashMatch[1]) return hashMatch[1].length;
  const numMatch = heading.match(/^(\d+(?:\.\d+)*)\s+/);
  if (numMatch && numMatch[1]) return numMatch[1].split(".").length;
  return 1;
}
