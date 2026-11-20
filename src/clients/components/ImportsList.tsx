import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { Check, FileSpreadsheet, Loader2, Search } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/Button'
import { Loader } from '@/components/Loader'
import { clientImportIdsQuery, clientImportsSearchQuery } from '@/lib/clients'
import { useDebouncedValue } from '@/lib/use-debounced-value'

const number = new Intl.NumberFormat()

/** Whole imports: ticking one adds every client it brought in, across all pages. */
export function ImportsList({
  active,
  session,
  selected,
  onAdd,
  onRemove,
}: {
  /** Folded open: only then are the imports loaded. */
  active: boolean
  /** Changes on every opening: a fresh server fetch from page 1. */
  session: number
  selected: ReadonlySet<string>
  onAdd: (ids: string[]) => void
  onRemove: (ids: string[]) => void
}) {
  const queryClient = useQueryClient()
  const [q, setQ] = useState('')
  const term = q.trim()
  const debounced = useDebouncedValue(term, 250)
  // Searched and paged on the server; only imports that still have clients.
  const imports = useInfiniteQuery({ ...clientImportsSearchQuery(debounced, session), enabled: active })
  const withClients = imports.data?.pages.flatMap((page) => page.items) ?? []
  const total = imports.data?.pages[0]?.total ?? 0
  /** Ids already fetched per import, so its tick can show and a second click can untick it. */
  const [idsByImport, setIdsByImport] = useState<Record<string, string[]>>({})
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [failedId, setFailedId] = useState<string | null>(null)

  async function toggle(importId: string) {
    setFailedId(null)
    let ids = idsByImport[importId]
    if (!ids) {
      setLoadingId(importId)
      try {
        ids = await queryClient.fetchQuery(clientImportIdsQuery(importId))
        setIdsByImport((current) => ({ ...current, [importId]: ids! }))
      } catch {
        setFailedId(importId)
        return
      } finally {
        setLoadingId(null)
      }
    }
    if (ids.length && ids.every((id) => selected.has(id))) onRemove(ids)
    else onAdd(ids)
  }

  return (
    <div className="mx-2 mb-1.5 rounded-lg bg-canvas/60 ring-1 ring-line">
      <div className="border-b border-line p-1.5">
        <label className="relative block">
          <span className="sr-only">Search imports</span>
          <Search
            size={14}
            strokeWidth={2}
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-3"
          />
          <input
            type="search"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Search imports…"
            className="field-input h-8 pl-7 text-label"
          />
        </label>
      </div>
      <div className="max-h-56 overflow-y-auto py-1" aria-busy={imports.isFetching || undefined}>
        {imports.isPending ? (
          <div className="grid place-items-center py-6">
            <Loader label="Loading imports" />
          </div>
        ) : imports.isError ? (
          <div className="px-3 py-4 text-center">
            <p className="text-caption text-ink-2">Couldn’t load your imports.</p>
            <Button size="sm" variant="secondary" className="mt-2" onClick={() => void imports.refetch()}>
              Try again
            </Button>
          </div>
        ) : withClients.length === 0 ? (
          <p className="px-3 py-4 text-center text-caption text-ink-3">
            {debounced ? `No import matches “${debounced}”.` : 'No imports with clients yet.'}
          </p>
        ) : (
          <>
          <ul aria-label="Imports">
            {withClients.map((item) => {
              const ids = idsByImport[item.id]
              const checked = Boolean(ids?.length && ids.every((id) => selected.has(id)))
              const loading = loadingId === item.id
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={checked}
                    aria-busy={loading || undefined}
                    disabled={loadingId !== null}
                    onClick={() => void toggle(item.id)}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-surface-hover disabled:cursor-progress"
                  >
                    {loading ? (
                      <Loader2 size={16} className="shrink-0 animate-spin text-ink-3" aria-hidden />
                    ) : (
                      <Tick checked={checked} />
                    )}
                    <FileSpreadsheet size={15} strokeWidth={2} aria-hidden className="shrink-0 text-ink-3" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-label font-medium text-ink">{item.name}</span>
                      <span className="block text-caption text-ink-3 tabular-nums">
                        {failedId === item.id
                          ? 'Couldn’t load its clients. Try again.'
                          : `${number.format(item.createdCount)} ${item.createdCount === 1 ? 'client' : 'clients'}`}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
          {imports.hasNextPage ? (
            <div className="px-2 pt-1 pb-1.5">
              <Button
                size="sm"
                variant="secondary"
                className="w-full"
                loading={imports.isFetchingNextPage}
                onClick={() => void imports.fetchNextPage()}
              >
                Load more{' '}
                <span className="text-ink-3 tabular-nums">
                  ({number.format(withClients.length)} of {number.format(total)})
                </span>
              </Button>
            </div>
          ) : null}
          </>
        )}
      </div>
    </div>
  )
}

/** The square tick used for search results and imports. */
export function Tick({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden
      className={`grid size-4 shrink-0 place-items-center rounded border transition-colors duration-press ${
        checked ? 'border-secondary bg-secondary text-on-secondary' : 'border-line-strong bg-surface text-transparent'
      }`}
    >
      <Check size={11} strokeWidth={3} />
    </span>
  )
}
