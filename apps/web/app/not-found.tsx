import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid min-h-[50vh] place-items-center text-center">
      <div>
        <p className="font-mono text-xs text-muted-foreground">404</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Page not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">That page isn&apos;t in the corpus.</p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm transition-colors hover:border-primary hover:text-primary"
        >
          Back to search
        </Link>
      </div>
    </div>
  );
}
