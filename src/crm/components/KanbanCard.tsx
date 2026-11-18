import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Check, ChevronsRight, Mail, Phone, SlidersHorizontal } from 'lucide-react'
import { memo, type KeyboardEvent, type ReactNode } from 'react'
import type { CrmDeal } from '../types'

const addedFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' })

export interface KanbanCardProps {
  deal: CrmDeal
  /** Select mode: a select circle replaces the options button. */
  selectable?: boolean
  selected?: boolean
  onToggleSelect?: (id: string) => void
  onView?: (deal: CrmDeal) => void
  onOptions?: (deal: CrmDeal) => void
  /** Flash after a search result jumps to this card. */
  highlighted?: boolean
  /** The floating copy under the pointer while dragging. */
  overlay?: boolean
}

/**
 * Keys pressed on a button inside the card must not reach the card's drag
 * listeners, or Enter on "View" would pick the card up instead.
 */
const keepKeys = (event: KeyboardEvent) => event.stopPropagation()

/** One deal on the board: client name, contact details, added date, View. */
export const KanbanCard = memo(function KanbanCard({
  deal,
  selectable = false,
  selected = false,
  onToggleSelect,
  onView,
  onOptions,
  highlighted = false,
  overlay = false,
}: KanbanCardProps) {
  return (
    <article
      aria-label={deal.name}
      className={`rounded-xl bg-surface p-4 transition-shadow duration-enter ease-out-expo ${
        overlay ? 'rotate-[1.5deg] cursor-grabbing shadow-dialog' : 'shadow-lift'
      } ${selected || highlighted ? 'ring-2 ring-secondary' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 truncate text-body font-semibold text-ink">{deal.name}</h3>
        {selectable ? (
          <button
            type="button"
            role="checkbox"
            aria-checked={selected}
            aria-label={`Select ${deal.name}`}
            onClick={() => onToggleSelect?.(deal.id)}
            onKeyDown={keepKeys}
            className={`grid size-5 shrink-0 place-items-center rounded-full border transition-colors ${
              selected
                ? 'border-secondary bg-secondary text-on-secondary'
                : 'border-line-strong text-transparent hover:border-ink-3'
            }`}
          >
            <Check size={12} strokeWidth={3} aria-hidden />
          </button>
        ) : (
          <button
            type="button"
            aria-label={`Options for ${deal.name}`}
            title="Options"
            onClick={() => onOptions?.(deal)}
            onKeyDown={keepKeys}
            className="-mt-1 -mr-1 grid size-7 shrink-0 place-items-center rounded-md text-ink-3 transition-colors hover:bg-surface-hover hover:text-ink"
          >
            <SlidersHorizontal size={15} strokeWidth={2} aria-hidden />
          </button>
        )}
      </div>

      <dl className="mt-2 flex flex-col gap-1">
        <ContactRow icon={<Phone size={14} strokeWidth={2} aria-hidden />} label="Phone">
          {deal.phone ?? <span className="text-ink-3">No phone</span>}
        </ContactRow>
        <ContactRow icon={<Mail size={14} strokeWidth={2} aria-hidden />} label="Email">
          {deal.email ?? <span className="text-ink-3">No email</span>}
        </ContactRow>
      </dl>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3">
        <p className="text-caption text-ink-3 tabular-nums">Added {addedFormat.format(new Date(deal.addedAt))}</p>
        <button
          type="button"
          onClick={() => onView?.(deal)}
          onKeyDown={keepKeys}
          className="btn btn-secondary h-7 gap-1 px-2.5 text-label"
        >
          View
          <ChevronsRight size={14} strokeWidth={2} aria-hidden />
        </button>
      </div>
    </article>
  )
})

function ContactRow({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-2 text-label text-ink-2">
      <dt className="shrink-0 text-ink-3">
        {icon}
        <span className="sr-only">{label}</span>
      </dt>
      <dd className="min-w-0 truncate">{children}</dd>
    </div>
  )
}

/**
 * A KanbanCard the board can drag. The whole card is the handle: pointer drags
 * start after a few pixels (so clicks on its buttons still work), and
 * Space/Enter on the focused card picks it up for keyboard moves.
 */
export function SortableKanbanCard({ disabled = false, ...props }: KanbanCardProps & { disabled?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.deal.id,
    disabled,
  })

  return (
    <li
      ref={setNodeRef}
      id={`deal-${props.deal.id}`}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`rounded-xl ${
        disabled ? '' : 'cursor-grab touch-manipulation'
      } ${isDragging ? 'opacity-40' : ''}`}
      {...attributes}
      {...listeners}
      aria-roledescription="Deal card"
    >
      <KanbanCard {...props} />
    </li>
  )
}
