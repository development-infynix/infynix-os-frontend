import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
}

/**
 * What a module shows before it has anything to show. One icon, one heading,
 * one sentence: enough to say what belongs here without pretending the
 * feature is connected.
 */
export function EmptyState({ icon: Icon, title, description }: EmptyStateProps) {
  return (
    <div className="grid min-h-64 flex-1 place-items-center px-2 py-12">
      <div className="max-w-sm text-center">
        <span
          aria-hidden
          className="mx-auto grid size-10 place-items-center rounded-lg bg-surface text-secondary-text shadow-lift"
        >
          <Icon size={19} strokeWidth={1.8} />
        </span>
        <h2 className="mt-4 text-title font-semibold tracking-title text-ink">{title}</h2>
        <p className="mt-1.5 text-body text-ink-2">{description}</p>
      </div>
    </div>
  )
}
