import type { ReactNode } from 'react'
import { Button } from '@/components/Button'
import { IllustrationButton } from '@/components/IllustrationButton'

interface ReportsEmptyProps {
  title: string
  description: string
  /** Files a report for this day: the drawing and the button both do it. */
  onNew?: () => void
  newLabel?: string
  /** Another way forward, e.g. Clear filters. */
  extra?: ReactNode
}

/**
 * What the day panel shows when the day has no reports. Drawn rather than
 * written, in the same shape as the clients empty state: illustration, one
 * heading, one sentence, and the way forward when there is one.
 */
export function ReportsEmpty({ title, description, onNew, newLabel = 'File a report', extra }: ReportsEmptyProps) {
  return (
    <div className="grid flex-1 place-items-center px-5 py-8 text-center">
      <div className="max-w-xs">
        <IllustrationButton label={newLabel} onClick={onNew}>
          <ReportsIllustration showAdd={!!onNew} />
        </IllustrationButton>
        <h2 className="mt-4 text-title font-semibold tracking-title text-ink">{title}</h2>
        <p className="mx-auto mt-1.5 max-w-[34ch] text-body text-ink-2">{description}</p>
        {onNew && (
          <Button size="sm" variant="secondary" className="mt-4" onClick={onNew}>
            {newLabel}
          </Button>
        )}
        {extra && <div className="mt-4">{extra}</div>}
      </div>
    </div>
  )
}

/**
 * A stack of daily report sheets: the front one dated, with ticked points,
 * and a new one waiting to be filed. Drawn with the theme tokens, so it
 * follows light and dark without an asset.
 */
function ReportsIllustration({ showAdd }: { showAdd: boolean }) {
  return (
    <svg viewBox="0 0 240 120" aria-hidden className="mx-auto block h-auto w-full max-w-[220px]" fill="none">
      {/* Earlier days' sheets, fanned behind. */}
      <rect
        x="70"
        y="10"
        width="100"
        height="104"
        rx="10"
        fill="var(--surface)"
        stroke="var(--line-strong)"
        strokeWidth="1.5"
        transform="rotate(-8 120 62)"
      />
      <rect
        x="70"
        y="12"
        width="100"
        height="104"
        rx="10"
        fill="var(--surface)"
        stroke="var(--line-strong)"
        strokeWidth="1.5"
        transform="rotate(-4 120 62)"
      />

      {/* Today's sheet. */}
      <rect x="70" y="14" width="100" height="104" rx="10" fill="var(--surface)" stroke="var(--line-strong)" strokeWidth="1.5" />
      {/* Date header: a calendar tile and a title line. */}
      <rect x="82" y="26" width="18" height="18" rx="4" fill="var(--secondary-soft)" stroke="var(--secondary)" strokeWidth="1.5" />
      <path d="M82 31.5h18" stroke="var(--secondary)" strokeWidth="1.5" />
      <rect x="106" y="29" width="44" height="5" rx="2.5" fill="var(--line-strong)" />
      <rect x="106" y="38" width="28" height="4" rx="2" fill="var(--line-strong)" opacity="0.6" />
      <path d="M82 52h76" stroke="var(--line)" strokeWidth="1.5" />

      {/* Points: two ticked, one still open. */}
      <circle cx="87" cy="64" r="5" fill="var(--secondary)" />
      <path d="M84.6 64.2l1.7 1.7 3.2-3.4" stroke="var(--on-secondary)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="98" y="61.5" width="52" height="5" rx="2.5" fill="var(--line-strong)" />

      <circle cx="87" cy="80" r="5" fill="var(--secondary)" />
      <path d="M84.6 80.2l1.7 1.7 3.2-3.4" stroke="var(--on-secondary)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="98" y="77.5" width="40" height="5" rx="2.5" fill="var(--line-strong)" />

      <circle cx="87" cy="96" r="4.5" stroke="var(--line-strong)" strokeWidth="1.5" />
      <rect x="98" y="93.5" width="46" height="5" rx="2.5" fill="var(--line-strong)" opacity="0.6" />

      {/* The report still to be filed. */}
      {showAdd && (
        <>
          <circle cx="168" cy="20" r="13" fill="var(--secondary)" />
          <path d="M168 13.5v13M161.5 20h13" stroke="var(--on-secondary)" strokeWidth="2.6" strokeLinecap="round" />
        </>
      )}
    </svg>
  )
}
