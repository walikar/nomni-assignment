interface PaginationProps {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}

const buttonClass =
  'min-h-[40px] px-3.5 py-2 bg-surface text-ink border border-line rounded-lg cursor-pointer ' +
  'disabled:opacity-50 disabled:cursor-default';

export default function Pagination({ page, pageCount, onPageChange }: PaginationProps) {
  if (pageCount <= 1) return null;

  return (
    <nav aria-label="Pagination" className="flex items-center justify-between mt-3">
      <button className={buttonClass} disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        Previous
      </button>
      <span className="text-muted">
        Page {page} of {pageCount}
      </span>
      <button className={buttonClass} disabled={page >= pageCount} onClick={() => onPageChange(page + 1)}>
        Next
      </button>
    </nav>
  );
}
