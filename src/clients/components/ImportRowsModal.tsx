import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/Button'
import { Loader } from '@/components/Loader'
import { Modal, ModalFooter } from '@/components/Modal'
import { clientImportQuery, type ClientImportRow } from '@/lib/clients'

function formatDetails(details: ClientImportRow['customDetails']): string {
  return Object.entries(details)
    .map(([key, value]) => `${key}: ${value == null ? '' : String(value)}`)
    .join(', ')
}

/** A reusable dialog for the stored rows of one import, loaded on open. */
export function ImportRowsModal({
  open,
  onOpenChange,
  importId,
  name,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  importId: string
  name: string
}) {
  const { data, isPending, isError, refetch } = useQuery({
    ...clientImportQuery(importId),
    enabled: open && !!importId,
  })

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      wide
      title={name || 'Import rows'}
      description="The client rows stored for this import."
    >
      <div className="max-h-[min(65vh,30rem)] overflow-auto px-5 pb-2">
        {isPending ? (
          <div className="grid place-items-center py-12">
            <Loader label="Loading rows" />
          </div>
        ) : isError ? (
          <div className="py-8 text-center">
            <p className="text-body text-ink-2">Couldn’t load these rows.</p>
            <Button size="sm" variant="secondary" className="mt-3" onClick={() => void refetch()}>
              Try again
            </Button>
          </div>
        ) : !data.rows.length ? (
          <p className="py-8 text-center text-body text-ink-2">No rows were stored for this import.</p>
        ) : (
          <table className="w-full min-w-[40rem] text-left text-label">
            <thead className="sticky top-0 bg-surface text-ink-3 shadow-[inset_0_-1px_0_var(--line)]">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium whitespace-nowrap">Name</th>
                <th scope="col" className="px-3 py-2 font-medium whitespace-nowrap">Email</th>
                <th scope="col" className="px-3 py-2 font-medium whitespace-nowrap">Phone</th>
                <th scope="col" className="px-3 py-2 font-medium whitespace-nowrap">Custom details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.rows.map((row, index) => {
                const details = formatDetails(row.customDetails)
                return (
                  <tr key={index} className="text-ink-2">
                    <td className="px-3 py-2 whitespace-nowrap">{row.name || '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{row.email || '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{row.phone || '—'}</td>
                    <td className="px-3 py-2" title={details || undefined}>
                      {details || <span className="text-ink-3">—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
      <ModalFooter>
        <Button variant="secondary" onClick={() => onOpenChange(false)}>
          Close
        </Button>
      </ModalFooter>
    </Modal>
  )
}
