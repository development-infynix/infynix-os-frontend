import { useState } from 'react'
import { Button } from '@/components/Button'
import { FormField } from '@/components/FormField'
import { Modal, ModalFooter } from '@/components/Modal'
import type { CrmDeal } from '../types'

interface AddDealDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Where the new deal lands, shown in the description. */
  stageName: string
  onAdd: (deal: Omit<CrmDeal, 'id' | 'addedAt'>) => void
}

interface FieldErrors {
  name?: string
  email?: string
}

/** Adds a new client as a deal in the pipeline's first stage. Local only until the API exists. */
export function AddDealDialog({ open, onOpenChange, stageName, onAdd }: AddDealDialogProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})

  function close() {
    setName('')
    setEmail('')
    setPhone('')
    setErrors({})
    onOpenChange(false)
  }

  function save() {
    const next: FieldErrors = {}
    if (!name.trim()) next.name = 'Enter their name'
    if (email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim())) {
      next.email = 'Enter a valid email, like name@company.com'
    } else if (!email.trim() && !phone.trim()) {
      next.email = 'Enter an email or a phone number'
    }
    setErrors(next)
    if (Object.keys(next).length) return
    onAdd({ name: name.trim(), email: email.trim() || null, phone: phone.trim() || null })
    close()
  }

  return (
    <Modal
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
      title="Add a deal"
      description={`A new client, added to ${stageName}.`}
    >
      <form
        noValidate
        className="flex flex-col"
        onSubmit={(event) => {
          event.preventDefault()
          save()
        }}
      >
        <div className="flex flex-col gap-4 px-5 pt-4">
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
        </div>
        <ModalFooter>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            Add deal
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  )
}
