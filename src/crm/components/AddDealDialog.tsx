import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Button } from '@/components/Button'
import { FormError, FormField } from '@/components/FormField'
import { Modal, ModalFooter } from '@/components/Modal'
import { ApiError } from '@/lib/api'
import { CLIENTS_KEY, emptyDetailRows, rowsToDetails, type CustomDetailRow } from '@/lib/clients'
import { createCrmDeal, CRM_KEY } from '@/lib/crm'
import { CustomDetailsEditor } from '@/clients/components/CustomDetailsEditor'
import type { CrmDeal } from '../types'

interface AddDealDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pipelineId: string
  pipelineName: string
  /** The current pipeline's first stage; the server would default to it anyway. */
  stageId?: string
  stageName: string
  onAdded: (deal: CrmDeal) => void
}

interface FieldErrors {
  name?: string
  email?: string
}

/**
 * Adds a deal to the current pipeline. The fields are the add-client form's:
 * the server creates the client record and the CRM deal in one transaction.
 */
export function AddDealDialog({
  open,
  onOpenChange,
  pipelineId,
  pipelineName,
  stageId,
  stageName,
  onAdded,
}: AddDealDialogProps) {
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
      const deal = await createCrmDeal({
        pipelineId,
        stageId,
        name: name.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        customDetails: rowsToDetails(details),
      })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: CRM_KEY }),
        queryClient.invalidateQueries({ queryKey: CLIENTS_KEY }),
      ])
      onAdded(deal)
      close()
    } catch (caught) {
      setServerError(
        caught instanceof ApiError && caught.status !== 500
          ? caught.message
          : 'Couldn’t add this deal. Try again.',
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
      title="Add a deal"
      description={`Creates a client and adds them to ${pipelineName} › ${stageName}.`}
    >
      <form
        noValidate
        className="flex max-h-[min(64vh,32rem)] flex-col overflow-hidden"
        onSubmit={(event) => {
          event.preventDefault()
          void save()
        }}
      >
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 pt-4">
          <FormError message={serverError} />
          <FormField label="Name" htmlFor="add-deal-name" error={errors.name}>
            <input
              id="add-deal-name"
              autoFocus
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              aria-invalid={!!errors.name}
              className="field-input"
            />
          </FormField>
          <FormField label="Email" htmlFor="add-deal-email" error={errors.email}>
            <input
              id="add-deal-email"
              type="email"
              inputMode="email"
              autoComplete="off"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={!!errors.email}
              className="field-input"
            />
          </FormField>
          <FormField label="Phone" htmlFor="add-deal-phone">
            <input
              id="add-deal-phone"
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
            {saving ? 'Adding…' : 'Add deal'}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  )
}
