import { useQuery } from '@tanstack/react-query'
import { Search, UserPlus } from 'lucide-react'
import { getRouteApi } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Button } from '@/components/Button'
import { Loader } from '@/components/Loader'
import { Pagination } from '@/components/Pagination'
import { initials, ROLE_LABEL, useSession, type MemberRole } from '@/lib/auth'
import { assignableRoles, canManage, memberQuery, membersPageQuery, type Member } from '@/lib/members'
import { AddUserDialog } from '../components/AddUserDialog'
import { SearchUsersDialog } from '../components/SearchUsersDialog'
import { UserDetailsDrawer } from '../components/UserDetailsDrawer'

const dateFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
/** "16 Nov 2026" in the viewer's locale. */
const createdOn = (iso: string) => dateFormat.format(new Date(iso))

const route = getRouteApi('/_authed/admin/users')

/** Admin › System (users): the owner creates and manages everyone in the company. */
export function UsersPage() {
  const { user } = useSession()
  const page = route.useSearch({ select: (s) => s.page ?? 1 })
  const navigate = route.useNavigate()
  const { data, isPending, isError, isPlaceholderData, refetch } = useQuery(membersPageQuery(page))

  const goTo = (next: number) => void navigate({ search: { page: next } })

  // A page that no longer exists (the last user on it was deleted, or an old
  // link): go to the last page that does.
  useEffect(() => {
    if (data && page > data.totalPages) void navigate({ search: { page: data.totalPages }, replace: true })
  }, [data, page, navigate])
  const [adding, setAdding] = useState(false)
  const [searching, setSearching] = useState(false)
  // The user in the details drawer: opened from a row or from search (they may
  // not be on this page). Loaded by id so it stays fresh after an edit; the
  // snapshot shows instantly meanwhile. A deleted user 404s, which closes it.
  const [picked, setPicked] = useState<Member | null>(null)
  const viewingQuery = useQuery({ ...memberQuery(picked?.id ?? ''), enabled: !!picked })
  const viewing = picked ? (viewingQuery.data ?? picked) : null
  const viewUser = (m: Member) => setPicked(m)
  if (picked && viewingQuery.isError) setPicked(null)
  const roles = assignableRoles(user.role)

  return (
    <div className="flex w-full flex-col px-5 pt-8 pb-32 sm:min-h-0 sm:flex-1 sm:px-10 sm:py-10">
      {/* No visible page title (the header says System Management); kept for screen readers. */}
      <h1 className="sr-only">Users</h1>
      <div className="flex justify-end gap-2">
        <Button
          variant="secondary"
          onClick={() => setSearching(true)}
          aria-haspopup="dialog"
          aria-label="Search users"
          title="Search users"
          className="w-9 px-0!"
        >
          <Search size={16} strokeWidth={2} className="shrink-0" aria-hidden />
        </Button>
        {/* Icon only on phones, icon + label from tablet up. */}
        <Button
          variant="primary"
          onClick={() => setAdding(true)}
          aria-haspopup="dialog"
          aria-label="Add user"
          title="Add user"
          className="w-9 px-0! sm:w-auto sm:px-3.5!"
        >
          <UserPlus size={16} strokeWidth={2} className="shrink-0" aria-hidden />
          <span className="hidden sm:inline">Add user</span>
        </Button>
      </div>

      {/* Phones: one card per person. Tablet and up: one panel holding the table. */}
      {/* Tablet and up: the panel takes all the height left, so only the table scrolls. */}
      <div className="mt-4 flex min-h-[70vh] flex-col sm:min-h-72 sm:flex-1 sm:overflow-hidden sm:rounded-xl sm:bg-surface sm:shadow-lift">
        {isPending ? (
          <div className="grid flex-1 place-items-center">
            <Loader label="Loading users" />
          </div>
        ) : isError ? (
          <div className="grid flex-1 place-items-center px-4 text-center">
            <div>
              <p className="text-body text-ink-2">Couldn’t load your users.</p>
              <Button size="sm" variant="secondary" className="mt-3" onClick={() => void refetch()}>
                Try again
              </Button>
            </div>
          </div>
        ) : (
          <>
            <ul
              aria-busy={isPlaceholderData}
              className={`flex flex-col gap-3 transition-opacity sm:hidden ${isPlaceholderData ? 'opacity-60' : ''}`}
            >
              {data.items.map((m) => {
                const isSelf = m.id === user.id
                const viewable = isSelf || canManage(user.role, m.role)
                return (
                  <li key={m.id} className="rounded-xl bg-surface p-4 shadow-lift">
                    <div className="flex items-start gap-3">
                      <Avatar name={m.fullName} active={m.isActive} />
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2 font-medium text-ink">
                          <span className="truncate">{m.fullName}</span>
                          {isSelf && <span className="shrink-0 text-caption font-normal text-ink-3">(you)</span>}
                        </p>
                        <p className="truncate text-caption text-ink-3">{m.email}</p>
                      </div>
                      {/* Phones: the role sits top right and the date leads the bottom bar. */}
                      <RoleTag role={m.role} className="shrink-0" />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-line pt-3 text-label text-ink-2">
                      <span className="text-caption text-ink-3 tabular-nums">Created {createdOn(m.createdAt)}</span>
                      {viewable && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => viewUser(m)}
                          aria-haspopup="dialog"
                          aria-label={`View ${m.fullName}`}
                          className="ml-auto"
                        >
                          View
                        </Button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>

            {/* Tablet and up: rows scroll inside the fixed-height panel; the header stays pinned. */}
            <div
              aria-busy={isPlaceholderData}
              className={`hidden min-h-0 flex-1 overflow-y-auto overscroll-contain transition-opacity sm:block ${
                isPlaceholderData ? 'opacity-60' : ''
              }`}
            >
              <table className="w-full table-fixed text-left text-body">
                <thead className="sticky top-0 z-10 bg-surface text-caption font-medium text-ink-3">
                  <tr className="bg-canvas/60 shadow-[inset_0_-1px_0_var(--line-strong)]">
                    <th scope="col" className="w-[30%] px-4 py-2.5 font-medium xl:w-[24%]">
                      Username
                    </th>
                    <th scope="col" className="px-4 py-2.5 font-medium xl:w-[30%]">
                      Email
                    </th>
                    <th scope="col" className="w-28 px-4 py-2.5 font-medium whitespace-nowrap xl:w-[11%]">
                      Role
                    </th>
                    <th scope="col" className="w-32 px-4 py-2.5 font-medium whitespace-nowrap xl:w-[13%]">
                      Status
                    </th>
                    <th
                      scope="col"
                      className="hidden px-4 py-2.5 font-medium whitespace-nowrap xl:table-cell xl:w-[13%]"
                    >
                      Created on
                    </th>
                    <th scope="col" className="w-24 px-4 py-2.5 text-right font-medium whitespace-nowrap xl:w-[9%]">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((m) => {
                    const isSelf = m.id === user.id
                    const viewable = isSelf || canManage(user.role, m.role)
                    return (
                      <tr key={m.id} className="border-b border-line">
                        <td className="max-w-0 px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar name={m.fullName} active={m.isActive} />
                            <p className="flex min-w-0 items-center gap-2 font-medium text-ink">
                              <span className="truncate">{m.fullName}</span>
                              {isSelf && <span className="shrink-0 text-caption font-normal text-ink-3">(you)</span>}
                            </p>
                          </div>
                        </td>
                        <td className="max-w-0 px-4 py-3">
                          <p className="truncate text-ink-2" title={m.email}>
                            {m.email}
                          </p>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <RoleTag role={m.role} />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <Access active={m.isActive} />
                        </td>
                        <td className="hidden px-4 py-3 text-label whitespace-nowrap text-ink-2 tabular-nums xl:table-cell">
                          {createdOn(m.createdAt)}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          {viewable && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => viewUser(m)}
                              aria-haspopup="dialog"
                              aria-label={`View ${m.fullName}`}
                            >
                              View
                            </Button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {data.total === 1 && (
              <div className="px-4 py-6 text-center text-label text-ink-3">
                It’s just you so far. Add your employees to give each of them their own sign-in.
              </div>
            )}
            {/* Footer: pinned to the bottom of the panel; the rows above it scroll. */}
            <Pagination
              page={data.page}
              totalPages={data.totalPages}
              total={data.total}
              pageSize={data.pageSize}
              onPageChange={goTo}
              busy={isPlaceholderData}
              noun={data.total === 1 ? 'user' : 'users'}
              className="fixed inset-x-0 bottom-0 z-20 border-t border-line-strong bg-surface/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-sm sm:static sm:z-auto sm:shrink-0 sm:bg-canvas/60 sm:py-2.5 sm:backdrop-blur-none"
            />
          </>
        )}
      </div>

      <AddUserDialog open={adding} onOpenChange={setAdding} roles={roles} />
      <SearchUsersDialog open={searching} onOpenChange={setSearching} onSelect={viewUser} />
      <UserDetailsDrawer
        member={viewing}
        onClose={() => setPicked(null)}
        roles={roles}
        isSelf={viewing?.id === user.id}
      />
    </div>
  )
}

/** A role as a small tag: owners and managers in ink green, staff neutral. */
function RoleTag({ role, className = '' }: { role: MemberRole; className?: string }) {
  const tone = role === 'staff' ? 'bg-surface-hover text-ink-2' : 'bg-secondary-soft text-secondary-text'
  return (
    <span className={`rounded-md px-1.5 py-0.5 text-micro font-semibold ${tone} ${className}`}>{ROLE_LABEL[role]}</span>
  )
}

/** A person's initials: ink green when they can sign in, muted when deactivated. */
function Avatar({ name, active }: { name: string; active: boolean }) {
  const tone = active ? 'bg-secondary text-on-secondary' : 'bg-surface-hover text-ink-3'
  return (
    <span
      aria-hidden
      className={`grid size-8 shrink-0 place-items-center rounded-md text-caption font-semibold ${tone}`}
    >
      {initials(name)}
    </span>
  )
}

/** A person's status: Active (can sign in) or Deactivated, as a dot and a word. */
function Access({ active }: { active: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 text-label text-ink-2">
      <span aria-hidden className={`size-1.5 rounded-full ${active ? 'bg-secondary' : 'bg-ink-3'}`} />
      {active ? 'Active' : 'Deactivated'}
    </span>
  )
}
