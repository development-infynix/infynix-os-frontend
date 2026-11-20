import { useId, type ReactNode } from 'react'

/** A titled card of label/value rows, as used in the detail drawers. */
export function Panel({ title, className = '', children }: { title: string; className?: string; children: ReactNode }) {
  const id = useId()
  return (
    <section aria-labelledby={id} className={`overflow-hidden rounded-xl bg-surface shadow-lift ${className}`}>
      <h3 id={id} className="border-b border-line bg-canvas/50 px-3.5 py-2 text-caption font-semibold text-ink-2">
        {title}
      </h3>
      <dl className="divide-y divide-line">{children}</dl>
    </section>
  )
}

/** One label/value row inside a Panel. */
export function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[6.5rem_1fr] items-baseline gap-3 px-3.5 py-2.5">
      <dt className="text-label font-medium text-ink-2">{label}</dt>
      <dd className="min-w-0 break-words text-body text-ink">{children}</dd>
    </div>
  )
}

/** A quiet value, e.g. "Not provided". */
export function Muted({ children }: { children: ReactNode }) {
  return <span className="text-ink-3">{children}</span>
}
