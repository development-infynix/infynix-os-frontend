import { useQuery } from '@tanstack/react-query'
import { FileSpreadsheet } from 'lucide-react'
import { Button } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'
import { Loader } from '@/components/Loader'
import { clientImportsQuery, type ClientImport } from '@/lib/clients'
import { ClientImportCard } from './ClientImportCard'

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
            <ClientImportCard key={item.id} item={item} onViewRows={onViewRows} />
          ))}
        </ul>
      )}
    </div>
  )
}
