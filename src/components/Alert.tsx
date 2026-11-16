import { AlertTriangle, Info } from 'lucide-react'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Button } from './Button'

export type AlertTone = 'default' | 'danger'

export interface AlertDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: ReactNode
  /** Label of the main action. Default "Continue". */
  confirmLabel?: string
  /** Shown on the main action while `onConfirm` runs. */
  pendingLabel?: string
  /** Label of the dismiss action; `null` hides it (a plain notice with one button). */
  cancelLabel?: string | null
  /** `danger` for destructive actions: red action, warning icon. */
  tone?: AlertTone
  /** Replaces the tone's icon; `null` shows none. */
  icon?: ReactNode | null
  /**
   * Runs on the main action. While its promise is pending the dialog shows a
   * spinner and can't be dismissed; when it resolves the dialog closes, and
   * when it rejects the error is shown in the dialog. Omit it for a notice.
   */
  onConfirm?: () => void | Promise<void>
}

/**
 * Reusable alert dialog for confirmations and notices, on the native
 * `<dialog>`: focus is trapped while open and returns to the trigger on close,
 * Escape dismisses, and it renders above everything (even the mobile drawer).
 *
 * ```tsx
 * <AlertDialog
 *   open={open}
 *   onOpenChange={setOpen}
 *   title="Delete this record?"
 *   description="This can't be undone."
 *   tone="danger"
 *   confirmLabel="Delete"
 *   onConfirm={deleteRecord}
 * />
 * ```
 */
export function AlertDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Continue',
  pendingLabel,
  cancelLabel = 'Cancel',
  tone = 'default',
  icon,
  onConfirm,
}: AlertDialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const titleId = useId()
  const descId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      setError(null)
      dialog.showModal()
      // Destructive actions start on Cancel, so a stray Enter is safe.
      ;(tone === 'danger' && cancelRef.current ? cancelRef.current : confirmRef.current)?.focus()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open, tone])

  function dismiss() {
    if (!pending) onOpenChange(false)
  }

  async function confirm() {
    if (!onConfirm) return onOpenChange(false)
    setError(null)
    setPending(true)
    try {
      await onConfirm()
      onOpenChange(false)
    } catch {
      setError('That didn’t work. Check your connection and try again.')
    } finally {
      setPending(false)
    }
  }

  const shownIcon =
    icon === undefined
      ? tone === 'danger'
        ? <AlertTriangle size={18} strokeWidth={2} />
        : <Info size={18} strokeWidth={2} />
      : icon

  return (
    <dialog
      ref={ref}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      aria-busy={pending}
      // Escape: route through React state instead of letting the browser close it.
      onCancel={(e) => {
        e.preventDefault()
        dismiss()
      }}
      // Keep Escape from also closing whatever is underneath (the mobile drawer).
      onKeyDown={(e) => e.key === 'Escape' && e.stopPropagation()}
      className="app-dialog m-auto w-[calc(100%-32px)] max-w-dialog rounded-xl border-0 bg-surface p-0 text-ink shadow-dialog"
    >
      <div className="flex gap-3.5 p-5 pb-4">
        {shownIcon && (
          <span
            aria-hidden
            className={`grid size-9 shrink-0 place-items-center rounded-lg ${
              tone === 'danger' ? 'bg-danger-soft text-danger' : 'bg-secondary-soft text-secondary-text'
            }`}
          >
            {shownIcon}
          </span>
        )}
        <div className="min-w-0 pt-1">
          <h2 id={titleId} className="text-title font-semibold leading-6 tracking-title">
            {title}
          </h2>
          {description && (
            <div id={descId} className="mt-1 text-body text-ink-2">
              {description}
            </div>
          )}
          {error && (
            <p role="alert" className="mt-2.5 text-label text-danger">
              {error}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-line bg-canvas/60 px-5 py-3.5 sm:flex-row sm:justify-end">
        {cancelLabel !== null && (
          <Button ref={cancelRef} variant="secondary" onClick={dismiss} disabled={pending}>
            {cancelLabel}
          </Button>
        )}
        <Button
          ref={confirmRef}
          variant={tone === 'danger' ? 'danger' : 'primary'}
          onClick={confirm}
          loading={pending}
        >
          {pending ? (pendingLabel ?? confirmLabel) : confirmLabel}
        </Button>
      </div>
    </dialog>
  )
}
