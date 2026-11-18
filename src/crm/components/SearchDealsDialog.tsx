import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Modal } from '@/components/Modal'
import type { BoardColumns, CrmDeal, CrmStage } from '../types'

interface SearchDealsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  stages: CrmStage[]
  columns: BoardColumns
  /** Jumps to the card on the board. */
  onPick: (deal: CrmDeal) => void
}

const MAX_RESULTS = 20

/** Finds a deal in the current pipeline by client name, email or phone. Searches the dummy board for now. */
export function SearchDealsDialog({ open, onOpenChange, stages, columns, onPick }: SearchDealsDialogProps) {
  const [q, setQ] = useState('')
  const term = q.trim().toLowerCase()

  const results = useMemo(() => {
    if (!term) return []
    const found: { deal: CrmDeal; stage: CrmStage }[] = []
    for (const stage of stages) {
      for (const deal of columns[stage.id] ?? []) {
        const haystack = `${deal.name} ${deal.email ?? ''} ${deal.phone ?? ''}`.toLowerCase()
        if (haystack.includes(term)) found.push({ deal, stage })
        if (found.length >= MAX_RESULTS) return found
      }
    }
    return found
  }, [term, stages, columns])

  function close() {
    setQ('')
    onOpenChange(false)
  }

  return (
    <Modal open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())} title="Search deals">
      <div className="px-5 pt-4 pb-5">
        <label className="relative block">
          <span className="sr-only">Name, email or phone</span>
          <Search
            size={16}
            strokeWidth={2}
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-3"
          />
          <input
            type="search"
            autoFocus
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Name, email or phone"
            className="field-input pl-9"
          />
        </label>

        <div className="mt-3 max-h-80 overflow-y-auto" aria-live="polite">
          {!term ? (
            <p className="py-6 text-center text-label text-ink-3">Type to search this pipeline.</p>
          ) : results.length === 0 ? (
            <p className="py-6 text-center text-label text-ink-3">No deal matches “{q.trim()}”.</p>
          ) : (
            <ul className="flex flex-col">
              {results.map(({ deal, stage }) => (
                <li key={deal.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onPick(deal)
                      close()
                    }}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-surface-hover"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body font-medium text-ink">{deal.name}</span>
                      <span className="block truncate text-caption text-ink-3">
                        {deal.email ?? deal.phone ?? 'No contact'}
                      </span>
                    </span>
                    <span className="shrink-0 rounded-md bg-surface-hover px-2 py-0.5 text-caption font-medium text-ink-2">
                      {stage.name}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  )
}
