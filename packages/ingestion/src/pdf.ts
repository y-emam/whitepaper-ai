import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
// pdf-parse is CJS-only; bypass its index.js debug entrypoint that reads a sample file at import time.
const pdfParse = require("pdf-parse/lib/pdf-parse.js") as (
  data: Buffer,
  options?: { pagerender?: (data: unknown) => Promise<string> }
) => Promise<{ text: string; numpages: number; info: Record<string, unknown> }>;

export interface PageBlock {
  pageNumber: number;
  text: string;
}

export interface ParsedPdf {
  totalPages: number;
  pages: PageBlock[];
  info: Record<string, unknown>;
}

/**
 * Parse a PDF buffer into paginated text blocks. We use pdf-parse's pagerender
 * callback to capture per-page text. pdf-parse internally feeds each page's
 * TextContent through a default renderer; we replace it with one that records
 * each page in order.
 */
export async function parsePdf(buffer: Buffer): Promise<ParsedPdf> {
  const pages: PageBlock[] = [];
  let pageCounter = 0;

  const pagerender = async (pageData: unknown): Promise<string> => {
    pageCounter += 1;
    const currentPage = pageCounter;
    try {
      const page = pageData as {
        getTextContent: (opts: { normalizeWhitespace: boolean; disableCombineTextItems: boolean }) => Promise<{
          items: Array<{ str: string; transform?: number[] }>;
        }>;
      };
      const tc = await page.getTextContent({
        normalizeWhitespace: false,
        disableCombineTextItems: false
      });
      const lines: string[] = [];
      let lastY: number | null = null;
      let buf = "";
      for (const item of tc.items) {
        const y = item.transform?.[5] ?? null;
        if (lastY !== null && y !== null && Math.abs(y - lastY) > 2) {
          if (buf.trim().length > 0) lines.push(buf.trim());
          buf = "";
        }
        buf += item.str;
        lastY = y;
      }
      if (buf.trim().length > 0) lines.push(buf.trim());
      const text = lines.join("\n");
      pages.push({ pageNumber: currentPage, text });
      return text;
    } catch (err) {
      // Recording an empty page is better than aborting the whole document.
      pages.push({ pageNumber: currentPage, text: "" });
      throw err;
    }
  };

  const result = await pdfParse(buffer, { pagerender });
  return {
    totalPages: result.numpages,
    pages: pages.length > 0 ? pages : [{ pageNumber: 1, text: result.text }],
    info: result.info ?? {}
  };
}
