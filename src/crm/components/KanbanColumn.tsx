import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import type { CrmDeal, CrmStage } from '../types'
import { SortableKanbanCard } from './KanbanCard'

export interface KanbanColumnProps {
  stage: CrmStage
  /** 1-based position, shown as "01". */
  index: number
  deals: CrmDeal[]
  /** The stage's true count when only some cards are loaded; defaults to `deals.length`. */
  total?: number
  /** All deals on the board, for the share bar under the header. */
  boardTotal: number
  selectable: boolean
  selectedIds: ReadonlySet<string>
  highlightedId: string | null
  dragDisabled: boolean
  onToggleSelect: (id: string) => void
  onView?: (deal: CrmDeal) => void
  onOptions?: (deal: CrmDeal) => void
  /** Asks for this stage's next page; called as the reader nears the bottom of the loaded cards. */
  onLoadMore?: (stageId: string) => void
  loadingMore?: boolean
  /** The last page request failed: show Retry instead of loading again on its own. */
  loadMoreFailed?: boolean
}

/** Start the next page this far before the bottom, so scrolling rarely meets the loader. */
const LOAD_AHEAD = '0px 0px 600px 0px'

/** One stage: a header with its count and share, then its cards (a drop target even when empty). */
export const KanbanColumn = memo(function KanbanColumn({
  stage,
  index,
  deals,
  total,
  boardTotal,
  selectable,
  selectedIds,
  highlightedId,
  dragDisabled,
  onToggleSelect,
  onView,
  onOptions,
  onLoadMore,
  loadingMore = false,
  loadMoreFailed = false,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id })
  const ids = useMemo(() => deals.map((deal) => deal.id), [deals])
  const count = total ?? deals.length
  const hasMore = count > deals.length

  // The card list is both the drop target and the scroll box the next page watches.
  const [list, setList] = useState<HTMLDivElement | null>(null)
  const listRef = useCallback(
    (node: HTMLDivElement | null) => {
      setNodeRef(node)
      setList(node)
    },
    [setNodeRef],
  )
  const sentinel = useRef<HTMLDivElement>(null)
  const canLoad = hasMore && !loadingMore && !loadMoreFailed && Boolean(onLoadMore)

  // Re-created after every page (deals.length), so a column still short of the
  // bottom keeps loading until it fills or runs out.
  useEffect(() => {
    const target = sentinel.current
    if (!canLoad || !list || !target) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) onLoadMore?.(stage.id)
      },
      { root: list, rootMargin: LOAD_AHEAD },
    )
    observer.observe(target)
    return () => observer.disconnect()
  }, [canLoad, list, onLoadMore, stage.id, deals.length])
  const share = boardTotal ? Math.round((count / boardTotal) * 100) : 0
  const headingId = `stage-${stage.id}-heading`

  return (
    <section
      aria-labelledby={headingId}
      data-stage-column
      className="flex w-[18.5rem] shrink-0 snap-start flex-col gap-3 sm:h-full sm:min-h-0 sm:w-[19.5rem]"
    >
      <header className="rounded-xl bg-surface px-4 pt-3.5 pb-4 shadow-lift">
        <div className="flex items-center gap-2.5">
          <span className="rounded-md bg-surface-hover px-1.5 py-0.5 text-caption font-medium text-ink-2 tabular-nums">
            {String(index).padStart(2, '0')}
          </span>
          <h2 id={headingId} className="min-w-0 flex-1 truncate text-body font-semibold text-ink">
            {stage.name}
          </h2>
          <span
            className="min-w-6 rounded-md bg-surface-hover px-1.5 py-0.5 text-center text-caption font-semibold text-ink tabular-nums"
            aria-label={`${count} ${count === 1 ? 'deal' : 'deals'}`}
          >
            {count}
          </span>
        </div>
        <div
          className="mt-3 h-1 overflow-hidden rounded-full bg-line"
          role="meter"
          aria-label={`${share}% of this pipeline's deals`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={share}
        >
          <div
            className="h-full rounded-full bg-ink-3 transition-[width] duration-enter ease-out-expo"
            style={{ width: `${share}%` }}
          />
        </div>
      </header>

      <div
        ref={listRef}
        // Contain only the vertical axis: a sideways two-finger swipe over the cards must pass to the board.
        className={`flex max-h-[65dvh] min-h-72 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-y-contain rounded-xl border p-2 transition-colors duration-press [scrollbar-width:thin] sm:max-h-none sm:min-h-0 ${
          isOver ? 'border-line-strong bg-surface-hover/60' : 'border-line bg-surface/40'
        }`}
      >
        <SortableContext id={stage.id} items={ids} strategy={verticalListSortingStrategy}>
          {deals.length ? (
            <ul className="flex flex-col gap-2.5" aria-label={`${stage.name} deals`}>
              {deals.map((deal) => (
                <SortableKanbanCard
                  key={deal.id}
                  deal={deal}
                  disabled={dragDisabled}
                  selectable={selectable}
                  selected={selectedIds.has(deal.id)}
                  highlighted={highlightedId === deal.id}
                  onToggleSelect={onToggleSelect}
                  onView={onView}
                  onOptions={onOptions}
                />
              ))}
            </ul>
          ) : !hasMore ? (
            <div className="grid flex-1 place-items-center rounded-lg border border-dashed border-line-strong px-6 py-10 text-center">
              <div>
                <p className="text-label font-medium text-ink-2">No deals in this stage</p>
                <p className="mt-1 text-caption text-ink-3">Drag a deal here to move it.</p>
              </div>
            </div>
          ) : null}
          {hasMore && (
            <div ref={sentinel} className="flex justify-center py-4">
              {loadMoreFailed ? (
                <button
                  type="button"
                  onClick={() => onLoadMore?.(stage.id)}
                  className="btn btn-secondary h-7 px-2.5 text-label"
                >
                  Couldn’t load more. Retry
                </button>
              ) : (
                <span role="status" aria-live="polite">
                  <Loader2 size={18} strokeWidth={2} className="animate-spin text-ink-3" aria-hidden />
                  <span className="sr-only">{`Loading more ${stage.name} deals`}</span>
                </span>
              )}
            </div>
          )}
        </SortableContext>
      </div>
    </section>
  )
})
