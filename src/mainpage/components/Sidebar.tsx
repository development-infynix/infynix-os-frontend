import { useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { House, LogOut, Users, X, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { AlertDialog } from '@/components/Alert'
import { Button } from '@/components/Button'
import { canAdminister, initials, ROLE_LABEL, sessionQuery, signOut, useSession } from '@/lib/auth'

interface NavItem {
  to: '/' | '/admin/users'
  label: string
  icon: LucideIcon
}

const MAIN_NAV: NavItem[] = [{ to: '/', label: 'Overview', icon: House }]

/** The Admin section: rendered for owners only (the routes refuse everyone else too). */
const ADMIN_NAV: NavItem[] = [{ to: '/admin/users', label: 'System', icon: Users }]

interface SidebarProps {
  /** Mobile drawer only: closes it. */
  onClose?: () => void
}

export function Sidebar({ onClose }: SidebarProps) {
  const { user, tenant } = useSession()
  const isAdmin = canAdminister(user.role)
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [confirmSignOut, setConfirmSignOut] = useState(false)

  async function handleSignOut() {
    // If the server can't end the session, say so (the dialog shows the
    // error) instead of pretending: the cookie would still be valid.
    await signOut()
    queryClient.setQueryData(sessionQuery.queryKey, null)
    queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== 'auth' })
    await navigate({ to: '/login' })
  }

  return (
    <div className="flex h-full flex-col bg-canvas">
      <div className="flex h-header items-center gap-2 px-2.5 pt-2.5">
        <div className="min-w-0 flex-1">
          <div className="flex h-9 items-center gap-2.5 px-1.5">
            <span
              aria-hidden
              className="grid size-6 shrink-0 place-items-center rounded-md bg-secondary text-caption font-semibold text-on-secondary"
            >
              {tenant.name.trim()[0]?.toUpperCase()}
            </span>
            <span className="truncate text-body font-semibold text-ink" title={tenant.name}>
              {tenant.name}
            </span>
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="grid size-9 place-items-center rounded-md text-ink-2 hover:bg-surface-hover hover:text-ink"
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        )}
      </div>

      <nav aria-label="Main" className="flex-1 overflow-y-auto px-2.5 pt-2">
        <NavList items={MAIN_NAV} onNavigate={onClose} />
        {isAdmin && (
          <div className="mt-5">
            <p id="nav-admin" className="px-2 pb-1.5 text-caption font-medium text-ink-3">
              Admin
            </p>
            <NavList items={ADMIN_NAV} onNavigate={onClose} labelledBy="nav-admin" />
          </div>
        )}
      </nav>

      <div className="border-t border-line p-2.5">
        <div className="flex items-center gap-2.5 rounded-lg p-2">
          <span
            aria-hidden
            className="grid size-8 shrink-0 place-items-center rounded-md bg-secondary text-caption font-semibold text-on-secondary"
          >
            {initials(user.fullName)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 text-body font-semibold leading-5 text-ink">
              <span className="truncate">{user.fullName}</span>
              <span className="shrink-0 rounded-md bg-secondary-soft px-1.5 py-px text-micro font-semibold leading-4 text-secondary-text">
                {ROLE_LABEL[user.role]}
              </span>
            </p>
            <p className="truncate text-caption leading-4 text-ink-3" title={user.email}>
              {user.email}
            </p>
          </div>
        </div>
        {/* Signing out is red here and in its confirmation, so the two always match. */}
        <Button
          variant="danger"
          size="sm"
          onClick={() => setConfirmSignOut(true)}
          aria-haspopup="dialog"
          className="mt-3 w-full"
        >
          <LogOut size={15} strokeWidth={2} aria-hidden />
          Sign out
        </Button>
      </div>

      <AlertDialog
        open={confirmSignOut}
        onOpenChange={setConfirmSignOut}
        title="Sign out of Infynix OS?"
        description={
          <>
            You’ll need your email and password to sign back in as{' '}
            <span className="font-medium text-ink">{user.email}</span>.
          </>
        }
        tone="danger"
        icon={null}
        width="compact"
        confirmLabel="Sign out"
        pendingLabel="Signing out…"
        onConfirm={handleSignOut}
      />
    </div>
  )
}

function NavList({ items, onNavigate, labelledBy }: { items: NavItem[]; onNavigate?: () => void; labelledBy?: string }) {
  return (
    <ul className="flex flex-col gap-0.5" aria-labelledby={labelledBy}>
      {items.map(({ to, label, icon: Icon }) => (
        <li key={to}>
          <Link
            to={to}
            onClick={onNavigate}
            activeOptions={{ exact: to === '/' }}
            className="group flex h-8 items-center gap-2.5 rounded-md px-2 text-body font-medium text-ink-2 transition-colors duration-100 hover:bg-surface-hover hover:text-ink data-[status=active]:bg-secondary-soft data-[status=active]:text-secondary-text"
          >
            <Icon size={16} strokeWidth={1.9} className="shrink-0" />
            {label}
          </Link>
        </li>
      ))}
    </ul>
  )
}
