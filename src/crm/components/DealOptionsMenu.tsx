import { ArrowLeftRight, CopyPlus, Trash2, type LucideIcon } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const WIDTH = 192

interface Item {
  label: string
  icon: LucideIcon
  onSelect: () => void
  danger?: boolean
}

/**
 * A deal card's options menu (the settings icon): Add to pipeline, Move to
 * pipeline, Delete. Rendered on the page, not in the card, so the scrolling
 * column can't clip it; it closes on scroll, resize, Escape or a click outside.
 */
export function DealOptionsMenu({
  anchor,
  dealName,
  onClose,
  onTransfer,
  onDelete,
}: {
  /** The settings button it opens from; null keeps it closed. */
  anchor: HTMLElement | null
  dealName: string
  onClose: () => void
  /** Add / Move to pipeline; absent for staff (Owner and managers only). */
  onTransfer?: (action: 'copy' | 'move') => void
  onDelete: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)

  useLayoutEffect(() => {
    if (!anchor) return
    const rect = anchor.getBoundingClientRect()
    const height = ref.current?.offsetHeight ?? 0
    // Below the button, right-aligned to it; above it when there's no room underneath.
    const below = rect.bottom + 4
    const top = below + height > window.innerHeight - 8 ? Math.max(8, rect.top - 4 - height) : below
    const left = Math.min(Math.max(8, rect.right - WIDTH), window.innerWidth - WIDTH - 8)
    setPosition({ top, left })
  }, [anchor])

  useEffect(() => {
    if (!anchor) return
    ref.current?.querySelector<HTMLButtonElement>('button')?.focus()
    const close = () => onClose()
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (!ref.current?.contains(target) && !anchor.contains(target)) onClose()
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      onClose()
      anchor.focus()
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', close)
    // Capture: the columns scroll on their own, not the window.
    window.addEventListener('scroll', close, true)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', close)
      window.removeEventListener('scroll', close, true)
    }
  }, [anchor, onClose])

  if (!anchor) return null

  const items: Item[] = [
    ...(onTransfer
      ? [
          { label: 'Add to pipeline', icon: CopyPlus, onSelect: () => onTransfer('copy') },
          { label: 'Move to pipeline', icon: ArrowLeftRight, onSelect: () => onTransfer('move') },
        ]
      : []),
    { label: 'Delete', icon: Trash2, onSelect: onDelete, danger: true },
  ]

  return createPortal(
    <div
      ref={ref}
      role="menu"
      aria-label={`Options for ${dealName}`}
      style={{ top: position?.top ?? -9999, left: position?.left ?? -9999, width: WIDTH }}
      className="fixed z-40 rounded-lg bg-surface py-1 shadow-dialog"
    >
      {items.map(({ label, icon: Icon, onSelect, danger }) => (
        <button
          key={label}
          type="button"
          role="menuitem"
          onClick={() => {
            // Focus the card's button first: the drawer or dialog returns focus there.
            anchor.focus()
            onClose()
            onSelect()
          }}
          className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-label ${
            danger ? 'text-danger hover:bg-danger-soft' : 'text-ink hover:bg-surface-hover'
          }`}
        >
          <Icon size={15} strokeWidth={2} aria-hidden />
          {label}
        </button>
      ))}
    </div>,
    document.body,
  )
}
