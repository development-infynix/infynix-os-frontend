import type { ReactNode } from 'react'

interface FormFieldProps {
  label: string
  /** Id of the control the label points at; omit for a group (radios, switches). */
  htmlFor?: string
  error?: string
  hint?: ReactNode
  children: ReactNode
}

const LABEL = 'mb-1.5 block text-label font-medium text-ink-2'

/** Label, control, then the error (or a hint). Pair with `.field-input`. */
export function FormField({ label, htmlFor, error, hint, children }: FormFieldProps) {
  return (
    <div role={htmlFor ? undefined : 'group'} aria-label={htmlFor ? undefined : label}>
      {htmlFor ? (
        <label htmlFor={htmlFor} className={LABEL}>
          {label}
        </label>
      ) : (
        <span className={LABEL}>{label}</span>
      )}
      {children}
      {error ? (
        <p id={htmlFor && `${htmlFor}-error`} className="mt-1.5 text-caption text-danger">
          {error}
        </p>
      ) : (
        hint && <p className="mt-1.5 text-caption text-ink-3">{hint}</p>
      )}
    </div>
  )
}

/** The red banner a form shows for a server-side failure. */
export function FormError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <div role="alert" className="rounded-lg bg-danger-soft px-3 py-2.5 text-label text-danger">
      {message}
    </div>
  )
}
