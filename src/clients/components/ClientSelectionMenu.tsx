import { useQuery } from '@tanstack/react-query'
import { ChevronDown, Search } from 'lucide-react'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Button } from '@/components/Button'
import { ImportsList, Tick } from './ImportsList'
import { Loader } from '@/components/Loader'
import { clientsPageQuery } from '@/lib/clients'
import { useDebouncedValue } from '@/lib/use-debounced-value'

interface ClientSelectionMenuProps {
  selected: ReadonlySet<string>
  onChange: (next: Set<string>) => void
  /** Ids of the clients on the page being shown. */
  pageIds: string[]
}

const number = new Intl.NumberFormat()
const SEARCH_RESULTS = 6

/**
 * "Select (N)": grows or trims the selection without ticking rows one by one.
 * Search to add a client, take the whole page, or take whole imports (every
 * client from an import, across pages), or clear it all.
 */
export function ClientSelectionMenu({ selected, onChange, pageIds }: ClientSelectionMenuProps) {
  const [open, setOpen] = useState(false)
  /** "Select imports" folds its list open under the row. */
  const [importsOpen, setImportsOpen] = useState(false)
  /** Bumped every time the imports fold opens, so it fetches fresh from the server. */
  const [importsSession, setImportsSession] = useState(0)
  const [q, setQ] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelId = useId()
  const importsId = useId()

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      triggerRef.current?.focus()
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function toggleMenu() {
    if (!open) {
      setImportsOpen(false)
      setQ('')
    }
    setOpen(!open)
  }

  function add(ids: string[]) {
    const next = new Set(selected)
    for (const id of ids) next.add(id)
    onChange(next)
  }

  function remove(ids: string[]) {
    const next = new Set(selected)
    for (const id of ids) next.delete(id)
    onChange(next)
  }

  const pageAllSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id))

  return (
    <div ref={ref} className="relative">
      <Button
        ref={triggerRef}
        variant="secondary"
        onClick={toggleMenu}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={`Selection: ${selected.size} selected`}
        className="shrink-0 gap-1.5 whitespace-nowrap px-3!"
      >
        <span className="hidden sm:inline">Select</span>
        <span className="tabular-nums">
          <span className="hidden sm:inline">(</span>
          {number.format(selected.size)}
          <span className="hidden sm:inline">)</span>
        </span>
        <ChevronDown
          size={15}
          strokeWidth={2}
          aria-hidden
          className={`transition-transform duration-press ${open ? 'rotate-180' : ''}`}
        />
      </Button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label="Change the selection"
          className="absolute right-0 z-30 mt-1.5 w-[min(20rem,calc(100vw-2.5rem))] overflow-hidden rounded-xl bg-surface shadow-dialog"
        >
          <SearchToAdd q={q} onQ={setQ} selected={selected} onAdd={add} onRemove={remove} />
          <div className="border-t border-line py-1">
            <MenuRow onClick={() => (pageAllSelected ? remove(pageIds) : add(pageIds))} disabled={pageIds.length === 0}>
              <span className="flex-1">
                {pageAllSelected ? 'Deselect this page' : 'Select this page'}{' '}
                <span className="text-ink-3 tabular-nums">({number.format(pageIds.length)})</span>
              </span>
            </MenuRow>
            <button
              type="button"
              onClick={() => {
                if (!importsOpen) setImportsSession((current) => current + 1)
                setImportsOpen(!importsOpen)
              }}
              aria-expanded={importsOpen}
              aria-controls={importsId}
              className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-body text-ink hover:bg-surface-hover"
            >
              <span className="flex-1">Select imports</span>
              <ChevronDown
                size={16}
                strokeWidth={2}
                aria-hidden
                className={`text-ink-3 transition-transform duration-enter ease-out-expo ${importsOpen ? 'rotate-180' : ''}`}
              />
            </button>
            {/* The imports fold open under the row (grid rows 0fr → 1fr). */}
            <div
              id={importsId}
              className={`grid transition-[grid-template-rows] duration-enter ease-out-expo ${
                importsOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
              }`}
              inert={!importsOpen}
            >
              <div className="min-h-0 overflow-hidden">
                <ImportsList
                  active={importsOpen}
                  session={importsSession}
                  selected={selected}
                  onAdd={add}
                  onRemove={remove}
                />
              </div>
            </div>
          </div>
          <div className="border-t border-line py-1">
            <MenuRow onClick={() => onChange(new Set())} disabled={selected.size === 0} muted>
              Clear selection
            </MenuRow>
          </div>
        </div>
      )}
    </div>
  )
}

/** Search the directory and tick clients into (or out of) the selection. */
function SearchToAdd({
  q,
  onQ,
  selected,
  onAdd,
  onRemove,
}: {
  q: string
  onQ: (value: string) => void
  selected: ReadonlySet<string>
  onAdd: (ids: string[]) => void
  onRemove: (ids: string[]) => void
}) {
  const term = q.trim()
  const debounced = useDebouncedValue(term, 250)
  const results = useQuery({ ...clientsPageQuery(1, debounced), enabled: Boolean(debounced) })
  const items = (results.data?.items ?? []).slice(0, SEARCH_RESULTS)

  return (
    <div className="p-2.5">
      <label className="relative block">
        <span className="sr-only">Search clients to add</span>
        <Search
          size={15}
          strokeWidth={2}
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-3"
        />
        <input
          type="search"
          autoFocus
          value={q}
          onChange={(event) => onQ(event.target.value)}
          placeholder="Search clients to add…"
          className="field-input h-9 pl-8"
        />
      </label>
      {term && (
        <div className="mt-1.5" aria-live="polite">
          {results.isFetching && !items.length ? (
            <div className="grid place-items-center py-3">
              <Loader label="Searching clients" />
            </div>
          ) : !items.length ? (
            <p className="px-1 py-2 text-caption text-ink-3">No client matches “{term}”.</p>
          ) : (
            <ul className="flex flex-col" aria-label="Matching clients">
              {items.map((client) => {
                const checked = selected.has(client.id)
                return (
                  <li key={client.id}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={checked}
                      onClick={() => (checked ? onRemove([client.id]) : onAdd([client.id]))}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-surface-hover"
                    >
                      <Tick checked={checked} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-label font-medium text-ink">{client.name}</span>
                        <span className="block truncate text-caption text-ink-3">
                          {client.email ?? client.phone ?? 'No contact'}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

function MenuRow({
  onClick,
  disabled = false,
  muted = false,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  muted?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-2 px-3.5 py-2 text-left text-body hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent ${
        muted ? 'text-ink-3 hover:text-ink' : 'text-ink'
      }`}
    >
      {children}
    </button>
  )
}
