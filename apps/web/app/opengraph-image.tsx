import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "whitepaper-ai — Ask AWS whitepapers anything";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "72px",
          background:
            "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(255,153,0,0.20), transparent 60%), #0b1320",
          color: "#f0f6fc",
          fontFamily: "sans-serif"
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            fontSize: 28,
            fontWeight: 600,
            letterSpacing: -0.5
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: "rgba(255,153,0,0.18)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#FF9900",
              fontSize: 24
            }}
          >
            ◌
          </div>
          <span>whitepaper</span>
          <span style={{ color: "#FF9900" }}>.ai</span>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            flex: 1,
            marginTop: 32,
            gap: 18
          }}
        >
          <div style={{ fontSize: 84, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2 }}>
            Ask AWS whitepapers
          </div>
          <div
            style={{
              fontSize: 84,
              fontWeight: 700,
              color: "#FF9900",
              lineHeight: 1.05,
              letterSpacing: -2
            }}
          >
            anything.
          </div>
          <div
            style={{
              fontSize: 28,
              color: "#8b949e",
              lineHeight: 1.4,
              marginTop: 8,
              maxWidth: 920
            }}
          >
            Citation-grounded RAG over the AWS whitepaper corpus. Hybrid pgvector + FTS retrieval. Same engine powers the web app and a Claude Desktop MCP server.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 24,
            fontSize: 22,
            color: "#8b949e"
          }}
        >
          <div
            style={{
              padding: "8px 14px",
              borderRadius: 999,
              border: "1px solid rgba(255,153,0,0.35)",
              color: "#FF9900",
              background: "rgba(255,153,0,0.08)"
            }}
          >
            21 papers indexed
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "#FF9900" }}>•</span> Next.js + Supabase
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "#FF9900" }}>•</span> Voyage embeddings + Gemini
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "#FF9900" }}>•</span> MCP server
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
