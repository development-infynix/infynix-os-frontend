import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from './Button'

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
 * The footer of a server-paginated list: "Showing 51–100 of 230 users" on the
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
      <p className="tabular-nums">
        Showing <span className="font-medium text-ink">{first}</span>–
        <span className="font-medium text-ink">{last}</span> of{' '}
        <span className="font-medium text-ink">{total}</span> {noun}
      </p>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1 || busy}
          aria-label="Previous page"
        >
          <ChevronLeft size={15} strokeWidth={2} aria-hidden />
          <span className="hidden sm:inline">Previous</span>
        </Button>
        {/* The current page as a button-sized chip, between Previous and Next. */}
        <span
          aria-current="page"
          className="btn btn-secondary h-8 min-w-8 px-2.5 text-label text-ink tabular-nums hover:filter-none"
        >
          <span className="sr-only">Page </span>
          {page}
          <span className="sr-only"> of {totalPages}</span>
        </span>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages || busy}
          aria-label="Next page"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight size={15} strokeWidth={2} aria-hidden />
        </Button>
      </div>
    </nav>
  )
}
