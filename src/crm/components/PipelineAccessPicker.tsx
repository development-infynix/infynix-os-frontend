import { Link } from '@tanstack/react-router'
import { Check, Minus } from 'lucide-react'
import { Button } from '@/components/Button'
import { Loader } from '@/components/Loader'
import { initials } from '@/lib/auth'
import type { CrmEligibleUser } from '@/lib/crm'

interface PipelineAccessPickerProps {
  /** Undefined while loading. */
  users: CrmEligibleUser[] | undefined
  loading: boolean
  failed: boolean
  onRetry: () => void
  /** People unticked by hand. Everyone else is on the access list. */
  excluded: ReadonlySet<string>
  onToggle: (id: string) => void
  onToggleAll: () => void
  /** Shown when the signed-in manager unticks themselves. */
  selfWarning: string | null
  /** Owners can open Admin › Users to grant the CRM menu; managers can't. */
  canManagePermissions: boolean
}

/**
 * Step 3 of the create-pipeline wizard: who may see and work in the new
 * pipeline. Lists everyone with the CRM menu (owners see every pipeline, so
 * they aren't listed); all of them start ticked.
 */
export function PipelineAccessPicker({
  users,
  loading,
  failed,
  onRetry,
  excluded,
  onToggle,
  onToggleAll,
  selfWarning,
  canManagePermissions,
}: PipelineAccessPickerProps) {
  const list = users ?? []
  const chosen = list.filter((user) => !excluded.has(user.id)).length
  const allChosen = list.length > 0 && chosen === list.length

  return (
    <section aria-labelledby="pipeline-access-heading">
      <div className="flex items-end justify-between gap-3 px-1">
        <div>
          <h3 id="pipeline-access-heading" className="text-body font-semibold text-ink">
            Pipeline access
          </h3>
          <p className="mt-0.5 text-label text-ink-2">
            Who can see and work in this pipeline. Owners always can.
          </p>
        </div>
        {list.length > 0 && (
          <span className="shrink-0 text-caption text-ink-3 tabular-nums">
            {chosen} of {list.length}
          </span>
        )}
      </div>

      <div className="mt-3 overflow-hidden rounded-xl bg-surface ring-1 ring-line">
        {loading ? (
          <div className="grid place-items-center py-8">
            <Loader label="Loading people" />
          </div>
        ) : failed ? (
          <div className="px-4 py-6 text-center">
            <p className="text-label text-ink-2">Couldn’t load the people with CRM access.</p>
            <Button size="sm" variant="secondary" className="mt-3" onClick={onRetry}>
              Try again
            </Button>
          </div>
        ) : list.length === 0 ? (
          <div className="px-6 py-8 text-center">
            <NoEligibleUsersIllustration />
            <p className="mt-4 text-body font-semibold text-ink">No one to give access to yet</p>
            <p className="mx-auto mt-1 max-w-[34ch] text-label text-ink-2">
              {canManagePermissions
                ? 'Only people with the CRM menu can be added to a pipeline. Give it to your team in their permissions.'
                : 'Only people with the CRM menu can be added to a pipeline. Ask the owner to give it to your team.'}
            </p>
            {canManagePermissions && (
              <Link to="/admin/users" className="btn btn-secondary mt-4 h-8 px-3 text-label">
                Manage CRM access
              </Link>
            )}
          </div>
        ) : (
          <>
            <label className="flex cursor-pointer items-center gap-3 border-b border-line px-3 py-2.5 hover:bg-surface-hover/50">
              <Tick
                checked={allChosen}
                mixed={!allChosen && chosen > 0}
                onChange={onToggleAll}
                label="Select everyone"
              />
              <span className="text-label font-medium text-ink">Select all</span>
            </label>
            <ul aria-label="People with CRM access" className="max-h-80 overflow-y-auto">
              {list.map((user) => {
                const checked = !excluded.has(user.id)
                return (
                  <li key={user.id} className="border-b border-line last:border-b-0">
                    <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-surface-hover/50">
                      <Tick checked={checked} onChange={() => onToggle(user.id)} label={user.fullName} />
                      <span
                        aria-hidden
                        className="grid size-8 shrink-0 place-items-center rounded-md bg-secondary text-caption font-semibold text-on-secondary"
                      >
                        {initials(user.fullName)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-body font-medium text-ink">{user.fullName}</span>
                        <span className="block truncate text-caption text-ink-3">{user.email}</span>
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </div>

      {selfWarning && (
        <p role="status" className="mt-2 px-1 text-caption text-danger">
          {selfWarning}
        </p>
      )}
    </section>
  )
}

/** A native checkbox (keyboard and form semantics), drawn as the app's square tick. */
function Tick({
  checked,
  mixed = false,
  onChange,
  label,
}: {
  checked: boolean
  mixed?: boolean
  onChange: () => void
  label: string
}) {
  return (
    <span className="relative grid size-5 shrink-0 place-items-center">
      <input
        type="checkbox"
        checked={checked}
        ref={(node) => {
          if (node) node.indeterminate = mixed
        }}
        onChange={onChange}
        aria-label={label}
        className="peer absolute inset-0 m-0 cursor-pointer appearance-none rounded-md border border-line-strong bg-surface transition-colors checked:border-secondary checked:bg-secondary indeterminate:border-secondary indeterminate:bg-secondary"
      />
      {mixed ? (
        <Minus size={12} strokeWidth={3} aria-hidden className="pointer-events-none relative text-on-secondary" />
      ) : (
        <Check
          size={12}
          strokeWidth={3}
          aria-hidden
          className={`pointer-events-none relative text-on-secondary ${checked ? '' : 'invisible'}`}
        />
      )}
    </span>
  )
}

/**
 * "No one on the list yet": the owner-permissions ring, but every seat empty
 * and a muted person waiting in the middle. Drawn with the theme tokens so it
 * follows light and dark.
 */
function NoEligibleUsersIllustration() {
  const cx = 120
  const cy = 50
  const ring = 40
  const seats = Array.from({ length: 8 }, (_, index) => {
    const angle = (index * Math.PI) / 4
    return { x: cx + Math.cos(angle) * ring, y: cy + Math.sin(angle) * ring }
  })

  return (
    <svg viewBox="0 0 240 100" aria-hidden className="mx-auto block h-auto w-full max-w-[200px]" fill="none">
      <circle cx={cx} cy={cy} r="34" fill="var(--surface-hover)" />
      <circle
        cx={cx}
        cy={cy}
        r={ring}
        stroke="var(--line-strong)"
        strokeWidth="1.5"
        strokeDasharray="3 5"
        strokeLinecap="round"
      />
      {seats.map((seat) => (
        <circle
          key={`${seat.x}-${seat.y}`}
          cx={seat.x}
          cy={seat.y}
          r="3"
          fill="var(--surface)"
          stroke="var(--line-strong)"
          strokeWidth="1.5"
        />
      ))}
      {/* The person: head and shoulders, outlined, nobody granted yet. */}
      <circle cx={cx} cy="41" r="8" fill="var(--surface)" stroke="var(--ink-3)" strokeWidth="2" />
      <path
        d="M104 70c0-9 7-15 16-15s16 6 16 15"
        fill="var(--surface)"
        stroke="var(--ink-3)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* A small plus badge: someone can be added once they have the CRM menu. */}
      <circle cx="141" cy="31" r="8" fill="var(--secondary-soft)" stroke="var(--surface)" strokeWidth="2" />
      <path d="M141 27.5v7M137.5 31h7" stroke="var(--secondary-text)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
