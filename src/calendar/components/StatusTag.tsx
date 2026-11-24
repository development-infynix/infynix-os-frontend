import { STATUS_LABEL, type EffectiveStatus } from '../api'

/**
 * A status chip. Green means work is happening now (a live event, a task in
 * progress: DESIGN.md's Named State Rule); failed is muted red; open states
 * stay neutral; finished ones are outlined and quiet. `rejectCount` turns a
 * sent-back task into "Assigned (2)".
 */
export function StatusTag({ status, rejectCount = 0 }: { status: EffectiveStatus; rejectCount?: number }) {
  const tone =
    status === 'live' || status === 'progress'
      ? 'bg-secondary-soft text-secondary-text'
      : status === 'failed'
        ? 'bg-transparent text-danger/75 shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--danger)_45%,transparent)]'
        : status === 'upcoming' ||
            status === 'assigned' ||
            status === 'on_review' ||
            status === 'on_hold' ||
            status === 'request_cancelation'
          ? 'bg-surface-hover text-ink-2'
          : 'bg-transparent text-ink-3 shadow-[inset_0_0_0_1px_var(--line-strong)]'
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-micro font-semibold whitespace-nowrap ${tone}`}>
      {(status === 'live' || status === 'progress') && <span aria-hidden className="size-1.5 rounded-full bg-secondary" />}
      {STATUS_LABEL[status]}
      {status === 'assigned' && rejectCount > 0 && <span className="tabular-nums">({rejectCount})</span>}
    </span>
  )
}
