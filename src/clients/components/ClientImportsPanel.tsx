import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/Button'
import { Loader } from '@/components/Loader'
import { clientImportsQuery, type ClientImport } from '@/lib/clients'
import { ClientImportCard } from './ClientImportCard'
import { ImportsEmpty } from './ImportsEmpty'

/** The Imports tab: one card per import, opening its clients in the Clients tab. */
export function ClientImportsPanel({
  onViewRows,
  onImport,
  onMoveToCrm,
}: {
  onViewRows: (item: ClientImport) => void
  /** Move an import's clients to a pipeline; absent without CRM access. */
  onMoveToCrm?: (item: ClientImport, clientIds: string[]) => void
  /** Opens the spreadsheet import, from the empty state's drawing. */
  onImport?: () => void
}) {
  const { data, isPending, isError, refetch } = useQuery(clientImportsQuery())

  return (
    <div className="flex flex-1 flex-col">
      {isPending ? (
        <div className="grid min-h-64 flex-1 place-items-center">
          <Loader label="Loading imports" />
        </div>
      ) : isError ? (
        <div className="grid min-h-64 flex-1 place-items-center px-4 text-center">
          <div>
            <p className="text-body text-ink-2">Couldn’t load your imports.</p>
            <Button size="sm" variant="secondary" className="mt-3" onClick={() => void refetch()}>
              Try again
            </Button>
          </div>
        </div>
      ) : !data.length ? (
        <ImportsEmpty onImport={onImport} />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {data.map((item) => (
            <ClientImportCard key={item.id} item={item} onViewRows={onViewRows} onMoveToCrm={onMoveToCrm} />
          ))}
        </ul>
      )}
    </div>
  )
}
