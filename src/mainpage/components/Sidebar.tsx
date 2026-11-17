import { useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import {
  CalendarDays,
  Contact,
  FolderKanban,
  Handshake,
  House,
  Images,
  LogOut,
  ReceiptText,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useState } from 'react'
import { AlertDialog } from '@/components/Alert'
import { Button } from '@/components/Button'
import { hasAccess } from '@/lib/access'
import { canAdminister, initials, ROLE_LABEL, sessionQuery, signOut, useSession } from '@/lib/auth'

type NavPath =
  | '/'
  | '/admin/users'
  | '/clients'
  | '/crm'
  | '/calendar'
  | '/payments-budget'
  | '/project-management'
  | '/invoices'
  | '/media'

interface NavItem {
  to: NavPath
  label: string
  icon: LucideIcon
  /** Omitted for items everyone can open. */
  access?: string
}

const MAIN_NAV: NavItem[] = [
  { to: '/', label: 'Overview', icon: House },
  { to: '/clients', label: 'Clients', icon: Contact, access: 'clients' },
  { to: '/crm', label: 'CRM', icon: Handshake, access: 'crm' },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays, access: 'calendar' },
  { to: '/payments-budget', label: 'Payments & Budget', icon: Wallet, access: 'payments-budget' },
  {
    to: '/project-management',
    label: 'Project Management',
    icon: FolderKanban,
    access: 'project-management',
  },
  { to: '/invoices', label: 'Invoices', icon: ReceiptText, access: 'invoices' },
  { to: '/media', label: 'Media', icon: Images, access: 'media' },
]

/** The owner's utility destination, pinned above the account footer. */
const ADMIN_NAV: NavItem[] = [{ to: '/admin/users', label: 'System', icon: Users }]

interface SidebarProps {
  /** Mobile drawer only: closes it. */
  onClose?: () => void
}

export function Sidebar({ onClose }: SidebarProps) {
  const session = useSession()
  const { user, tenant } = session
  const isAdmin = canAdminister(user.role)
  const nav = MAIN_NAV.filter((item) => !item.access || hasAccess(session, item.access))
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
      <div className="flex h-header items-center gap-2 border-b border-line px-2.5">
        <div className="flex min-w-0 flex-1 items-center gap-2.5 px-1.5">
          <span
            aria-hidden
            className="grid size-7 shrink-0 place-items-center rounded-md bg-secondary text-caption font-semibold text-on-secondary"
          >
            I
          </span>
          <div className="min-w-0">
            <p className="truncate text-body font-semibold leading-5 text-ink">Infynix</p>
            <p className="truncate text-caption leading-4 text-ink-3" title={tenant.name}>
              {tenant.name}
            </p>
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

      <nav aria-label="Main" className="flex-1 overflow-y-auto px-2.5 pt-4">
        <NavList items={nav} onNavigate={onClose} />
      </nav>

      <div className="border-t border-line">
        {isAdmin && (
          <nav aria-label="Admin" className="border-b border-line px-2.5 py-2">
            <NavList items={ADMIN_NAV} onNavigate={onClose} />
          </nav>
        )}
        <div className="p-2.5">
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

function NavList({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  return (
    <ul className="flex flex-col divide-y divide-line">
      {items.map(({ to, label, icon: Icon }) => (
        <li key={to} className="py-1 first:pt-0 last:pb-0">
          <Link
            to={to}
            onClick={onNavigate}
            activeOptions={{ exact: to === '/' }}
            className="group flex h-8 items-center gap-2.5 rounded-md px-2 text-body font-medium text-ink-2 transition duration-100 hover:bg-surface-hover hover:text-ink data-[status=active]:[background:var(--btn-primary-bg)] data-[status=active]:[box-shadow:var(--btn-primary-shadow)] data-[status=active]:text-on-primary data-[status=active]:hover:brightness-[1.06] data-[status=active]:hover:text-on-primary"
          >
            <Icon size={16} strokeWidth={1.9} className="shrink-0" />
            {label}
          </Link>
        </li>
      ))}
    </ul>
  )
}
