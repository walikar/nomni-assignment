interface LoadingStateProps {
  label: string;
  rows?: number;
  // After a few seconds of loading, explain that the free API host may be waking up.
  isSlow?: boolean;
}

// Grey placeholder rows while data loads.
export default function LoadingState({ label, rows = 6, isSlow = false }: LoadingStateProps) {
  return (
    <div className="bg-surface border border-line rounded-[10px] p-4" aria-busy="true" aria-label={label}>
      {isSlow && (
        <p className="text-muted text-[0.9rem] mb-2">
          Waking up the API. It runs on a free host that sleeps when idle, so the first load can take up to a minute.
        </p>
      )}
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex gap-4 py-2.5">
          <span className="block h-3.5 flex-1 rounded bg-skeleton animate-pulse motion-reduce:animate-none" />
          <span className="block h-3.5 flex-1 rounded bg-skeleton animate-pulse motion-reduce:animate-none" />
          <span className="block h-3.5 flex-1 rounded bg-skeleton animate-pulse motion-reduce:animate-none" />
        </div>
      ))}
    </div>
  );
}
