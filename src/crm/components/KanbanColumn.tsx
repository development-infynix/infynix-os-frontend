import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { memo, useMemo } from 'react'
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
}

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
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id })
  const ids = useMemo(() => deals.map((deal) => deal.id), [deals])
  const count = total ?? deals.length
  const share = boardTotal ? Math.round((count / boardTotal) * 100) : 0
  const headingId = `stage-${stage.id}-heading`

  return (
    <section
      aria-labelledby={headingId}
      data-stage-column
      className="flex w-[18.5rem] shrink-0 snap-start flex-col gap-3 sm:min-h-0 sm:w-[19.5rem]"
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
        ref={setNodeRef}
        className={`flex max-h-[65dvh] min-h-72 flex-1 flex-col overflow-y-auto overscroll-contain rounded-xl border p-2 transition-colors duration-press [scrollbar-width:thin] sm:max-h-none sm:min-h-0 ${
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
          ) : (
            <div className="grid flex-1 place-items-center rounded-lg border border-dashed border-line-strong px-6 py-10 text-center">
              <div>
                <p className="text-label font-medium text-ink-2">No deals in this stage</p>
                <p className="mt-1 text-caption text-ink-3">Drag a deal here to move it.</p>
              </div>
            </div>
          )}
        </SortableContext>
      </div>
    </section>
  )
})
