export function AnswerSkeleton() {
  return (
    <div className="mt-8 space-y-4">
      <div className="h-2 w-1/3 rounded shimmer" />
      <div className="space-y-2">
        <div className="h-3 w-full rounded shimmer" />
        <div className="h-3 w-[95%] rounded shimmer" />
        <div className="h-3 w-[88%] rounded shimmer" />
        <div className="h-3 w-[92%] rounded shimmer" />
        <div className="h-3 w-[60%] rounded shimmer" />
      </div>
      <div className="space-y-2 pt-3">
        <div className="h-3 w-[80%] rounded shimmer" />
        <div className="h-3 w-[70%] rounded shimmer" />
      </div>
      <div className="grid gap-2 pt-4 sm:grid-cols-2">
        <div className="h-16 rounded-xl shimmer" />
        <div className="h-16 rounded-xl shimmer" />
      </div>
    </div>
  );
}
