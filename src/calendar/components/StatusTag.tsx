import { STATUS_LABEL, type EffectiveStatus } from '../api'

/**
 * Upcoming / Live now / Ended / Cancelled. Live takes the green wash (green
 * means live, DESIGN.md's Named State Rule); the rest stay neutral or muted.
 */
export function StatusTag({ status }: { status: EffectiveStatus }) {
  const tone =
    status === 'live'
      ? 'bg-secondary-soft text-secondary-text'
      : status === 'upcoming'
        ? 'bg-surface-hover text-ink-2'
        : 'bg-transparent text-ink-3 shadow-[inset_0_0_0_1px_var(--line-strong)]'
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-micro font-semibold ${tone}`}>
      {status === 'live' && <span aria-hidden className="size-1.5 rounded-full bg-secondary" />}
      {STATUS_LABEL[status]}
    </span>
  )
}
