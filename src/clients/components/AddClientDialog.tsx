import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Button } from '@/components/Button'
import { FormError, FormField } from '@/components/FormField'
import { Modal, ModalFooter } from '@/components/Modal'
import { ApiError } from '@/lib/api'
import { addClient, CLIENTS_KEY, emptyDetailRows, rowsToDetails, type CustomDetailRow } from '@/lib/clients'
import { CustomDetailsEditor } from './CustomDetailsEditor'

interface AddClientDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface FieldErrors {
  name?: string
  email?: string
}

/** Adds a client to the directory: a name, at least one way to reach them, and optional details. */
export function AddClientDialog({ open, onOpenChange }: AddClientDialogProps) {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [details, setDetails] = useState<CustomDetailRow[]>(emptyDetailRows)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function close() {
    setName('')
    setEmail('')
    setPhone('')
    setDetails(emptyDetailRows())
    setErrors({})
    setServerError(null)
    onOpenChange(false)
  }

  async function save() {
    const next: FieldErrors = {}
    if (!name.trim()) next.name = 'Enter their name'
    if (email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim())) {
      next.email = 'Enter a valid email, like name@company.com'
    } else if (!email.trim() && !phone.trim()) {
      next.email = 'Enter an email or a phone number'
    }
    setErrors(next)
    if (Object.keys(next).length) return

    setSaving(true)
    setServerError(null)
    try {
      await addClient({
        name: name.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        customDetails: rowsToDetails(details),
      })
      await queryClient.invalidateQueries({ queryKey: CLIENTS_KEY })
      close()
    } catch (error) {
      setServerError(
        error instanceof ApiError && error.status !== 500 ? error.message : 'Couldn’t add them. Try again.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
      busy={saving}
      title="Add a client"
      description="Contact details and custom fields in one place."
    >
      <form
        noValidate
        className="flex max-h-[min(60vh,28rem)] flex-col overflow-hidden"
        onSubmit={(event) => {
          event.preventDefault()
          void save()
        }}
      >
        <div         className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 pt-4">
          <FormError message={serverError} />
          <FormField label="Name" htmlFor="add-client-name" error={errors.name}>
            <input
              id="add-client-name"
              autoFocus
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              aria-invalid={!!errors.name}
              className="field-input"
            />
          </FormField>
          <FormField label="Email" htmlFor="add-client-email" error={errors.email}>
            <input
              id="add-client-email"
              type="email"
              inputMode="email"
              autoComplete="off"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={!!errors.email}
              className="field-input"
            />
          </FormField>
          <FormField label="Phone" htmlFor="add-client-phone">
            <input
              id="add-client-phone"
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
        <ModalFooter>
          <Button variant="secondary" onClick={close} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={saving}>
            {saving ? 'Adding…' : 'Add client'}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  )
}
