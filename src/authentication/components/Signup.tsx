import { useForm } from '@tanstack/react-form'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import { z } from 'zod'
import { Button } from '@/components/Button'
import { FormError, FormField } from '@/components/FormField'
import { ApiError } from '@/lib/api'
import { sessionQuery, signUp } from '@/lib/auth'
import { PASSWORD_HINT, strongPassword } from '@/lib/password-rules'

const schema = z.object({
  companyName: z.string().trim().min(2, 'Enter your company’s name').max(80, 'Keep it under 80 characters'),
  fullName: z.string().trim().min(1, 'Enter your name').max(120, 'Keep it under 120 characters'),
  email: z.email('Enter a valid work email, like name@company.com'),
  password: strongPassword,
})

/** Self-serve sign-up: the company and its owner account, then straight into the app. */
export function Signup() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [serverError, setServerError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  const form = useForm({
    defaultValues: { companyName: '', fullName: '', email: '', password: '' },
    validators: { onSubmit: schema },
    onSubmit: async ({ value }) => {
      setServerError(null)
      try {
        const session = await signUp({
          companyName: value.companyName.trim(),
          fullName: value.fullName.trim(),
          email: value.email.trim(),
          password: value.password,
        })
        queryClient.setQueryData(sessionQuery.queryKey, session)
        await navigate({ to: '/' })
      } catch (error) {
        setServerError(
          error instanceof ApiError && error.status !== 500
            ? error.message
            : 'Something went wrong on our side. Try again in a moment.',
        )
      }
    },
  })

  const errorOf = (field: { state: { meta: { errors: ({ message?: string } | undefined)[] } } }) =>
    field.state.meta.errors[0]?.message

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        void form.handleSubmit()
      }}
      className="flex flex-col gap-4"
    >
      <FormError message={serverError} />

      <form.Field name="companyName">
        {(field) => (
          <FormField label="Company name" htmlFor={field.name} error={errorOf(field)}>
            <input
              id={field.name}
              autoFocus
              autoComplete="organization"
              placeholder="Acme Trading"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              aria-invalid={!!errorOf(field)}
              className="field-input"
            />
          </FormField>
        )}
      </form.Field>

      <form.Field name="fullName">
        {(field) => (
          <FormField label="Your name" htmlFor={field.name} error={errorOf(field)}>
            <input
              id={field.name}
              autoComplete="name"
              placeholder="Priya Nair"
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
          <FormField label="Work email" htmlFor={field.name} error={errorOf(field)}>
            <input
              id={field.name}
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="name@company.com"
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
          <FormField label="Password" htmlFor={field.name} error={errorOf(field)} hint={PASSWORD_HINT}>
            <div className="relative">
              <input
                id={field.name}
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

      <form.Subscribe selector={(s) => s.isSubmitting}>
        {(isSubmitting) => (
          <Button type="submit" variant="primary" size="lg" loading={isSubmitting} className="mt-1 w-full">
            {isSubmitting ? 'Creating your account…' : 'Create company account'}
          </Button>
        )}
      </form.Subscribe>
    </form>
  )
}
