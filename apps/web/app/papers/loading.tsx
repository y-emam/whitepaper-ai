export default function PapersLoading() {
  return (
    <div>
      <div className="mb-8 space-y-2">
        <div className="h-7 w-32 rounded shimmer" />
        <div className="h-3 w-48 rounded shimmer" />
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <li key={i} className="h-20 rounded-xl shimmer" />
        ))}
      </ul>
    </div>
  );
}
