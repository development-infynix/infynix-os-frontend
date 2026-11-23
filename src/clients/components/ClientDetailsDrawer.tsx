import { useQueryClient } from '@tanstack/react-query'
import { Pencil, Trash2, X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { AlertDialog } from '@/components/Alert'
import { Button } from '@/components/Button'
import { Detail, Muted, Panel } from '@/components/DetailPanel'
import { showDetailValue } from '@/lib/detail-value'
import { FormError, FormField } from '@/components/FormField'
import { ApiError } from '@/lib/api'
import {
  CLIENTS_KEY,
  clientQuery,
  detailsToRows,
  emptyDetailRows,
  removeClient,
  rowsToDetails,
  updateClient,
  type Client,
  type CustomDetailRow,
} from '@/lib/clients'
import { CustomDetailsEditor } from './CustomDetailsEditor'

interface ClientDetailsDrawerProps {
  /** The client to show; `null` closes the drawer. */
  client: Client | null
  onClose: () => void
}

interface FieldErrors {
  name?: string
  email?: string
}

const dateFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

/** A client in a right-side sheet: contact facts and custom details, with Edit and Delete below. */
export function ClientDetailsDrawer({ client, onClose }: ClientDetailsDrawerProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [details, setDetails] = useState<CustomDetailRow[]>(emptyDetailRows)

  const open = !!client
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      dialog.focus()
    } else if (!open && dialog.open) dialog.close()
  }, [open])

  function close() {
    if (saving) return
    setEditing(false)
    setError(null)
    setFieldErrors({})
    onClose()
  }

  function startEditing() {
    if (!client) return
    setName(client.name)
    setEmail(client.email ?? '')
    setPhone(client.phone ?? '')
    setDetails(detailsToRows(client.customDetails))
    setError(null)
    setFieldErrors({})
    setEditing(true)
  }

  async function save() {
    if (!client) return
    const next: FieldErrors = {}
    if (!name.trim()) next.name = 'Enter their name'
    if (email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim())) {
      next.email = 'Enter a valid email, like name@company.com'
    } else if (!email.trim() && !phone.trim()) {
      next.email = 'Enter an email or a phone number'
    }
    setFieldErrors(next)
    if (Object.keys(next).length) return

    setSaving(true)
    setError(null)
    try {
      await updateClient(client.id, {
        name: name.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        customDetails: rowsToDetails(details),
      })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: CLIENTS_KEY }),
        queryClient.invalidateQueries({ queryKey: clientQuery(client.id).queryKey }),
      ])
      setEditing(false)
    } catch (cause) {
      setError(cause instanceof ApiError && cause.status !== 500 ? cause.message : 'Couldn’t save. Try again.')
    } finally {
      setSaving(false)
    }
  }

  const entries = client ? Object.entries(client.customDetails) : []

  return (
    <>
      <dialog
        ref={ref}
        aria-labelledby={titleId}
        onCancel={(event) => {
          // A dialog opened inside this one (a confirmation) sends its own close/cancel up through React: ignore it.
          if (event.target !== event.currentTarget) return
          event.preventDefault()
          close()
        }}
        onKeyDown={(event) => event.key === 'Escape' && event.stopPropagation()}
        onClick={(event) => event.target === event.currentTarget && close()}
        tabIndex={-1}
        className="app-drawer w-full max-w-sheet border-0 bg-surface p-0 text-ink shadow-dialog outline-none"
      >
        {client && (
          <div className="flex h-full flex-col">
            <div className="flex items-center gap-2 border-b border-line px-4 py-3.5">
              <h2 id={titleId} className="min-w-0 flex-1 truncate text-title font-semibold tracking-title">
                {client.name}
              </h2>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="grid size-9 shrink-0 place-items-center rounded-md text-ink-3 hover:bg-surface-hover hover:text-ink"
              >
                <X size={18} strokeWidth={1.9} />
              </button>
            </div>

            {editing ? (
              <form
                noValidate
                onSubmit={(event) => {
                  event.preventDefault()
                  void save()
                }}
                className="flex min-h-0 flex-1 flex-col"
              >
                <div className="flex flex-1 flex-col gap-4 overflow-y-auto bg-canvas px-5 py-5">
                  <FormError message={error} />
                  <FormField label="Name" htmlFor="edit-client-name" error={fieldErrors.name}>
                    <input
                      id="edit-client-name"
                      autoFocus
                      autoComplete="name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      aria-invalid={!!fieldErrors.name}
                      className="field-input"
                    />
                  </FormField>
                  <FormField label="Email" htmlFor="edit-client-email" error={fieldErrors.email}>
                    <input
                      id="edit-client-email"
                      type="email"
                      inputMode="email"
                      autoComplete="off"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      aria-invalid={!!fieldErrors.email}
                      className="field-input"
                    />
                  </FormField>
                  <FormField label="Phone" htmlFor="edit-client-phone">
                    <input
                      id="edit-client-phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      className="field-input"
                    />
                  </FormField>
                  <CustomDetailsEditor rows={details} onChange={setDetails} disabled={saving} />
                </div>
                <div className="flex justify-end gap-2 border-t border-line bg-canvas/60 px-5 py-3.5">
                  <Button variant="secondary" onClick={() => setEditing(false)} disabled={saving}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" loading={saving}>
                    {saving ? 'Saving…' : 'Save changes'}
                  </Button>
                </div>
              </form>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="flex-1 overflow-y-auto bg-canvas px-4 py-4">
                  <Panel title="Account">
                    <Detail label="Name">{client.name}</Detail>
                    <Detail label="Email">
                      {client.email ? <span className="break-all">{client.email}</span> : <Muted>Not provided</Muted>}
                    </Detail>
                    <Detail label="Phone">
                      {client.phone ? <span>{client.phone}</span> : <Muted>Not provided</Muted>}
                    </Detail>
                    <Detail label="Added">
                      <span className="tabular-nums">{dateFormat.format(new Date(client.createdAt))}</span>
                    </Detail>
                    <Detail label="Updated">
                      <span className="tabular-nums">{dateFormat.format(new Date(client.updatedAt))}</span>
                    </Detail>
                  </Panel>
                  <Panel title="Custom details" className="mt-4">
                    {entries.length ? (
                      entries.map(([key, value]) => (
                        <Detail key={key} label={key}>
                          {showDetailValue(value)}
                        </Detail>
                      ))
                    ) : (
                      <p className="px-3.5 py-4 text-label text-ink-3">No custom details yet. Edit to add some.</p>
                    )}
                  </Panel>
                </div>
                <div className="flex items-center gap-2 border-t border-line bg-canvas/60 px-5 py-3.5">
                  <Button variant="primary" onClick={startEditing} className="ml-auto">
                    <Pencil size={15} strokeWidth={2} aria-hidden />
                    Edit
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setConfirmDelete(true)}
                    aria-label={`Delete ${client.name}`}
                    title="Delete client"
                    className="w-9 px-0! text-danger"
                  >
                    <Trash2 size={16} strokeWidth={2} className="shrink-0" aria-hidden />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </dialog>

      <AlertDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        tone="danger"
        icon={null}
        width="compact"
        title={`Delete ${client?.name ?? 'this client'}?`}
        description="This removes the client from your directory, along with their deals in every CRM pipeline. This can’t be undone."
        confirmLabel="Delete"
        pendingLabel="Deleting…"
        onConfirm={async () => {
          if (!client) return
          await removeClient(client.id)
          await queryClient.invalidateQueries({ queryKey: CLIENTS_KEY })
          setEditing(false)
          onClose()
        }}
      />
    </>
  )
}
