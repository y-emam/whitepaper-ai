import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Header } from "@/components/header";
import "./globals.css";

export const metadata: Metadata = {
  title: "whitepaper-ai — Ask AWS whitepapers anything",
  description:
    "Citation-grounded RAG search across 21+ AWS whitepapers. Hybrid vector + full-text retrieval, refusal when context is insufficient, MCP server for Claude Desktop.",
  metadataBase: new URL("https://whitepaper-ai.vercel.app"),
  openGraph: {
    title: "whitepaper-ai — Ask AWS whitepapers anything",
    description: "Cited answers from AWS whitepapers. No hallucination. Hybrid retrieval. MCP-ready.",
    type: "website",
    url: "https://whitepaper-ai.vercel.app"
  },
  twitter: {
    card: "summary_large_image",
    title: "whitepaper-ai",
    description: "Cited answers from AWS whitepapers. No hallucination. Hybrid retrieval. MCP-ready."
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable} dark`}>
      <body className="min-h-screen font-sans">
        <Header />
        <main className="mx-auto max-w-4xl px-4 pb-24 pt-8 sm:px-6 lg:px-8">{children}</main>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
