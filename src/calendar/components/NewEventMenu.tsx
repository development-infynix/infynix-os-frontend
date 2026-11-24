import { ChevronDown, Megaphone, Plus, Users } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/Button'
import { TYPE_LABEL, type CalendarEventType } from '../api'

const TYPE_ICON = { announcement: Megaphone, meeting: Users } as const

interface NewEventMenuProps {
  types: CalendarEventType[]
  onPick: (type: CalendarEventType) => void
  /** Button text when there's a choice of types. */
  label?: string
  /** The compact square + of the phone header. */
  iconOnly?: boolean
  /** Where the menu opens under the button. */
  align?: 'right' | 'center'
}

/**
 * Creating an event: a primary button with a menu of the types the viewer may
 * create, or a plain "<label> <type>" button when there's only one.
 */
export function NewEventMenu({ types, onPick, label = 'New event', iconOnly = false, align = 'right' }: NewEventMenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (types.length === 1) {
    const single = `${label === 'New event' ? 'New' : label} ${TYPE_LABEL[types[0]].toLowerCase()}`
    return (
      <Button
        variant="primary"
        onClick={() => onPick(types[0])}
        aria-haspopup="dialog"
        aria-label={iconOnly ? single : undefined}
        title={iconOnly ? single : undefined}
        className={iconOnly ? 'w-9 px-0!' : ''}
      >
        <Plus size={16} strokeWidth={2} aria-hidden />
        {!iconOnly && single}
      </Button>
    )
  }
  return (
    <div ref={ref} className="relative inline-block">
      <Button
        variant="primary"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={iconOnly ? label : undefined}
        title={iconOnly ? label : undefined}
        className={iconOnly ? 'w-9 px-0!' : ''}
      >
        <Plus size={16} strokeWidth={2} aria-hidden />
        {!iconOnly && (
          <>
            {label}
            <ChevronDown size={14} strokeWidth={2} aria-hidden />
          </>
        )}
      </Button>
      {open && (
        <div
          role="menu"
          aria-label={label}
          className={`absolute z-30 mt-1 w-48 overflow-hidden rounded-lg bg-surface py-1 text-left shadow-dialog ${
            align === 'center' ? 'left-1/2 -translate-x-1/2' : 'right-0'
          }`}
        >
          {types.map((type) => {
            const Icon = TYPE_ICON[type]
            return (
              <button
                key={type}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false)
                  onPick(type)
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-body text-ink-2 hover:bg-surface-hover hover:text-ink"
              >
                <Icon size={15} strokeWidth={1.9} aria-hidden />
                {TYPE_LABEL[type]}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
