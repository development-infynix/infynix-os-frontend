import { Menu } from 'lucide-react'
import { ThemeToggle } from '@/components/ThemeToggle'

interface HeaderProps {
  title: string
  onOpenMenu: () => void
}

export function Header({ title, onOpenMenu }: HeaderProps) {
  return (
    <header className="sticky top-0 z-10 flex h-header shrink-0 items-center gap-2 border-b border-line bg-canvas/90 px-3 backdrop-blur-sm sm:px-10 lg:pr-5">
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label="Open menu"
        className="grid size-9 place-items-center rounded-md text-ink-2 hover:bg-surface-hover hover:text-ink lg:hidden"
      >
        <Menu size={18} strokeWidth={1.75} />
      </button>
      <p className="text-body font-semibold text-ink">{title}</p>
      <div className="flex-1" />
      <ThemeToggle />
    </header>
  )
}
