import { useQuery } from '@tanstack/react-query'
import { ChevronDown, Contact, FileSpreadsheet, Pencil, Search, UserPlus } from 'lucide-react'
import { getRouteApi } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/Button'
import { Loader } from '@/components/Loader'
import { Pagination } from '@/components/Pagination'
import { clientQuery, clientsPageQuery, hasContact, type Client } from '@/lib/clients'
import { AddClientDialog } from '../components/AddClientDialog'
import { ClientImportModal } from '../components/ClientImportModal'
import { ClientDetailsDrawer } from '../components/ClientDetailsDrawer'
import { SearchClientsDialog } from '../components/SearchClientsDialog'

const dateFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
/** "16 Nov 2026" in the viewer's locale. */
const addedOn = (iso: string) => dateFormat.format(new Date(iso))

const route = getRouteApi('/_authed/clients')

/** Clients: everyone with menu access can browse, add and edit the directory. */
export function ClientsPage() {
  const page = route.useSearch({ select: (s) => s.page ?? 1 })
  const q = route.useSearch({ select: (s) => s.q ?? '' })
  const navigate = route.useNavigate()
  const { data, isPending, isFetching, isError, isPlaceholderData, refetch } = useQuery(clientsPageQuery(page, q))
  const busy = isFetching && isPlaceholderData

  const goTo = (next: number) => void navigate({ search: { page: next, q } })

  // A page that no longer exists (the last client on it was deleted, or an old
  // link): go to the last page that does.
  useEffect(() => {
    if (data && page > data.totalPages) {
      void navigate({ search: { page: Math.max(1, data.totalPages), q }, replace: true })
    }
  }, [data, page, q, navigate])
  const [adding, setAdding] = useState(false)
  const [importing, setImporting] = useState(false)
  const [searching, setSearching] = useState(false)
  // The client in the details drawer: opened from a row or from search (they
  // may not be on this page). Loaded by id so it stays fresh after an edit;
  // the snapshot shows instantly meanwhile. A deleted client 404s, which
  // closes it.
  const [picked, setPicked] = useState<Client | null>(null)
  const viewingQuery = useQuery({ ...clientQuery(picked?.id ?? ''), enabled: !!picked })
  const viewing = picked ? (viewingQuery.data ?? picked) : null
  const viewClient = (client: Client) => setPicked(client)
  if (picked && viewingQuery.isError) setPicked(null)

  return (
    <div className="flex w-full flex-col px-5 pb-32 sm:min-h-0 sm:flex-1 sm:px-10 sm:py-10">
      <h1 className="sr-only">Clients</h1>
      <div className="sticky top-header z-20 -mx-5 flex h-header items-center justify-end gap-2 border-b border-line bg-canvas/90 px-5 backdrop-blur-sm sm:static sm:mx-0 sm:h-auto sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        <Button
          variant="secondary"
          onClick={() => setSearching(true)}
          aria-haspopup="dialog"
          aria-label="Search clients"
          title="Search clients"
          className="w-9 px-0!"
        >
          <Search size={16} strokeWidth={2} className="shrink-0" aria-hidden />
        </Button>
        <AddClientMenu
          onForm={() => setAdding(true)}
          onImport={() => setImporting(true)}
        />
      </div>

      {/* Phones: one card per client. Tablet and up: one panel holding the table. */}
      {/* Tablet and up: the panel takes all the height left, so only the table scrolls. */}
      <div className="mt-4 flex min-h-[70vh] flex-col sm:min-h-72 sm:flex-1 sm:overflow-hidden sm:rounded-xl sm:bg-surface sm:shadow-lift">
        {isPending || busy ? (
          <div className="grid flex-1 place-items-center">
            <Loader label="Loading clients" />
          </div>
        ) : isError ? (
          <div className="grid flex-1 place-items-center px-4 text-center">
            <div>
              <p className="text-body text-ink-2">Couldn’t load your clients.</p>
              <Button size="sm" variant="secondary" className="mt-3" onClick={() => void refetch()}>
                Try again
              </Button>
            </div>
          </div>
        ) : (
          <>
            <ul
              aria-busy={busy}
              className="max-h-[calc(100dvh-11rem)] flex flex-col gap-3 overflow-y-auto overscroll-contain pb-20 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:hidden sm:max-h-none sm:overflow-visible sm:pb-0"
            >
              {data.items.map((client) => (
                <li key={client.id} className="rounded-xl bg-surface p-4 shadow-lift">
                  <div className="flex items-start gap-3">
                    <ContactTile />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-ink">{client.name}</p>
                      <p className="truncate text-caption text-ink-3">
                        {hasContact(client) ? (client.email ?? client.phone) : 'No contact details'}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-line pt-3 text-label text-ink-2">
                    <span className="text-caption text-ink-3 tabular-nums">Added {addedOn(client.createdAt)}</span>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => viewClient(client)}
                      aria-haspopup="dialog"
                      aria-label={`View ${client.name}`}
                      className="ml-auto"
                    >
                      View
                    </Button>
                  </div>
                </li>
              ))}
            </ul>

            {/* Tablet and up: rows scroll inside the fixed-height panel; the header stays pinned. */}
            <div aria-busy={busy} className="hidden min-h-0 flex-1 overflow-y-auto overscroll-contain sm:block">
              <table className="w-full table-fixed text-left text-body">
                <thead className="sticky top-0 z-10 bg-surface text-caption font-medium text-ink-3">
                  <tr className="bg-canvas/60 shadow-[inset_0_-1px_0_var(--line-strong)]">
                    <th scope="col" className="w-[26%] px-4 py-2.5 font-medium">
                      Name
                    </th>
                    <th scope="col" className="w-[27%] px-4 py-2.5 font-medium">
                      Email
                    </th>
                    <th scope="col" className="w-[19%] px-4 py-2.5 font-medium">
                      Phone
                    </th>
                    <th scope="col" className="w-[16%] px-4 py-2.5 font-medium whitespace-nowrap">
                      Added
                    </th>
                    <th scope="col" className="w-24 px-4 py-2.5 text-right font-medium whitespace-nowrap">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((client) => (
                    <tr key={client.id} className="border-b border-line">
                      <td className="max-w-0 px-4 py-3">
                        <div className="flex items-center gap-3">
                          <ContactTile />
                          <p className="truncate font-medium text-ink">{client.name}</p>
                        </div>
                      </td>
                      <td className="max-w-0 px-4 py-3">
                        <p className="truncate text-ink-2" title={client.email ?? undefined}>
                          {client.email ?? <span className="text-ink-3">—</span>}
                        </p>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-ink-2">
                        {client.phone ?? <span className="text-ink-3">—</span>}
                      </td>
                      <td className="px-4 py-3 text-label whitespace-nowrap text-ink-2 tabular-nums">
                        {addedOn(client.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => viewClient(client)}
                          aria-haspopup="dialog"
                          aria-label={`View ${client.name}`}
                        >
                          View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.total === 0 && (
              <div className="px-4 py-6 text-center text-label text-ink-3">
                No clients yet. Add your first client to start your directory.
              </div>
            )}
            {/* Footer: pinned to the bottom of the panel; the rows above it scroll. */}
            <Pagination
              page={data.page}
              totalPages={data.totalPages}
              total={data.total}
              pageSize={data.pageSize}
              onPageChange={goTo}
              busy={busy}
              noun={data.total === 1 ? 'client' : 'clients'}
              className="fixed inset-x-0 bottom-0 z-20 border-t border-line-strong bg-surface/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-sm sm:static sm:z-auto sm:shrink-0 sm:bg-canvas/60 sm:py-2.5 sm:backdrop-blur-none"
            />
          </>
        )}
      </div>

      <AddClientDialog open={adding} onOpenChange={setAdding} />
      <ClientImportModal open={importing} onOpenChange={setImporting} />
      <SearchClientsDialog open={searching} onOpenChange={setSearching} onSelect={viewClient} />
      <ClientDetailsDrawer key={viewing?.id ?? 'closed'} client={viewing} onClose={() => setPicked(null)} />
    </div>
  )
}

/** Clients have no avatar; a small contact tile keeps the rows aligned. */
function ContactTile() {
  return (
    <span
      aria-hidden
      className="grid size-8 shrink-0 place-items-center rounded-md bg-secondary-soft text-secondary-text"
    >
      <Contact size={16} strokeWidth={1.9} />
    </span>
  )
}

/** Add client entry points: the form now, spreadsheet import later. */
function AddClientMenu({ onForm, onImport }: { onForm: () => void; onImport: () => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <Button
        variant="primary"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Add client"
        title="Add client"
        className="w-9 px-0! sm:w-auto sm:px-3.5!"
      >
        <UserPlus size={16} strokeWidth={2} className="shrink-0" aria-hidden />
        <span className="hidden sm:inline">Add client</span>
        <ChevronDown size={14} strokeWidth={2} className="hidden shrink-0 sm:inline" aria-hidden />
      </Button>
      {open && (
        <div
          role="menu"
          aria-label="Add client options"
          className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-lg bg-surface py-1 shadow-dialog"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              onForm()
            }}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-body text-ink-2 hover:bg-surface-hover hover:text-ink"
          >
            <Pencil size={15} strokeWidth={1.9} aria-hidden />
            Form
          </button>
          <div className="my-1 border-t border-line" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              onImport()
            }}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-body text-ink-2 hover:bg-surface-hover hover:text-ink"
          >
            <FileSpreadsheet size={15} strokeWidth={1.9} aria-hidden />
            Imports
          </button>
        </div>
      )}
    </div>
  )
}
