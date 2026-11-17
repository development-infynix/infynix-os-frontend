import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationProps {
  page: number
  totalPages: number
  total: number
  pageSize: number
  onPageChange: (page: number) => void
  /** While the next page loads: buttons stay put but can't be pressed twice. */
  busy?: boolean
  /** What's being counted, plural: "users". */
  noun?: string
  className?: string
}

/**
 * The footer of a server-paginated list: "1–50 | 230 users" as a chip on the
 * left; Previous, the current page number and Next on the right. Used by every
 * table.
 */
export function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
  busy = false,
  noun = 'items',
  className = '',
}: PaginationProps) {
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1
  const last = Math.min(page * pageSize, total)

  return (
    <nav
      aria-label="Pagination"
      className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-label text-ink-2 ${className}`}
    >
      {/* Left: the range and the total as one button-sized chip, split by a
          hairline. Screen readers get the sentence instead. */}
      <p className="btn btn-secondary h-8 gap-2 px-2.5 text-label text-ink-2 tabular-nums hover:filter-none">
        <span aria-hidden className="inline-flex items-center gap-2">
          <span className="font-medium text-ink">
            {first}–{last}
          </span>
          <span className="h-3.5 w-px bg-line-strong" />
          <span>
            <span className="font-medium text-ink">{total}</span> {noun}
          </span>
        </span>
        <span className="sr-only">
          Showing {first} to {last} of {total} {noun}
        </span>
      </p>
      {/* Right: Previous | page | Next, one segmented chip like the left one. */}
      <div className="btn btn-secondary h-8 gap-0 overflow-hidden p-0 hover:filter-none">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1 || busy}
          aria-label="Previous page"
          className="flex h-full items-center gap-1 px-2 text-ink-2 transition-colors enabled:hover:bg-surface-hover enabled:hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft size={15} strokeWidth={2} aria-hidden />
          <span className="hidden pl-0.5 sm:inline">Previous</span>
        </button>
        <span aria-hidden className="h-3.5 w-px shrink-0 bg-line-strong" />
        <span
          aria-current="page"
          className="flex h-full min-w-8 items-center justify-center px-2 text-label text-ink tabular-nums"
        >
          <span className="sr-only">Page </span>
          {page}
          <span className="sr-only"> of {totalPages}</span>
        </span>
        <span aria-hidden className="h-3.5 w-px shrink-0 bg-line-strong" />
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages || busy}
          aria-label="Next page"
          className="flex h-full items-center gap-1 px-2 text-ink-2 transition-colors enabled:hover:bg-surface-hover enabled:hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span className="hidden pr-0.5 sm:inline">Next</span>
          <ChevronRight size={15} strokeWidth={2} aria-hidden />
        </button>
      </div>
    </nav>
  )
}
