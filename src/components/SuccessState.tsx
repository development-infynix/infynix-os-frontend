import type { ReactNode } from 'react'

/**
 * What a finished bulk run shows instead of a full progress bar: a small
 * illustration, a title and one line per outcome. Used by the client import,
 * Move to CRM and Add deal › Existing import.
 */
export function SuccessState({
  title,
  children,
  action,
}: {
  title: string
  children?: ReactNode
  /** Shown under the text, e.g. the primary Done button. */
  action?: ReactNode
}) {
  return (
    // my-auto: centred vertically when the parent is a taller flex column (a drawer body); no effect in a modal.
    <div className="my-auto flex flex-col items-center px-2 pt-2 pb-3 text-center" role="status">
      <SuccessIllustration />
      <p className="mt-3 text-title font-semibold tracking-title text-ink">{title}</p>
      {children && <div className="mt-1.5 flex flex-col gap-0.5 text-body text-ink-2 tabular-nums">{children}</div>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}

/** Two sheets of paper with a green check badge: done, filed. Drawn in theme colours, so it follows dark mode. */
export function SuccessIllustration() {
  return (
    <svg viewBox="0 0 160 112" aria-hidden className="block h-auto w-36" fill="none">
      {/* Soft ground shadow. */}
      <ellipse cx="80" cy="102" rx="46" ry="5" fill="var(--line)" opacity="0.7" />
      {/* Back sheet, slightly turned. */}
      <g transform="rotate(-7 66 56)">
        <rect x="40" y="18" width="52" height="68" rx="6" fill="var(--canvas)" stroke="var(--line-strong)" strokeWidth="1.5" />
      </g>
      {/* Front sheet with written lines. */}
      <rect x="56" y="14" width="54" height="72" rx="6" fill="var(--surface)" stroke="var(--line-strong)" strokeWidth="1.5" />
      <rect x="64" y="25" width="26" height="4" rx="2" fill="var(--ink-3)" opacity="0.55" />
      <rect x="64" y="35" width="38" height="3" rx="1.5" fill="var(--line-strong)" />
      <rect x="64" y="43" width="34" height="3" rx="1.5" fill="var(--line-strong)" />
      <rect x="64" y="51" width="38" height="3" rx="1.5" fill="var(--line-strong)" />
      <rect x="64" y="59" width="22" height="3" rx="1.5" fill="var(--line-strong)" />
      {/* The check badge. */}
      <circle cx="108" cy="76" r="17" fill="var(--secondary)" />
      <circle cx="108" cy="76" r="17" stroke="var(--secondary-soft)" strokeWidth="3" opacity="0.6" />
      <path
        d="M100.5 76.5l5 5 10-10.5"
        stroke="var(--on-secondary)"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* A few quiet sparkles. */}
      <path d="M128 40v8M124 44h8" stroke="var(--secondary)" strokeWidth="2" strokeLinecap="round" opacity="0.55" />
      <circle cx="34" cy="38" r="2.5" fill="var(--secondary)" opacity="0.35" />
      <circle cx="132" cy="60" r="2" fill="var(--ink-3)" opacity="0.35" />
      <circle cx="30" cy="70" r="1.75" fill="var(--ink-3)" opacity="0.3" />
    </svg>
  )
}
