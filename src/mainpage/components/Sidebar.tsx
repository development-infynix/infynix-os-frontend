import { useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import {
  CalendarDays,
  FolderKanban,
  Handshake,
  House,
  Images,
  LogOut,
  ReceiptText,
  ShieldUser,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useState } from 'react'
import { BsLayoutSidebarReverse } from 'react-icons/bs'
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
  { to: '/clients', label: 'Clients', icon: Users, access: 'clients' },
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
const ADMIN_NAV: NavItem[] = [{ to: '/admin/users', label: 'System', icon: ShieldUser }]

interface SidebarProps {
  /** Mobile drawer only: closes it. */
  onClose?: () => void
  /** Desktop only: narrows the sidebar to an icon rail. */
  collapsed?: boolean
  onToggleCollapse?: () => void
}

export function Sidebar({ onClose, collapsed = false, onToggleCollapse }: SidebarProps) {
  const session = useSession()
  const { user } = session
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
      <div
        className={`flex h-header items-center border-b border-line ${collapsed ? 'justify-center px-2' : 'gap-2 px-2.5'}`}
      >
        {!collapsed && (
          <div className="flex min-w-0 flex-1 items-center px-1.5">
            <p className="flex min-w-0 items-baseline gap-1.5">
              <span className="truncate text-[20px] font-semibold uppercase leading-none tracking-[0.04em] text-ink">
                Infynix
              </span>
              <span className="font-hand text-[20px] leading-none text-secondary-text">OS</span>
            </p>
          </div>
        )}
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="grid size-9 place-items-center rounded-md text-ink-2 hover:bg-surface-hover hover:text-ink"
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        ) : (
          onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="grid size-8 shrink-0 place-items-center rounded-md text-ink-3 hover:bg-surface-hover hover:text-ink"
            >
              <BsLayoutSidebarReverse size={17} />
            </button>
          )
        )}
      </div>

      <nav
        aria-label="Main"
        className={`flex-1 overflow-y-auto pt-4 ${collapsed ? 'px-2' : 'px-2.5'}`}
      >
        <NavList items={nav} onNavigate={onClose} collapsed={collapsed} />
      </nav>

      <div className="border-t border-line">
        {isAdmin && (
          <nav
            aria-label="Admin"
            className={`border-b border-line py-2 ${collapsed ? 'px-2' : 'px-2.5'}`}
          >
            <NavList items={ADMIN_NAV} onNavigate={onClose} collapsed={collapsed} />
          </nav>
        )}
        <div className={collapsed ? 'p-2' : 'p-2.5'}>
          <div
            className={`flex items-center gap-2.5 rounded-lg p-2 ${collapsed ? 'justify-center px-0' : ''}`}
          >
            <span
              aria-hidden
              title={collapsed ? `${user.fullName} (${ROLE_LABEL[user.role]})` : undefined}
              className="grid size-8 shrink-0 place-items-center rounded-md bg-secondary text-caption font-semibold text-on-secondary"
            >
              {initials(user.fullName)}
            </span>
            {!collapsed && (
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
            )}
          </div>
          {/* Signing out is red here and in its confirmation, so the two always match. */}
          <Button
            variant="danger"
            size="sm"
            onClick={() => setConfirmSignOut(true)}
            aria-haspopup="dialog"
            title={collapsed ? 'Sign out' : undefined}
            className={`mt-3 w-full ${collapsed ? 'px-0' : ''}`}
          >
            <LogOut size={15} strokeWidth={2} aria-hidden />
            <span className={collapsed ? 'sr-only' : undefined}>Sign out</span>
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

function NavList({
  items,
  onNavigate,
  collapsed = false,
}: {
  items: NavItem[]
  onNavigate?: () => void
  collapsed?: boolean
}) {
  return (
    <ul className="flex flex-col divide-y divide-line">
      {items.map(({ to, label, icon: Icon }) => (
        <li key={to} className="py-1 first:pt-0 last:pb-0">
          <Link
            to={to}
            onClick={onNavigate}
            activeOptions={{ exact: to === '/' }}
            title={collapsed ? label : undefined}
            className={`group flex h-8 items-center rounded-md text-body font-medium text-ink-2 transition duration-100 hover:bg-surface-hover hover:text-ink data-[status=active]:[background:var(--btn-primary-bg)] data-[status=active]:[box-shadow:var(--btn-primary-shadow)] data-[status=active]:text-on-primary data-[status=active]:hover:brightness-[1.06] data-[status=active]:hover:text-on-primary ${collapsed ? 'justify-center px-0' : 'gap-2.5 px-2'}`}
          >
            <Icon size={16} strokeWidth={1.9} className="shrink-0" />
            <span className={collapsed ? 'sr-only' : undefined}>{label}</span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
