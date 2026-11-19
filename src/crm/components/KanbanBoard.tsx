import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core'
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import type { BoardColumns, CrmDeal, CrmStage } from '../types'
import { KanbanCard } from './KanbanCard'
import { KanbanColumn } from './KanbanColumn'

export interface BoardScrollState {
  canPrev: boolean
  canNext: boolean
}

export interface KanbanBoardHandle {
  /** Scrolls one column left (-1) or right (1). */
  scrollByColumn: (direction: -1 | 1) => void
}

export interface KanbanBoardProps {
  stages: CrmStage[]
  columns: BoardColumns
  onColumnsChange: (next: BoardColumns) => void
  /** Every stage's true count, so a capped column still shows its total. */
  totals?: Record<string, number>
  /** Persists a drop: the deal's new stage and index within it. */
  onMove?: (dealId: string, stageId: string, position: number) => void
  selectable?: boolean
  selectedIds?: ReadonlySet<string>
  onToggleSelect?: (id: string) => void
  highlightedId?: string | null
  /** Turns dragging off, e.g. in select mode. */
  dragDisabled?: boolean
  onView?: (deal: CrmDeal) => void
  onOptions?: (deal: CrmDeal) => void
  onScrollStateChange?: (state: BoardScrollState) => void
}

const NO_SELECTION: ReadonlySet<string> = new Set()
const COLUMN_GAP = 16 // gap-4
const noop = () => {}

/**
 * The pipeline board: one column per stage, cards sortable inside a column and
 * draggable between columns (mouse, touch after a short press, or keyboard:
 * Space to pick up, arrows to move, Space to drop, Escape to cancel).
 */
export const KanbanBoard = forwardRef<KanbanBoardHandle, KanbanBoardProps>(function KanbanBoard(
  {
    stages,
    columns,
    onColumnsChange,
    totals,
    onMove,
    selectable = false,
    selectedIds = NO_SELECTION,
    onToggleSelect,
    highlightedId = null,
    dragDisabled = false,
    onView,
    onOptions,
    onScrollStateChange,
  },
  ref,
) {
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null)
  /** The board before the drag, restored if it's cancelled. */
  const snapshot = useRef<BoardColumns | null>(null)
  /** Where the card started, so a drop that changed nothing isn't saved. */
  const dragOrigin = useRef<{ stageId: string; index: number } | null>(null)
  const scroller = useRef<HTMLDivElement>(null)

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // A short press before dragging, so a swipe still scrolls the board on phones.
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const boardTotal = useMemo(
    () =>
      totals
        ? Object.values(totals).reduce((sum, count) => sum + count, 0)
        : stages.reduce((sum, stage) => sum + (columns[stage.id]?.length ?? 0), 0),
    [stages, columns, totals],
  )

  /** The stage a card or column id belongs to. */
  const findStage = useCallback(
    (id: UniqueIdentifier | undefined): string | null => {
      if (id === undefined) return null
      const key = String(id)
      if (key in columns) return key
      return stages.find((stage) => columns[stage.id]?.some((deal) => deal.id === key))?.id ?? null
    },
    [columns, stages],
  )

  const findDeal = useCallback(
    (id: UniqueIdentifier | null): CrmDeal | null => {
      if (id === null) return null
      for (const stage of stages) {
        const deal = columns[stage.id]?.find((item) => item.id === String(id))
        if (deal) return deal
      }
      return null
    },
    [columns, stages],
  )

  const stageName = (id: string | null) => stages.find((stage) => stage.id === id)?.name ?? 'the board'

  function onDragStart({ active }: DragStartEvent) {
    snapshot.current = columns
    const stageId = findStage(active.id)
    const index = stageId
      ? (columns[stageId] ?? []).findIndex((deal) => deal.id === String(active.id))
      : -1
    dragOrigin.current = stageId && index >= 0 ? { stageId, index } : null
    setActiveId(active.id)
  }

  /** Crossing into another column moves the card there right away, so it opens a gap. */
  function onDragOver({ active, over }: DragOverEvent) {
    const from = findStage(active.id)
    const to = findStage(over?.id)
    if (!from || !to || from === to || !over) return

    const source = columns[from] ?? []
    const target = columns[to] ?? []
    const moving = source.find((deal) => deal.id === String(active.id))
    if (!moving) return

    let index = target.length
    const overIndex = target.findIndex((deal) => deal.id === String(over.id))
    if (overIndex >= 0) {
      const activeTop = active.rect.current.translated?.top ?? 0
      const below = activeTop > over.rect.top + over.rect.height / 2
      index = overIndex + (below ? 1 : 0)
    }

    onColumnsChange({
      ...columns,
      [from]: source.filter((deal) => deal.id !== moving.id),
      [to]: [...target.slice(0, index), moving, ...target.slice(index)],
    })
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    const origin = dragOrigin.current
    const before = snapshot.current
    dragOrigin.current = null
    snapshot.current = null
    setActiveId(null)

    // Dropped outside a column: put it back where it started.
    if (!over) {
      if (before) onColumnsChange(before)
      return
    }

    let next = columns
    const from = findStage(active.id)
    const to = findStage(over.id)

    if (from && to && from !== to) {
      // Usually onDragOver has moved it already; this covers a drop that skipped it.
      const source = columns[from] ?? []
      const target = columns[to] ?? []
      const moving = source.find((deal) => deal.id === String(active.id))
      if (moving) {
        const without = target.filter((deal) => deal.id !== moving.id)
        const overIndex = without.findIndex((deal) => deal.id === String(over.id))
        const index = overIndex >= 0 ? overIndex : without.length
        next = {
          ...columns,
          [from]: source.filter((deal) => deal.id !== moving.id),
          [to]: [...without.slice(0, index), moving, ...without.slice(index)],
        }
        onColumnsChange(next)
      }
    } else if (from && to && from === to) {
      const list = columns[from] ?? []
      const oldIndex = list.findIndex((deal) => deal.id === String(active.id))
      const newIndex = list.findIndex((deal) => deal.id === String(over.id))
      if (oldIndex >= 0 && newIndex >= 0 && oldIndex !== newIndex) {
        next = { ...columns, [from]: arrayMove(list, oldIndex, newIndex) }
        onColumnsChange(next)
      }
    }

    const finalStage = stages.find((stage) =>
      (next[stage.id] ?? []).some((deal) => deal.id === String(active.id)),
    )?.id
    const finalIndex = finalStage
      ? (next[finalStage] ?? []).findIndex((deal) => deal.id === String(active.id))
      : -1
    if (
      origin &&
      finalStage &&
      finalIndex >= 0 &&
      (finalStage !== origin.stageId || finalIndex !== origin.index)
    ) {
      onMove?.(String(active.id), finalStage, finalIndex)
    }
  }

  function onDragCancel() {
    if (snapshot.current) onColumnsChange(snapshot.current)
    snapshot.current = null
    dragOrigin.current = null
    setActiveId(null)
  }

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${findDeal(active.id)?.name ?? 'deal'} in ${stageName(findStage(active.id))}.`,
    onDragOver: ({ active, over }) =>
      over ? `${findDeal(active.id)?.name ?? 'Deal'} is over ${stageName(findStage(over.id))}.` : undefined,
    onDragEnd: ({ active, over }) =>
      over
        ? `Dropped ${findDeal(active.id)?.name ?? 'deal'} in ${stageName(findStage(over.id))}.`
        : `Dropped ${findDeal(active.id)?.name ?? 'deal'}.`,
    onDragCancel: ({ active }) => `Cancelled. ${findDeal(active.id)?.name ?? 'Deal'} is back where it was.`,
  }

  // Prev / next arrows: scroll by one column and report whether either end is reached.
  const reportScroll = useCallback(() => {
    const el = scroller.current
    if (!el || !onScrollStateChange) return
    onScrollStateChange({
      canPrev: el.scrollLeft > 1,
      canNext: el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
    })
  }, [onScrollStateChange])

  useEffect(() => {
    const el = scroller.current
    if (!el) return
    reportScroll()
    el.addEventListener('scroll', reportScroll, { passive: true })
    const observer = new ResizeObserver(reportScroll)
    observer.observe(el)
    return () => {
      el.removeEventListener('scroll', reportScroll)
      observer.disconnect()
    }
  }, [reportScroll, stages.length])

  useImperativeHandle(
    ref,
    () => ({
      scrollByColumn(direction) {
        const el = scroller.current
        const column = el?.querySelector<HTMLElement>('[data-stage-column]')
        if (!el || !column) return
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        el.scrollBy({ left: direction * (column.offsetWidth + COLUMN_GAP), behavior: reduce ? 'auto' : 'smooth' })
      },
    }),
    [],
  )

  const activeDeal = findDeal(activeId)

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable:
            'To move a deal, press Space or Enter to pick it up. Use the arrow keys to move it between and within stages, Space or Enter to drop it, or Escape to cancel.',
        },
      }}
    >
      <div
        ref={scroller}
        role="region"
        aria-label="Pipeline board"
        className="-mx-5 flex gap-4 overflow-x-auto px-5 pb-3 [scrollbar-width:thin] max-sm:snap-x max-sm:snap-mandatory max-sm:scroll-px-5 sm:-mx-10 sm:min-h-0 sm:flex-1 sm:px-10"
      >
        {stages.map((stage, index) => (
          <KanbanColumn
            key={stage.id}
            stage={stage}
            index={index + 1}
            deals={columns[stage.id] ?? []}
            total={totals?.[stage.id]}
            boardTotal={boardTotal}
            selectable={selectable}
            selectedIds={selectedIds}
            highlightedId={highlightedId}
            dragDisabled={dragDisabled}
            onToggleSelect={onToggleSelect ?? noop}
            onView={onView}
            onOptions={onOptions}
          />
        ))}
      </div>

      <DragOverlay>{activeDeal ? <KanbanCard deal={activeDeal} overlay /> : null}</DragOverlay>
    </DndContext>
  )
})
