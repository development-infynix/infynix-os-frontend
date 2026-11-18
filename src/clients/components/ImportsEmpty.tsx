import { IllustrationButton } from '@/components/IllustrationButton'

interface ImportsEmptyProps {
  title?: string
  description?: string
  /** Opens the spreadsheet import. The drawing is the button that does it. */
  onImport?: () => void
}

/**
 * What the Imports tab shows before the first spreadsheet has been brought in.
 *
 * Its own illustration, not the clients one: a sheet of rows with the data
 * arriving at its corner. Same shape as the other empty states — drawing,
 * heading, one sentence — so the panel reads the same on both tabs.
 */
export function ImportsEmpty({
  title = 'No imports yet',
  description = 'Import a spreadsheet of contacts and every batch lands here, with a record of the rows it added and skipped.',
  onImport,
}: ImportsEmptyProps) {
  return (
    <div className="grid min-h-64 flex-1 place-items-center px-6 py-10 text-center">
      <div className="max-w-sm">
        <IllustrationButton label="Import clients from a spreadsheet" onClick={onImport}>
          <ImportsIllustration />
        </IllustrationButton>
        <h2 className="mt-4 text-title font-semibold tracking-title text-ink">{title}</h2>
        <p className="mx-auto mt-1.5 max-w-[38ch] text-body text-ink-2">{description}</p>
      </div>
    </div>
  )
}

/**
 * A spreadsheet with a grid of rows and an arrow badge bringing data in.
 * Drawn with the theme tokens, so it follows light and dark without an asset.
 */
function ImportsIllustration() {
  return (
    <svg
      viewBox="0 0 240 120"
      aria-hidden
      className="mx-auto block h-auto w-full max-w-[220px]"
      fill="none"
    >
      {/* The sheet, with a header band above the grid. */}
      <rect
        x="60"
        y="14"
        width="120"
        height="92"
        rx="10"
        fill="var(--surface)"
        stroke="var(--line-strong)"
        strokeWidth="1.5"
      />
      <path d="M60 38h120" stroke="var(--line-strong)" strokeWidth="1.5" />
      <rect x="72" y="24" width="30" height="6" rx="3" fill="var(--line-strong)" />
      <rect x="110" y="24" width="20" height="6" rx="3" fill="var(--line-strong)" opacity="0.6" />
      {/* The grid: three columns by three rows. */}
      <path
        d="M100 38v68M140 38v68M60 60h120M60 82h120"
        stroke="var(--line-strong)"
        strokeWidth="1"
        opacity="0.8"
      />
      {/* Filled cells: the rows that came in. */}
      <rect x="70" y="46" width="20" height="6" rx="3" fill="var(--secondary-soft)" />
      <rect x="110" y="46" width="20" height="6" rx="3" fill="var(--secondary-soft)" />
      <rect x="70" y="68" width="20" height="6" rx="3" fill="var(--secondary-soft)" />
      <rect x="150" y="90" width="20" height="6" rx="3" fill="var(--secondary-soft)" />
      {/* The data arriving. */}
      <circle cx="180" cy="22" r="13" fill="var(--secondary)" />
      <path
        d="M180 15.5v9M175.5 20l4.5 4.5 4.5-4.5"
        stroke="var(--on-secondary)"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
