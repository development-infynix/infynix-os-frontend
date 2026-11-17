import { X } from 'lucide-react'
import { useEffect, useId, useRef, type ReactNode } from 'react'

export interface ModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: ReactNode
  children: ReactNode
  /** While true (a save in flight), Escape and the close button do nothing. */
  busy?: boolean
  /** Wider sheet for content like import wizards and preview tables. */
  wide?: boolean
}

/**
 * A dialog for forms and editing, on the native `<dialog>` like AlertDialog:
 * focus is trapped while open and returns to the trigger, Escape closes, and
 * it renders above everything. Put the form, with its own buttons, inside.
 */
export function Modal({ open, onOpenChange, title, description, children, busy = false, wide = false }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    else if (!open && dialog.open) dialog.close()
  }, [open])

  const close = () => !busy && onOpenChange(false)

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onCancel={(e) => {
        e.preventDefault()
        close()
      }}
      onKeyDown={(e) => e.key === 'Escape' && e.stopPropagation()}
      className={`app-dialog m-auto w-[calc(100%-32px)] rounded-xl border-0 bg-surface p-0 text-ink shadow-dialog ${
        wide ? 'sm:max-w-[44rem]' : 'max-w-dialog'
      }`}
    >
      {open && (
        <>
          <div className="flex items-start gap-3 px-5 pt-5">
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="text-title font-semibold tracking-title">
                {title}
              </h2>
              {description && (
                <div id={descId} className="mt-1 text-body text-ink-2">
                  {description}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="-mt-1 -mr-2 grid size-8 shrink-0 place-items-center rounded-md text-ink-3 hover:bg-surface-hover hover:text-ink"
            >
              <X size={17} strokeWidth={1.9} />
            </button>
          </div>
          {children}
        </>
      )}
    </dialog>
  )
}

/**
 * The bottom bar of a Modal form: actions on one row (Cancel left, the primary
 * action right) at every width. On phones the buttons share the bar evenly so
 * they stay easy to tap; from `sm` up they sit right-aligned at their own size.
 */
export function ModalFooter({ children }: { children: ReactNode }) {
  return (
    <div className="mt-5 flex items-center gap-2 border-t border-line bg-canvas/60 px-5 py-3.5 [&>*]:flex-1 sm:justify-end sm:[&>*]:flex-none">
      {children}
    </div>
  )
}
