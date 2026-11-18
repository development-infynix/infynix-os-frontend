import { IllustrationButton } from '@/components/IllustrationButton'

interface ClientsEmptyProps {
  title?: string
  description?: string
  /** Opens the add-client form. The drawing is the button that does it. */
  onAdd?: () => void
}

/**
 * What the clients panel shows before it has anything to show.
 *
 * Drawn rather than written: a stack of client cards with one still to be
 * added, in the same shape as the owner's Permissions panel — illustration,
 * one heading, one sentence. The panel renders this instead of the table, so
 * there are no column headers or empty rows behind it.
 */
export function ClientsEmpty({
  title = 'No clients yet',
  description = 'Add your first client, or import a spreadsheet of contacts, to start your directory.',
  onAdd,
}: ClientsEmptyProps) {
  return (
    <div className="grid flex-1 place-items-center px-6 py-10 text-center">
      <div className="max-w-sm">
        <IllustrationButton label="Add a client" onClick={onAdd}>
          <ClientsIllustration />
        </IllustrationButton>
        <h2 className="mt-4 text-title font-semibold tracking-title text-ink">{title}</h2>
        <p className="mx-auto mt-1.5 max-w-[38ch] text-body text-ink-2">{description}</p>
      </div>
    </div>
  )
}

/**
 * Three client cards, the front one filled in and one more waiting to be added.
 * Drawn with the theme tokens, so it follows light and dark without an asset.
 */
function ClientsIllustration() {
  return (
    <svg
      viewBox="0 0 240 120"
      aria-hidden
      className="mx-auto block h-auto w-full max-w-[220px]"
      fill="none"
    >
      {/* The two cards behind: the existing directory. */}
      <rect
        x="54"
        y="16"
        width="132"
        height="78"
        rx="12"
        fill="var(--surface)"
        stroke="var(--line-strong)"
        strokeWidth="1.5"
        transform="rotate(-7 120 55)"
      />
      <rect
        x="54"
        y="20"
        width="132"
        height="78"
        rx="12"
        fill="var(--surface)"
        stroke="var(--line-strong)"
        strokeWidth="1.5"
        transform="rotate(-3.5 120 55)"
      />
      {/* The front card: one client, with a photo well and two lines of detail. */}
      <rect
        x="54"
        y="26"
        width="132"
        height="78"
        rx="12"
        fill="var(--surface)"
        stroke="var(--line-strong)"
        strokeWidth="1.5"
      />
      <circle cx="86" cy="60" r="14" fill="var(--secondary-soft)" stroke="var(--secondary)" strokeWidth="1.5" />
      <circle cx="86" cy="55" r="4.6" fill="var(--secondary)" opacity="0.85" />
      <path d="M78.5 68.5a7.5 7.5 0 0 1 15 0z" fill="var(--secondary)" opacity="0.85" />
      <rect x="110" y="48" width="56" height="6" rx="3" fill="var(--line-strong)" />
      <rect x="110" y="60" width="38" height="6" rx="3" fill="var(--line-strong)" opacity="0.75" />
      {/* The card still to be added. */}
      <circle cx="182" cy="34" r="13" fill="var(--secondary)" />
      <path
        d="M182 27.5v13M175.5 34h13"
        stroke="var(--on-secondary)"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  )
}
