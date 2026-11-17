import { useForm } from '@tanstack/react-form'
import { useQueryClient } from '@tanstack/react-query'
import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import { z } from 'zod'
import { Button } from '@/components/Button'
import { FormError, FormField } from '@/components/FormField'
import { Modal, ModalFooter } from '@/components/Modal'
import { ApiError } from '@/lib/api'
import { ROLE_LABEL, type MemberRole } from '@/lib/auth'
import { addMember, MEMBERS_KEY } from '@/lib/members'
import { PASSWORD_HINT, strongPassword } from '@/lib/password-rules'

interface AddUserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  roles: MemberRole[]
}

const ROLE_HINT: Record<MemberRole, string> = {
  owner: 'Full control, including Admin',
  manager: 'Leads a team; no access to Admin',
  staff: 'Uses the app; no people management',
}

/** The owner creates an employee's account: name, email, password, role. */
export function AddUserDialog({ open, onOpenChange, roles }: AddUserDialogProps) {
  const queryClient = useQueryClient()
  const [serverError, setServerError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  const schema = z.object({
    fullName: z.string().trim().min(1, 'Enter their name').max(120),
    email: z.email('Enter a valid email, like name@company.com'),
    password: strongPassword,
    role: z.enum(roles as [MemberRole, ...MemberRole[]]),
  })

  const form = useForm({
    defaultValues: { fullName: '', email: '', password: '', role: roles.at(-1) ?? 'staff' } as {
      fullName: string
      email: string
      password: string
      role: MemberRole
    },
    validators: { onSubmit: schema },
    onSubmit: async ({ value }) => {
      setServerError(null)
      try {
        await addMember({ ...value, fullName: value.fullName.trim(), email: value.email.trim() })
        await queryClient.invalidateQueries({ queryKey: MEMBERS_KEY })
        close()
      } catch (error) {
        setServerError(error instanceof ApiError && error.status !== 500 ? error.message : 'Couldn’t add them. Try again.')
      }
    },
  })

  function close() {
    form.reset()
    setServerError(null)
    setShowPassword(false)
    onOpenChange(false)
  }

  const errorOf = (field: { state: { meta: { errors: ({ message?: string } | undefined)[] } } }) =>
    field.state.meta.errors[0]?.message

  return (
    <form.Subscribe selector={(s) => s.isSubmitting}>
      {(isSubmitting) => (
        <Modal
          open={open}
          onOpenChange={(o) => (o ? onOpenChange(true) : close())}
          busy={isSubmitting}
          title="Add a user"
          description="Create their account. Share the email and password with them so they can sign in."
        >
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault()
              void form.handleSubmit()
            }}
          >
            <div className="flex flex-col gap-4 px-5 pt-4">
              <FormError message={serverError} />
              <form.Field name="fullName">
                {(field) => (
                  <FormField label="Name" htmlFor="add-name" error={errorOf(field)}>
                    <input
                      id="add-name"
                      autoFocus
                      autoComplete="off"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={!!errorOf(field)}
                      className="field-input"
                    />
                  </FormField>
                )}
              </form.Field>
              <form.Field name="email">
                {(field) => (
                  <FormField label="Email" htmlFor="add-email" error={errorOf(field)} hint="They’ll sign in with this.">
                    <input
                      id="add-email"
                      type="email"
                      inputMode="email"
                      autoComplete="off"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={!!errorOf(field)}
                      className="field-input"
                    />
                  </FormField>
                )}
              </form.Field>
              <form.Field name="password">
                {(field) => (
                  <FormField label="Password" htmlFor="add-password" error={errorOf(field)} hint={PASSWORD_HINT}>
                    <div className="relative">
                      <input
                        id="add-password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        aria-invalid={!!errorOf(field)}
                       
                        className="field-input pr-11"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((s) => !s)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        aria-pressed={showPassword}
                        className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-lg text-ink-3 hover:text-ink"
                      >
                        {showPassword ? <EyeOff size={16} strokeWidth={1.75} /> : <Eye size={16} strokeWidth={1.75} />}
                      </button>
                    </div>
                  </FormField>
                )}
              </form.Field>
              <form.Field name="role">
                {(field) => (
                  <FormField label="Role" hint={ROLE_HINT[field.state.value]}>
                    {/* A two-position switch: the roles are a choice of one, not a list to scroll. */}
                    <div className="inline-flex gap-1 rounded-xl bg-canvas p-1.5 shadow-well">
                      {roles.map((r) => {
                        const selected = field.state.value === r
                        const id = `add-role-${r}`
                        return (
                          <label
                            key={r}
                            htmlFor={id}
                            className={`inline-flex h-8 min-w-[6.5rem] cursor-pointer items-center justify-center rounded-lg px-5 text-label transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--focus)] ${
                              selected
                                ? 'btn btn-primary'
                                : 'font-medium text-ink-2 hover:bg-surface-hover hover:text-ink'
                            }`}
                          >
                            <input
                              id={id}
                              type="radio"
                              name="add-role"
                              value={r}
                              checked={selected}
                              disabled={roles.length === 1}
                              onChange={() => field.handleChange(r)}
                              className="sr-only"
                            />
                            {ROLE_LABEL[r]}
                          </label>
                        )
                      })}
                    </div>
                  </FormField>
                )}
              </form.Field>
            </div>
            <ModalFooter>
              <Button variant="secondary" onClick={close} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={isSubmitting}>
                {isSubmitting ? 'Adding…' : 'Add user'}
              </Button>
            </ModalFooter>
          </form>
        </Modal>
      )}
    </form.Subscribe>
  )
}
