import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, EyeOff, Pencil, Trash2, UserCheck, UserX, X } from 'lucide-react'
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { AlertDialog } from '@/components/Alert'
import { Button } from '@/components/Button'
import { FormError, FormField } from '@/components/FormField'
import { Loader } from '@/components/Loader'
import { memberAccessQuery, setMemberAccess, type MemberAccess } from '@/lib/access'
import { ApiError } from '@/lib/api'
import { changeMyPassword, ROLE_LABEL, sessionQuery, updateMyName, type MemberRole } from '@/lib/auth'
import { timeAgo } from '@/lib/format'
import { MEMBERS_KEY, removeMember, setMemberPassword, updateMember, type Member } from '@/lib/members'
import { PASSWORD_HINT, strongPassword } from '@/lib/password-rules'

interface UserDetailsDrawerProps {
  /** The user to show; `null` closes the drawer. */
  member: Member | null
  onClose: () => void
  /** Roles the owner may give (manager, staff). */
  roles: MemberRole[]
  /** The signed-in owner looking at their own row: no role change, deactivate or delete. */
  isSelf: boolean
}

const dateFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

const failure = (error: unknown, fallback: string) =>
  error instanceof ApiError && error.status !== 500 ? error.message : fallback

/**
 * A member in a right-side sheet. The view switches between Details and
 * Permissions tabs; Edit replaces the active panel with a form. Close is
 * top-right, and destructive actions stay pinned at the bottom.
 */
export function UserDetailsDrawer({ member, onClose, roles, isSelf }: UserDetailsDrawerProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'details' | 'permissions'>('details')
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const open = !!member
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      // Start on the panel, not the Close button, so opening it doesn't
      // light up a focus ring; Tab still reaches every control.
      dialog.focus()
    } else if (!open && dialog.open) dialog.close()
  }, [open])

  const refresh = () => queryClient.invalidateQueries({ queryKey: MEMBERS_KEY })

  function close() {
    if (busy) return
    setEditing(false)
    setError(null)
    onClose()
  }

  async function toggleAccess() {
    if (!member) return
    setBusy(true)
    setError(null)
    try {
      await updateMember(member.id, { isActive: !member.isActive })
      await refresh()
    } catch (e) {
      setError(failure(e, 'Couldn’t change their access. Try again.'))
    } finally {
      setBusy(false)
    }
  }

  const detailsTabId = `${titleId}-details-tab`
  const permissionsTabId = `${titleId}-permissions-tab`
  const detailsPanelId = `${titleId}-details-panel`
  const permissionsPanelId = `${titleId}-permissions-panel`

  function onTabKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (busy || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const next =
      event.key === 'Home'
        ? 'details'
        : event.key === 'End'
          ? 'permissions'
          : activeTab === 'details'
            ? 'permissions'
            : 'details'
    setActiveTab(next)
    document.getElementById(next === 'details' ? detailsTabId : permissionsTabId)?.focus()
  }

  return (
    <>
      <dialog
        ref={ref}
        aria-labelledby={titleId}
        onCancel={(e) => {
          e.preventDefault()
          close()
        }}
        onKeyDown={(e) => e.key === 'Escape' && e.stopPropagation()}
        onClick={(e) => e.target === e.currentTarget && close()}
        tabIndex={-1}
        className="app-drawer w-full max-w-sheet border-0 bg-surface p-0 text-ink shadow-dialog outline-none"
      >
        {member && (
          <div className="flex h-full flex-col">
            <h2 id={titleId} className="sr-only">
              {member.fullName}
            </h2>
            {/* Header: the two views as a segmented tab control, Close at the right. */}
            <div className="flex items-center gap-2 border-b border-line px-4 py-3.5">
              {editing ? (
                <span className="flex-1" />
              ) : (
                <div
                  role="tablist"
                  aria-label="Member sections"
                  onKeyDown={onTabKeyDown}
                  className="mr-auto flex shrink-0 gap-1 rounded-xl bg-canvas p-1.5 shadow-well"
                >
                  <TabButton
                    id={detailsTabId}
                    controls={detailsPanelId}
                    selected={activeTab === 'details'}
                    onSelect={() => {
                      if (!busy) setActiveTab('details')
                    }}
                  >
                    Details
                  </TabButton>
                  <TabButton
                    id={permissionsTabId}
                    controls={permissionsPanelId}
                    selected={activeTab === 'permissions'}
                    onSelect={() => {
                      if (!busy) setActiveTab('permissions')
                    }}
                  >
                    Permissions
                  </TabButton>
                </div>
              )}
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="grid size-9 shrink-0 place-items-center rounded-md text-ink-3 hover:bg-surface-hover hover:text-ink"
              >
                <X size={18} strokeWidth={1.9} />
              </button>
            </div>

            {editing && isSelf ? (
              <EditSelfForm
                key={member.id}
                member={member}
                onBusyChange={setBusy}
                onCancel={() => setEditing(false)}
                onSaved={async () => {
                  // Your name also shows in the sidebar: refresh the session too.
                  await Promise.all([refresh(), queryClient.invalidateQueries({ queryKey: sessionQuery.queryKey })])
                  setEditing(false)
                }}
              />
            ) : editing ? (
              <EditUserForm
                key={member.id}
                member={member}
                roles={roles}
                onBusyChange={setBusy}
                onCancel={() => setEditing(false)}
                onSaved={async () => {
                  await refresh()
                  setEditing(false)
                }}
              />
            ) : activeTab === 'details' ? (
              <div
                id={detailsPanelId}
                role="tabpanel"
                aria-labelledby={detailsTabId}
                tabIndex={0}
                className="flex min-h-0 flex-1 flex-col"
              >
                <div className="flex-1 overflow-y-auto bg-canvas px-4 py-4">
                  {error && (
                    <div className="mb-3">
                      <FormError message={error} />
                    </div>
                  )}
                  <Panel title="Account">
                    <Detail label="Name">{member.fullName}</Detail>
                    <Detail label="Email">
                      <span className="break-all">{member.email}</span>
                    </Detail>
                    <Detail label="Role">
                      <RoleTag role={member.role} />
                    </Detail>
                    <Detail label="Status">
                      <span className="inline-flex items-center gap-2">
                        <span
                          aria-hidden
                          className={`size-1.5 rounded-full ${member.isActive ? 'bg-secondary' : 'bg-ink-3'}`}
                        />
                        {member.isActive ? 'Active' : 'Deactivated'}
                      </span>
                    </Detail>
                    <Detail label="Last sign-in">
                      <span className="tabular-nums">{timeAgo(member.lastLoginAt)}</span>
                    </Detail>
                    <Detail label="Added">
                      <span className="tabular-nums">{dateFormat.format(new Date(member.createdAt))}</span>
                    </Detail>
                  </Panel>
                </div>

                {/* Deactivate far left; Edit then Delete (icon only) on the right. */}
                <div className="flex items-center gap-2 border-t border-line bg-canvas/60 px-5 py-3.5">
                  {!isSelf && (
                    <Button variant="secondary" onClick={toggleAccess} loading={busy}>
                      {!busy &&
                        (member.isActive ? (
                          <UserX size={15} strokeWidth={2} aria-hidden />
                        ) : (
                          <UserCheck size={15} strokeWidth={2} aria-hidden />
                        ))}
                      {member.isActive ? 'Deactivate' : 'Activate'}
                    </Button>
                  )}
                  <Button
                    variant="primary"
                    onClick={() => {
                      setActiveTab('details')
                      setEditing(true)
                    }}
                    disabled={busy}
                    className="ml-auto"
                  >
                    <Pencil size={15} strokeWidth={2} aria-hidden />
                    Edit
                  </Button>
                  {!isSelf && (
                    <Button
                      variant="secondary"
                      onClick={() => setConfirmDelete(true)}
                      disabled={busy}
                      aria-label={`Delete ${member.fullName}`}
                      title="Delete user"
                      className="w-9 px-0! text-danger"
                    >
                      <Trash2 size={16} strokeWidth={2} className="shrink-0" aria-hidden />
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div
                id={permissionsPanelId}
                role="tabpanel"
                aria-labelledby={permissionsTabId}
                tabIndex={0}
                className="flex min-h-0 flex-1 flex-col"
              >
                <PermissionsPanel key={member.id} member={member} onBusyChange={setBusy} />
              </div>
            )}
          </div>
        )}
      </dialog>

      <AlertDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        tone="danger"
        icon={null}
        width="compact"
        title={`Delete ${member?.fullName ?? 'this user'}?`}
        description="Their account is deleted and they’re signed out. This can’t be undone. To keep their account, deactivate it instead."
        confirmLabel="Delete"
        pendingLabel="Deleting…"
        onConfirm={async () => {
          if (!member) return
          await removeMember(member.id)
          await refresh()
          setEditing(false)
          onClose()
        }}
      />
    </>
  )
}

/**
 * A paper card of facts inside the drawer body: a title row, then one field per
 * row with a hairline between them. Sits on `--canvas` with Lift, like every
 * other content container (DESIGN.md: Cards / Containers).
 */
function Panel({ title, className = '', children }: { title: string; className?: string; children: ReactNode }) {
  const id = useId()
  return (
    <section aria-labelledby={id} className={`overflow-hidden rounded-xl bg-surface shadow-lift ${className}`}>
      <h3
        id={id}
        className="border-b border-line bg-canvas/50 px-3.5 py-2 text-caption font-semibold text-ink-2"
      >
        {title}
      </h3>
      <dl className="divide-y divide-line">{children}</dl>
    </section>
  )
}

interface TabButtonProps {
  id: string
  controls: string
  selected: boolean
  onSelect: () => void
  children: ReactNode
}

/** One stop in the recessed segmented control that switches the drawer view. */
function TabButton({ id, controls, selected, onSelect, children }: TabButtonProps) {
  return (
    <button
      type="button"
      id={id}
      role="tab"
      aria-selected={selected}
      aria-controls={controls}
      tabIndex={selected ? 0 : -1}
      onClick={onSelect}
      className={`flex h-8 min-w-[6.5rem] items-center justify-center rounded-lg px-3 text-label transition-colors ${
        selected ? 'btn btn-primary' : 'font-medium text-ink-2 hover:bg-surface-hover hover:text-ink'
      }`}
    >
      {children}
    </button>
  )
}

/** One field: a Label-weight label in `--ink-2`, then the value at body size in `--ink`. */
function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[6.5rem_1fr] items-baseline gap-3 px-3.5 py-2.5">
      <dt className="text-label font-medium text-ink-2">{label}</dt>
      <dd className="min-w-0 break-words text-body text-ink">{children}</dd>
    </div>
  )
}

/** The person's role as a chip: green wash with green text, neutral for staff. */
function RoleTag({ role }: { role: MemberRole }) {
  const tone = role === 'staff' ? 'bg-surface-hover text-ink-2' : 'bg-secondary-soft text-secondary-text'
  return <span className={`rounded-md px-1.5 py-0.5 text-micro font-semibold ${tone}`}>{ROLE_LABEL[role]}</span>
}

/**
 * The Permissions tab. Owners hold every menu implicitly, so their view is a
 * full-panel statement of that rather than a list of permissions they can't
 * change; for managers and staff each press of Save replaces the whole set.
 * Save is pinned in the footer, where the other drawer views keep their actions.
 */
function PermissionsPanel({
  member,
  onBusyChange,
}: {
  member: Member
  onBusyChange: (busy: boolean) => void
}) {
  const isOwner = member.role === 'owner'
  // Owners hold everything by role, so there is nothing to fetch for them.
  const { data, isPending, isError, refetch } = useQuery({
    ...memberAccessQuery(member.id),
    enabled: !isOwner,
  })

  if (isOwner) return <OwnerAccessPanel />

  if (isPending) {
    return (
      <>
        <div className="flex-1 overflow-y-auto bg-canvas px-4 py-4">
          <div className="grid place-items-center rounded-xl bg-surface py-8 shadow-lift">
            <Loader label="Loading menu access" />
          </div>
        </div>
        <div className="border-t border-line bg-canvas/60 px-5 py-3.5">
          <p className="text-caption text-ink-3">Loading menu access…</p>
        </div>
      </>
    )
  }

  if (isError || !data) {
    return (
      <>
        <div className="flex-1 overflow-y-auto bg-canvas px-4 py-4">
          <div className="rounded-xl bg-surface px-3.5 py-4 shadow-lift">
            <p className="text-body text-ink-2">Couldn’t load their menu access.</p>
            <Button size="sm" variant="secondary" className="mt-2" onClick={() => void refetch()}>
              Try again
            </Button>
          </div>
        </div>
        <div className="border-t border-line bg-canvas/60 px-5 py-3.5">
          <p className="text-caption text-ink-3">Menu access unavailable</p>
        </div>
      </>
    )
  }

  return <AccessEditor member={member} data={data} onBusyChange={onBusyChange} />
}

/**
 * An owner's Permissions tab: the whole menu set, held by role. No checklist —
 * there is nothing to choose — just the illustration, the reason, and a footer
 * note in place of a Save button that could never enable.
 */
function OwnerAccessPanel() {
  return (
    <>
      <div className="grid flex-1 place-items-center overflow-y-auto bg-canvas px-6 py-10 text-center">
        <div>
          <OwnerAccessIllustration />
          <p className="mt-5 text-title font-semibold text-ink">Every menu, always on</p>
          <p className="mx-auto mt-1.5 max-w-[36ch] text-body text-ink-2">
            Owners hold the whole menu set, so there is nothing to grant here. Open a manager or a
            staff member to choose theirs.
          </p>
        </div>
      </div>
      <div className="border-t border-line bg-canvas/60 px-5 py-3.5">
        <p className="text-caption text-ink-3">
          Owner access covers every menu and can’t be changed.
        </p>
      </div>
    </>
  )
}

/**
 * "Every menu unlocked": a shield on a dashed ring of granted menus. Drawn with
 * the theme tokens so it follows light and dark without a second asset.
 */
function OwnerAccessIllustration() {
  const cx = 120
  const cy = 50
  const ring = 40
  const dots = Array.from({ length: 8 }, (_, index) => {
    const angle = (index * Math.PI) / 4
    return { x: cx + Math.cos(angle) * ring, y: cy + Math.sin(angle) * ring }
  })

  return (
    <svg
      viewBox="0 0 240 100"
      aria-hidden
      className="mx-auto block h-auto w-full max-w-[240px]"
      fill="none"
    >
      <circle cx={cx} cy={cy} r="34" fill="var(--secondary-soft)" />
      <circle
        cx={cx}
        cy={cy}
        r={ring}
        stroke="var(--line-strong)"
        strokeWidth="1.5"
        strokeDasharray="3 5"
        strokeLinecap="round"
      />
      {dots.map((dot) => (
        <circle key={`${dot.x}-${dot.y}`} cx={dot.x} cy={dot.y} r="2.6" fill="var(--secondary-text)" opacity="0.55" />
      ))}
      <path
        d="M120 24l22 8v18c0 13-9 24-22 28-13-4-22-15-22-28V32l22-8z"
        fill="var(--surface)"
        stroke="var(--secondary)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M110 50l7 7 14-15"
        stroke="var(--secondary)"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * The checklist and its Save action share one baseline: what the server last
 * confirmed. Save enables only for a real change and "Saved" survives until
 * the next tick changes.
 */
function AccessEditor({
  member,
  data,
  onBusyChange,
}: {
  member: Member
  data: MemberAccess
  onBusyChange: (busy: boolean) => void
}) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(data.accessKeys))
  const [baseline, setBaseline] = useState(() => data.accessKeys.join('|'))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const toggle = (key: string) => {
    setSaved(false)
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const orderedKeys = data.items.filter((item) => selected.has(item.key)).map((item) => item.key)
  const dirty = orderedKeys.join('|') !== baseline

  async function save() {
    setSaving(true)
    onBusyChange(true)
    setError(null)
    setSaved(false)
    try {
      const next = await setMemberAccess(member.id, orderedKeys)
      setSelected(new Set(next.accessKeys))
      setBaseline(next.accessKeys.join('|'))
      setSaved(true)
    } catch (e) {
      setError(failure(e, 'Couldn’t save menu access. Try again.'))
    } finally {
      setSaving(false)
      onBusyChange(false)
    }
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto bg-canvas px-4 py-4">
        {error && (
          <div className="mb-3">
            <FormError message={error} />
          </div>
        )}
        <section className="overflow-hidden rounded-xl bg-surface shadow-lift">
          <ul className="divide-y divide-line">
            {data.items.map((item) => (
              <li key={item.key}>
                <label className="flex cursor-pointer items-center gap-3 px-3.5 py-2.5 hover:bg-surface-hover">
                  <input
                    type="checkbox"
                    className="size-4 shrink-0 accent-secondary"
                    checked={selected.has(item.key)}
                    onChange={() => toggle(item.key)}
                    disabled={saving}
                  />
                  <span className="text-body text-ink">{item.label}</span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <div className="flex items-center gap-2 border-t border-line bg-canvas/60 px-5 py-3.5">
        <p className="text-caption text-ink-3" aria-live="polite">
          {selected.size} of {data.items.length} menus{saved && !dirty ? ' · Saved' : ''}
        </p>
        <Button
          size="sm"
          variant="primary"
          className="ml-auto"
          onClick={() => void save()}
          loading={saving}
          disabled={!dirty}
        >
          {saving ? 'Saving…' : 'Save access'}
        </Button>
      </div>
    </>
  )
}

interface EditUserFormProps {
  member: Member
  roles: MemberRole[]
  onBusyChange: (busy: boolean) => void
  onCancel: () => void
  onSaved: () => Promise<void>
}

/** Edit mode for someone else: name, email, role and a new password, saved together. */
function EditUserForm({ member, roles, onBusyChange, onCancel, onSaved }: EditUserFormProps) {
  const [fullName, setFullName] = useState(member.fullName)
  const [email, setEmail] = useState(member.email)
  const [role, setRole] = useState<MemberRole>(member.role)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)


  async function save() {
    if (!fullName.trim()) return setError('Enter their name')
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Enter a valid email, like name@company.com')
    if (password && !strongPassword.safeParse(password).success) {
      return setError(`The new password doesn’t meet the rule: ${PASSWORD_HINT.toLowerCase()}`)
    }
    const patch: { fullName?: string; email?: string; role?: MemberRole } = {}
    if (fullName.trim() !== member.fullName) patch.fullName = fullName.trim()
    if (email.trim().toLowerCase() !== member.email) patch.email = email.trim().toLowerCase()
    if (role !== member.role) patch.role = role

    setSaving(true)
    onBusyChange(true)
    setError(null)
    try {
      if (Object.keys(patch).length) await updateMember(member.id, patch)
      if (password) await setMemberPassword(member.id, password)
      await onSaved()
    } catch (e) {
      setError(failure(e, 'Couldn’t save. Try again.'))
    } finally {
      setSaving(false)
      onBusyChange(false)
    }
  }

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto bg-canvas px-5 py-5">
        <FormError message={error} />
        <FormField label="Name" htmlFor="user-name">
          <input
            id="user-name"
            autoFocus
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="field-input"
          />
        </FormField>
        <FormField label="Email" htmlFor="user-email" hint="They sign in with this.">
          <input
            id="user-email"
            type="email"
            inputMode="email"
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="field-input"
          />
        </FormField>
        <FormField label="Role" htmlFor="user-role">
          <select
            id="user-role"
            value={role}
            onChange={(e) => setRole(e.target.value as MemberRole)}
            disabled={roles.length < 2}
            className="field-input"
          >
            {roles.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
        </FormField>
        <FormField
            label="New password"
            htmlFor="user-password"
            hint={`${PASSWORD_HINT} Leave empty to keep their current one; setting a new one signs them out.`}
          >
            <div className="relative">
              <input
                id="user-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="field-input pr-11"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-lg text-ink-3 hover:text-ink"
              >
                {showPassword ? <EyeOff size={16} strokeWidth={1.75} /> : <Eye size={16} strokeWidth={1.75} />}
              </button>
            </div>
          </FormField>
      </div>
      <div className="flex justify-end gap-2 border-t border-line bg-canvas/60 px-5 py-3.5">
        <Button variant="secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </form>
  )
}

interface EditSelfFormProps {
  member: Member
  onBusyChange: (busy: boolean) => void
  onCancel: () => void
  onSaved: () => Promise<void>
}

/**
 * Edit mode for your own account: your name and your password. Changing the
 * password needs your current one (checked by the server), and signs out your
 * other devices while this browser stays signed in.
 */
function EditSelfForm({ member, onBusyChange, onCancel, onSaved }: EditSelfFormProps) {
  const [fullName, setFullName] = useState(member.fullName)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [showPasswords, setShowPasswords] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    if (!fullName.trim()) return setError('Enter your name')
    const changingPassword = newPassword.length > 0
    if (changingPassword && !currentPassword) return setError('Enter your current password to set a new one')
    if (changingPassword && !strongPassword.safeParse(newPassword).success) {
      return setError(`The new password doesn’t meet the rule: ${PASSWORD_HINT.toLowerCase()}`)
    }

    setSaving(true)
    onBusyChange(true)
    setError(null)
    try {
      if (fullName.trim() !== member.fullName) await updateMyName(fullName.trim())
      if (changingPassword) await changeMyPassword(currentPassword, newPassword)
      await onSaved()
    } catch (e) {
      setError(failure(e, 'Couldn’t save. Try again.'))
    } finally {
      setSaving(false)
      onBusyChange(false)
    }
  }

  const passwordToggle = (
    <button
      type="button"
      onClick={() => setShowPasswords((s) => !s)}
      aria-label={showPasswords ? 'Hide passwords' : 'Show passwords'}
      aria-pressed={showPasswords}
      className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-lg text-ink-3 hover:text-ink"
    >
      {showPasswords ? <EyeOff size={16} strokeWidth={1.75} /> : <Eye size={16} strokeWidth={1.75} />}
    </button>
  )

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto bg-canvas px-5 py-5">
        <FormError message={error} />
        <FormField label="Name" htmlFor="self-name">
          <input
            id="self-name"
            autoFocus
            autoComplete="name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="field-input"
          />
        </FormField>
        <FormField label="Current password" htmlFor="self-current" hint="Needed only to change your password.">
          <div className="relative">
            <input
              id="self-current"
              type={showPasswords ? 'text' : 'password'}
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="field-input pr-11"
            />
            {passwordToggle}
          </div>
        </FormField>
        <FormField
          label="New password"
          htmlFor="self-new"
          hint={`${PASSWORD_HINT} Leave empty to keep your current one.`}
        >
          <input
            id="self-new"
            type={showPasswords ? 'text' : 'password'}
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="field-input"
          />
        </FormField>
      </div>
      <div className="flex justify-end gap-2 border-t border-line bg-canvas/60 px-5 py-3.5">
        <Button variant="secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </form>
  )
}
