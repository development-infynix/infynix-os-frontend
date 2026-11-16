import { useForm } from '@tanstack/react-form'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { AlertCircle, Eye, EyeOff } from 'lucide-react'
import { useId, useState, type KeyboardEvent } from 'react'
import { z } from 'zod'
import { Button } from '@/components/Button'
import { ApiError } from '@/lib/api'
import { sessionQuery, signIn } from '@/lib/auth'

const schema = z.object({
  email: z.email('Enter a valid work email, like name@infynix.com'),
  password: z.string().min(1, 'Enter your password'),
})

function messageFor(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'That email and password don’t match. Check both and try again.'
    if (error.status === 403) return error.message
    if (error.status === 0) return error.message
  }
  return 'Something went wrong on our side. Try again in a moment.'
}

/** The sign-in form: email + password against POST /auth/sign-in. */
export function Login() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [serverError, setServerError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [capsLock, setCapsLock] = useState(false)
  const errorId = useId()

  const form = useForm({
    defaultValues: { email: '', password: '' },
    validators: { onSubmit: schema },
    onSubmit: async ({ value }) => {
      setServerError(null)
      try {
        const session = await signIn(value.email.trim(), value.password)
        queryClient.setQueryData(sessionQuery.queryKey, session)
        await navigate({ to: '/' })
      } catch (error) {
        setServerError(messageFor(error))
      }
    },
  })

  const trackCaps = (e: KeyboardEvent<HTMLInputElement>) =>
    setCapsLock(e.getModifierState('CapsLock'))

  return (
    <form
      noValidate
      aria-describedby={serverError ? errorId : undefined}
      onSubmit={(e) => {
        e.preventDefault()
        void form.handleSubmit()
      }}
      className="flex flex-col gap-4"
    >
      {serverError && (
        <div
          id={errorId}
          role="alert"
          className="flex gap-2.5 rounded-lg bg-danger-soft px-3 py-2.5 text-label leading-5 text-danger"
        >
          <AlertCircle size={16} strokeWidth={2} className="mt-0.5 shrink-0" />
          <span>{serverError}</span>
        </div>
      )}

      <form.Field name="email">
        {(field) => {
          const error = field.state.meta.errors[0]?.message
          return (
            <Field label="Work email" htmlFor={field.name} error={error}>
              <input
                id={field.name}
                name={field.name}
                type="email"
                autoComplete="username"
                inputMode="email"
                autoFocus
                placeholder="name@infynix.com"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                aria-invalid={!!error}
                aria-describedby={error ? `${field.name}-error` : undefined}
                className="field-input"
              />
            </Field>
          )
        }}
      </form.Field>

      <form.Field name="password">
        {(field) => {
          const error = field.state.meta.errors[0]?.message
          return (
            <Field
              label="Password"
              htmlFor={field.name}
              error={error}
              action={
                <Link
                  to="/forgot-password"
                  className="text-label font-medium text-secondary-text underline-offset-4 hover:underline"
                >
                  Forgot password?
                </Link>
              }
            >
              <div className="relative">
                <input
                  id={field.name}
                  name={field.name}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onKeyDown={trackCaps}
                  onKeyUp={trackCaps}
                  aria-invalid={!!error}
                  aria-describedby={error ? `${field.name}-error` : undefined}
                  className="field-input pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-lg text-ink-3 transition-colors hover:text-ink"
                >
                  {showPassword ? <EyeOff size={16} strokeWidth={1.75} /> : <Eye size={16} strokeWidth={1.75} />}
                </button>
              </div>
              {capsLock && (
                <p className="mt-1.5 text-caption text-ink-3">Caps Lock is on.</p>
              )}
            </Field>
          )
        }}
      </form.Field>

      <form.Subscribe selector={(s) => s.isSubmitting}>
        {(isSubmitting) => (
          <Button type="submit" variant="primary" size="lg" loading={isSubmitting} className="mt-1 w-full">
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </Button>
        )}
      </form.Subscribe>
    </form>
  )
}

function Field({
  label,
  htmlFor,
  error,
  action,
  children,
}: {
  label: string
  htmlFor: string
  error?: string
  /** Shown at the right end of the label row (e.g. "Forgot password?"). */
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label htmlFor={htmlFor} className="text-label font-medium text-ink-2">
          {label}
        </label>
        {action}
      </div>
      {children}
      {error && (
        <p id={`${htmlFor}-error`} className="mt-1.5 text-caption text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
