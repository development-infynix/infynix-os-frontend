import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, ChevronDown, Contact, FileSpreadsheet, Filter, Pencil, Search, Trash2, UserPlus } from 'lucide-react'
import { MdKeyboardDoubleArrowRight } from 'react-icons/md'
import { getRouteApi } from '@tanstack/react-router'
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react'
import { AlertDialog } from '@/components/Alert'
import { Button } from '@/components/Button'
import { Loader } from '@/components/Loader'
import { Pagination } from '@/components/Pagination'
import {
  CLIENTS_KEY,
  CLIENT_IMPORTS_KEY,
  clientImportsQuery,
  clientQuery,
  clientsPageQuery,
  hasContact,
  removeClient,
  removeClientsInChunks,
  type Client,
} from '@/lib/clients'
import { hasAccess } from '@/lib/access'
import { useSession } from '@/lib/auth'
import { AddClientDialog } from '../components/AddClientDialog'
import { ClientCrmModal } from '../components/ClientCrmModal'
import { ClientSelectionMenu } from '../components/ClientSelectionMenu'
import { ClientImportModal } from '../components/ClientImportModal'
import { ClientImportsPanel } from '../components/ClientImportsPanel'
import { ClientDetailsDrawer } from '../components/ClientDetailsDrawer'
import { ClientsEmpty } from '../components/ClientsEmpty'
import { SearchClientsDialog } from '../components/SearchClientsDialog'

const dateFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
/** "16 Nov 2026" in the viewer's locale. */
const addedOn = (iso: string) => dateFormat.format(new Date(iso))

const route = getRouteApi('/_authed/clients')
const TAB_STORAGE_KEY = 'infynix-clients-tab'

type Tab = 'clients' | 'imports'

/** Clients: everyone with menu access can browse, add and edit the directory. */
export function ClientsPage() {
  const page = route.useSearch({ select: (s) => s.page ?? 1 })
  const q = route.useSearch({ select: (s) => s.q ?? '' })
  const importFilter = route.useSearch({ select: (s) => s.importId ?? null })
  const navigate = route.useNavigate()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<Tab>(() =>
    localStorage.getItem(TAB_STORAGE_KEY) === 'imports' ? 'imports' : 'clients',
  )
  const [deleting, setDeleting] = useState<Client | null>(null)
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  /** The CRM button needs the CRM menu: the modal lists that person's pipelines. */
  const canUseCrm = hasAccess(useSession(), 'crm')
  const [addingToCrm, setAddingToCrm] = useState(false)
  /** Imports tab › Move to CRM: that import's clients, separate from the Clients tab selection. */
  const [importToCrm, setImportToCrm] = useState<string[] | null>(null)

  useEffect(() => {
    localStorage.setItem(TAB_STORAGE_KEY, tab)
  }, [tab])
  const tabsId = useId()
  const clientsTabId = `${tabsId}-clients-tab`
  const importsTabId = `${tabsId}-imports-tab`
  const clientsPanelId = `${tabsId}-clients-panel`
  const importsPanelId = `${tabsId}-imports-panel`

  function onTabKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const next: Tab =
      event.key === 'Home'
        ? 'clients'
        : event.key === 'End'
          ? 'imports'
          : tab === 'clients'
            ? 'imports'
            : 'clients'
    setTab(next)
    document.getElementById(next === 'clients' ? clientsTabId : importsTabId)?.focus()
  }
  const { data, isPending, isFetching, isError, isPlaceholderData, refetch } = useQuery({
    ...clientsPageQuery(page, q, importFilter),
    enabled: tab === 'clients',
  })
  const busy = isFetching && isPlaceholderData
  /** Nothing to list: the panel drops its table surface and shows the illustration. */
  const panelIsEmpty = !isPending && !busy && !isError && data?.total === 0
  /**
   * Nothing to search or filter yet, so those two buttons stay hidden in the
   * empty state; Add is still there, and the drawing opens it too. An active
   * search or import filter keeps them, or the empty list would be a dead end.
   */
  const showListTools = !panelIsEmpty || Boolean(q) || Boolean(importFilter)

  const goTo = (next: number) => void navigate({ search: { page: next, q, importId: importFilter ?? undefined } })
  const changeImportFilter = (value: string | null) =>
    void navigate({ search: { page: 1, q: '', importId: value ?? undefined } })

  const toggleSelected = (id: string) =>
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  // A page that no longer exists (the last client on it was deleted, or an old
  // link): go to the last page that does.
  useEffect(() => {
    if (data && page > data.totalPages) {
      void navigate({
        search: { page: Math.max(1, data.totalPages), q, importId: importFilter ?? undefined },
        replace: true,
      })
    }
  }, [data, page, q, importFilter, navigate])
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
      <div className="sticky top-header z-20 -mx-5 flex h-header items-center justify-between gap-2 border-b border-line bg-canvas/90 px-5 backdrop-blur-sm sm:static sm:mx-0 sm:h-auto sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        <div
          role="tablist"
          aria-label="Client sections"
          onKeyDown={onTabKeyDown}
          className="flex shrink-0 gap-1 rounded-xl bg-canvas p-1.5 shadow-well"
        >
          <TabButton
            id={clientsTabId}
            controls={clientsPanelId}
            selected={tab === 'clients'}
            onSelect={() => setTab('clients')}
          >
            Clients
          </TabButton>
          <TabButton
            id={importsTabId}
            controls={importsPanelId}
            selected={tab === 'imports'}
            onSelect={() => setTab('imports')}
          >
            Imports
          </TabButton>
        </div>
        <div className="flex items-center gap-2">
          {tab === 'clients' && selected.size > 0 ? (
            /* With a selection: Select (N) ▾, then CRM, then Delete. */
            <>
              <ClientSelectionMenu
                selected={selected}
                onChange={setSelected}
                pageIds={data?.items.map((client) => client.id) ?? []}
              />
              {canUseCrm && (
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => setAddingToCrm(true)}
                  aria-haspopup="dialog"
                  aria-label={`Add ${selected.size} selected ${selected.size === 1 ? 'client' : 'clients'} to a CRM pipeline`}
                  title="CRM"
                  className="flex shrink-0 items-center whitespace-nowrap px-3.5!"
                >
                  <span className="flex items-center gap-1 leading-none">
                    CRM
                    <MdKeyboardDoubleArrowRight className="hidden text-[1.15em] sm:block" aria-hidden />
                  </span>
                </Button>
              )}
              <Button
                variant="danger"
                onClick={() => setConfirmBulkDelete(true)}
                aria-label={`Delete ${selected.size} selected clients`}
                title={`Delete ${selected.size} selected clients`}
                className="w-9 shrink-0 px-0!"
              >
                <Trash2 size={16} strokeWidth={2} className="shrink-0" aria-hidden />
              </Button>
            </>
          ) : (
            <>
              {tab === 'clients' && showListTools && (
                <>
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
                  <ImportFilterMenu value={importFilter} onChange={changeImportFilter} />
                </>
              )}
              <AddClientMenu onForm={() => setAdding(true)} onImport={() => setImporting(true)} />
            </>
          )}
        </div>
      </div>

      {tab === 'clients' ? (
        <div
          id={clientsPanelId}
          role="tabpanel"
          aria-labelledby={clientsTabId}
          /* The surface, rounding and shadow belong to the table. With nothing
             to list they come off, so the empty state sits on the canvas
             instead of inside a container pretending to be a table. */
          className={`mt-4 flex flex-col sm:min-h-72 sm:flex-1 ${
            panelIsEmpty
              ? 'min-h-[60vh]'
              : 'min-h-[70vh] sm:overflow-hidden sm:rounded-xl sm:bg-surface sm:shadow-lift'
          }`}
        >
          {/* Phones: one card per client. Tablet and up: one panel holding the table. */}
          {/* Tablet and up: the panel takes all the height left, so only the table scrolls. */}
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
          ) : data.total === 0 ? (
            /* Nothing to list: no table headers, no empty rows, no pagination. */
            <ClientsEmpty
              onAdd={() => setAdding(true)}
              title={importFilter ? 'Nothing in this import' : q ? 'No clients match' : undefined}
              description={
                importFilter
                  ? 'No clients came from this import. Clear the filter to see your whole directory.'
                  : q
                    ? 'No client matches that search. Try another name, email or phone number.'
                    : undefined
              }
            />
          ) : (
            <>
              <ul
                aria-busy={busy}
                className="max-h-[calc(100dvh-11rem)] flex flex-col gap-3 overflow-y-auto overscroll-contain pb-20 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:hidden sm:max-h-none sm:overflow-visible sm:pb-0"
              >
                {data.items.map((client) => (
                  <li key={client.id} className="relative rounded-xl bg-surface p-4 shadow-lift">
                    <div className="absolute top-3 right-3">
                      <SelectClientButton
                        client={client}
                        selected={selected.has(client.id)}
                        onToggle={toggleSelected}
                      />
                    </div>
                    <div className="flex items-start gap-3 pr-8">
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
                      <div className="ml-auto flex items-center gap-2">
                        <DeleteClientButton client={client} onDelete={setDeleting} />
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => viewClient(client)}
                          aria-haspopup="dialog"
                          aria-label={`View ${client.name}`}
                        >
                          View
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              {/* Tablet and up: rows scroll inside the fixed-height panel; the header stays pinned. */}
              <div aria-busy={busy} className="hidden min-h-0 flex-1 overflow-y-auto overscroll-contain sm:block">
                <table className="w-full table-fixed text-left text-body">
                  <thead className="sticky top-0 z-10 bg-surface text-caption font-medium text-ink-3">
                    <tr className="bg-canvas/60 shadow-[inset_0_-1px_0_var(--line-strong)]">
                      <th scope="col" className="w-9 py-2.5 pl-4 pr-1">
                        <span className="sr-only">Select</span>
                      </th>
                      <th scope="col" className="w-[24%] px-4 py-2.5 font-medium">
                        Name
                      </th>
                      <th scope="col" className="w-[25%] px-4 py-2.5 font-medium">
                        Email
                      </th>
                      <th scope="col" className="w-[18%] px-4 py-2.5 font-medium">
                        Phone
                      </th>
                      <th scope="col" className="w-[15%] px-4 py-2.5 font-medium whitespace-nowrap">
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
                        <td className="py-3 pl-4 pr-1">
                          <SelectClientButton
                            client={client}
                            selected={selected.has(client.id)}
                            onToggle={toggleSelected}
                            compact
                          />
                        </td>
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
                          <div className="flex items-center justify-end gap-2">
                            <DeleteClientButton client={client} onDelete={setDeleting} />
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => viewClient(client)}
                              aria-haspopup="dialog"
                              aria-label={`View ${client.name}`}
                            >
                              View
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
      ) : (
        <div
          id={importsPanelId}
          role="tabpanel"
          aria-labelledby={importsTabId}
          /* Same height as the clients panel, so both empty states sit at the
             same place instead of one floating up under the tabs. */
          className="mt-4 flex min-h-[60vh] flex-col sm:min-h-72 sm:flex-1"
        >
          <ClientImportsPanel
            onImport={() => setImporting(true)}
            onViewRows={(item) => {
              changeImportFilter(item.id)
              setTab('clients')
            }}
            onMoveToCrm={canUseCrm ? (_item, ids) => setImportToCrm(ids) : undefined}
          />
        </div>
      )}

      <AddClientDialog open={adding} onOpenChange={setAdding} />
      <ClientCrmModal
        open={addingToCrm}
        onOpenChange={setAddingToCrm}
        clientIds={[...selected]}
        onDone={() => setSelected(new Set())}
      />
      <ClientCrmModal
        open={importToCrm !== null}
        onOpenChange={(open) => !open && setImportToCrm(null)}
        clientIds={importToCrm ?? []}
        onDone={() => {}}
      />
      <ClientImportModal open={importing} onOpenChange={setImporting} />
      <SearchClientsDialog open={searching} onOpenChange={setSearching} onSelect={viewClient} />
      <ClientDetailsDrawer key={viewing?.id ?? 'closed'} client={viewing} onClose={() => setPicked(null)} />
      <AlertDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        tone="danger"
        icon={null}
        width="compact"
        title={`Delete ${deleting?.name ?? 'this client'}?`}
        description="This removes the client from the directory, along with their deals in every CRM pipeline. This can’t be undone."
        confirmLabel="Delete"
        pendingLabel="Deleting…"
        onConfirm={async () => {
          if (!deleting) return
          await removeClient(deleting.id)
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: CLIENTS_KEY }),
            queryClient.invalidateQueries({ queryKey: CLIENT_IMPORTS_KEY }),
          ])
          setDeleting(null)
        }}
      />
      <AlertDialog
        open={confirmBulkDelete}
        onOpenChange={setConfirmBulkDelete}
        tone="danger"
        icon={null}
        width="compact"
        title={`Delete ${selected.size} clients?`}
        description="These clients are removed from the directory, along with their deals in every CRM pipeline. Import counts will be updated. This can’t be undone."
        confirmLabel="Delete"
        pendingLabel="Deleting…"
        onConfirm={async () => {
          // Selections can span pages and whole imports: delete in chunks of 500.
          await removeClientsInChunks([...selected])
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: CLIENTS_KEY }),
            queryClient.invalidateQueries({ queryKey: CLIENT_IMPORTS_KEY }),
          ])
          setSelected(new Set())
          setConfirmBulkDelete(false)
        }}
      />
    </div>
  )
}

/** Filters the client list by the import that created each row. */
function ImportFilterMenu({
  value,
  onChange,
}: {
  value: string | null
  onChange: (value: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { data: imports = [] } = useQuery({ ...clientImportsQuery(), enabled: open })

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

  const active = imports.find((item) => item.id === value)

  return (
    <div ref={ref} className="relative">
      <Button
        variant="secondary"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Filter clients by import"
        title={active ? `Import: ${active.name}` : 'Filter by import'}
        className="w-9 px-0!"
      >
        <Filter size={16} strokeWidth={2} aria-hidden />
      </Button>
      {open && (
        <ul
          role="listbox"
          aria-label="Filter clients by import"
          className="absolute right-0 z-20 mt-1 w-52 overflow-hidden rounded-lg bg-surface py-1 shadow-dialog"
        >
          <li role="presentation">
            <button
              type="button"
              role="option"
              aria-selected={!value}
              onClick={() => {
                onChange(null)
                setOpen(false)
              }}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-body ${
                value ? 'text-ink-2 hover:bg-surface-hover hover:text-ink' : 'bg-secondary-soft font-medium text-secondary-text'
              }`}
            >
              <span className="flex-1">All clients</span>
              {!value && <Check size={14} strokeWidth={2} aria-hidden />}
            </button>
          </li>
          {imports.length > 0 && (
            <li role="presentation" className="mt-1 border-t border-line pt-1">
              <p className="px-3 pb-1 text-caption text-ink-3">Imports</p>
              <ul>
                {imports.map((item) => (
                  <li key={item.id} role="presentation">
                    <button
                      type="button"
                      role="option"
                      aria-selected={value === item.id}
                      onClick={() => {
                        onChange(item.id)
                        setOpen(false)
                      }}
                      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-body ${
                        value === item.id
                          ? 'bg-secondary-soft font-medium text-secondary-text'
                          : 'text-ink-2 hover:bg-surface-hover hover:text-ink'
                      }`}
                    >
                      <span className="flex-1 truncate">{item.name}</span>
                      {value === item.id && <Check size={14} strokeWidth={2} aria-hidden />}
                    </button>
                  </li>
                ))}
              </ul>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}

/** Circular select control used in both the table and the mobile cards. */
function SelectClientButton({
  client,
  selected,
  onToggle,
  compact = false,
}: {
  client: Client
  selected: boolean
  onToggle: (id: string) => void
  compact?: boolean
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      aria-label={`Select ${client.name}`}
      onClick={() => onToggle(client.id)}
      className={`grid ${compact ? 'size-4' : 'size-5'} shrink-0 place-items-center rounded-full border transition-colors ${
        selected
          ? 'border-secondary bg-secondary text-on-secondary'
          : 'border-line-strong text-transparent hover:border-ink-3'
      }`}
    >
      <Check size={compact ? 10 : 12} strokeWidth={3} aria-hidden />
    </button>
  )
}

/** Icon-only delete action used in both the table and the mobile cards. */
function DeleteClientButton({ client, onDelete }: { client: Client; onDelete: (client: Client) => void }) {
  return (
    <Button
      size="sm"
      variant="secondary"
      onClick={() => onDelete(client)}
      aria-label={`Delete ${client.name}`}
      title="Delete client"
      className="w-8 px-0! text-danger"
    >
      <Trash2 size={15} strokeWidth={2} aria-hidden />
    </Button>
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

interface TabButtonProps {
  id: string
  controls: string
  selected: boolean
  onSelect: () => void
  children: ReactNode
}

/** One stop in the recessed control that switches between the two views. */
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
      className={`flex h-8 min-w-[6rem] items-center justify-center rounded-lg px-3 text-label transition-colors ${
        selected ? 'btn btn-primary' : 'font-medium text-ink-2 hover:bg-surface-hover hover:text-ink'
      }`}
    >
      {children}
    </button>
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
