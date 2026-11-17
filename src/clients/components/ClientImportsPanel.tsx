import { useQuery } from '@tanstack/react-query'
import { FileSpreadsheet } from 'lucide-react'
import { Button } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'
import { Loader } from '@/components/Loader'
import { clientImportsQuery, type ClientImport } from '@/lib/clients'

const dateFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
/** "16 Nov 2026" in the viewer's locale. */
const importedOn = (iso: string) => dateFormat.format(new Date(iso))

/** The Imports tab: one card per import, opening its clients in the Clients tab. */
export function ClientImportsPanel({ onViewRows }: { onViewRows: (item: ClientImport) => void }) {
  const { data, isPending, isError, refetch } = useQuery(clientImportsQuery())

  return (
    <div className="mt-4">
      {isPending ? (
        <div className="grid min-h-64 place-items-center">
          <Loader label="Loading imports" />
        </div>
      ) : isError ? (
        <div className="grid min-h-64 place-items-center px-4 text-center">
          <div>
            <p className="text-body text-ink-2">Couldn’t load your imports.</p>
            <Button size="sm" variant="secondary" className="mt-3" onClick={() => void refetch()}>
              Try again
            </Button>
          </div>
        </div>
      ) : !data.length ? (
        <EmptyState
          icon={FileSpreadsheet}
          title="No imports yet"
          description="Imports of client spreadsheets will appear here, with a record of every row."
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {data.map((item) => (
            <li key={item.id} className="overflow-hidden rounded-xl bg-surface shadow-lift">
              <div className="border-b border-line bg-canvas/60 px-4 py-3">
                <p className="truncate text-title font-semibold text-ink">{item.name}</p>
                <p className="mt-0.5 truncate text-caption text-ink-3" title={item.fileName}>
                  {item.fileName}
                </p>
              </div>
              <div className="px-4 py-3.5">
                <dl className="grid grid-cols-3 gap-2">
                  <div>
                    <dt className="text-caption text-ink-3">Rows</dt>
                    <dd className="text-body font-medium text-ink tabular-nums">{item.rowCount}</dd>
                  </div>
                  <div>
                    <dt className="text-caption text-ink-3">Added</dt>
                    <dd className="text-body font-medium text-ink tabular-nums">{item.createdCount}</dd>
                  </div>
                  <div>
                    <dt className="text-caption text-ink-3">Skipped</dt>
                    <dd className="text-body font-medium text-ink tabular-nums">{item.skippedCount}</dd>
                  </div>
                </dl>
                <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3">
                  <span className="text-caption text-ink-3 tabular-nums">{importedOn(item.createdAt)}</span>
                  <Button size="sm" variant="secondary" onClick={() => onViewRows(item)}>
                    View rows
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
