import { Check, ChevronDown } from 'lucide-react'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

export interface SelectOption<T extends string> {
  value: T
  label: ReactNode
  /** Shown at the row's right, muted (a count, a role…). */
  meta?: ReactNode
  /** Listed but can't be picked. */
  disabled?: boolean
  /** A destructive choice: red text in the list and on the button once picked. */
  danger?: boolean
}

interface SelectProps<T extends string> {
  value: T
  options: SelectOption<T>[]
  onChange: (value: T) => void
  /** Names the control for screen readers when no visible label points at it. */
  'aria-label'?: string
  id?: string
  disabled?: boolean
  className?: string
}

/**
 * The app's dropdown (as in CRM's pipeline picker): a field-style button with
 * a chevron, opening a raised list; the chosen row sits on the green wash with
 * a check. Arrow keys move through the list, Enter picks, Escape closes.
 */
export function Select<T extends string>({
  value,
  options,
  onChange,
  id,
  disabled = false,
  className = '',
  ...rest
}: SelectProps<T>) {
  const [open, setOpen] = useState(false)
  const [focus, setFocus] = useState(-1)
  const ref = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const listId = useId()
  const current = options.find((option) => option.value === value)
  const enabled = options.map((option, index) => (option.disabled ? -1 : index)).filter((index) => index >= 0)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  const openList = () => {
    setFocus(Math.max(0, options.findIndex((option) => option.value === value)))
    setOpen(true)
  }
  const pick = (option: SelectOption<T>) => {
    if (option.disabled) return
    onChange(option.value)
    setOpen(false)
    buttonRef.current?.focus()
  }
  const move = (step: 1 | -1) => {
    if (!enabled.length) return
    const at = enabled.indexOf(focus)
    const next = at === -1 ? enabled[0] : enabled[(at + step + enabled.length) % enabled.length]
    setFocus(next)
  }

  return (
    <div
      ref={ref}
      className={`relative ${className}`}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          // Close the list, not the drawer around it.
          event.stopPropagation()
          event.preventDefault()
          setOpen(false)
          buttonRef.current?.focus()
        } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault()
          if (!open) openList()
          else move(event.key === 'ArrowDown' ? 1 : -1)
        } else if ((event.key === 'Enter' || event.key === ' ') && open && focus >= 0) {
          event.preventDefault()
          pick(options[focus])
        }
      }}
    >
      <button
        ref={buttonRef}
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openList())}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && focus >= 0 ? `${listId}-${focus}` : undefined}
        aria-label={rest['aria-label']}
        className="field-input flex items-center justify-between gap-2 text-left disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className={`min-w-0 truncate font-medium ${current?.danger ? 'text-danger' : 'text-ink'}`}>
          {current?.label}
        </span>
        <ChevronDown
          size={16}
          strokeWidth={2}
          aria-hidden
          className={`shrink-0 text-ink-3 transition-transform duration-press ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label={rest['aria-label']}
          className="absolute left-0 z-30 mt-1 max-h-72 w-full min-w-48 overflow-y-auto rounded-lg bg-surface py-1 shadow-dialog"
        >
          {options.map((option, index) => {
            const selected = option.value === value
            return (
              <li key={option.value} role="presentation">
                <button
                  type="button"
                  id={`${listId}-${index}`}
                  role="option"
                  tabIndex={-1}
                  aria-selected={selected}
                  aria-disabled={option.disabled || undefined}
                  onClick={() => pick(option)}
                  onMouseEnter={() => !option.disabled && setFocus(index)}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-body ${
                    option.disabled
                      ? 'cursor-not-allowed text-ink-3 opacity-50'
                      : selected
                        ? 'bg-secondary-soft font-medium text-secondary-text'
                        : option.danger
                          ? `text-danger hover:bg-surface-hover ${focus === index ? 'bg-surface-hover' : ''}`
                          : `text-ink-2 hover:bg-surface-hover hover:text-ink ${focus === index ? 'bg-surface-hover text-ink' : ''}`
                  }`}
                >
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  {option.meta && <span className="shrink-0 text-caption text-ink-3">{option.meta}</span>}
                  {selected && <Check size={14} strokeWidth={2} aria-hidden className="shrink-0" />}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
