interface ErrorStateProps {
  title: string;
  message?: string;
  onRetry?: () => void;
}

export default function ErrorState({ title, message, onRetry }: ErrorStateProps) {
  return (
    <div className="bg-surface border border-line rounded-[10px] py-10 px-4 text-center" role="alert">
      <p className="font-semibold mb-1">{title}</p>
      {message && <p className="text-muted">{message}</p>}
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 min-h-[40px] px-3.5 py-2 bg-surface border border-line rounded-lg text-ink cursor-pointer"
        >
          Retry
        </button>
      )}
    </div>
  );
}
