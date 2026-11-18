import type { ReactNode } from 'react'

interface IllustrationButtonProps {
  /** What pressing the drawing does, for screen readers and the tooltip. */
  label: string
  onClick?: () => void
  children: ReactNode
}

/**
 * Makes an empty-state drawing the action itself, so the screen has one
 * obvious target instead of a picture next to a button. Without a handler the
 * drawing stays decorative and no focus stop is added.
 */
export function IllustrationButton({ label, onClick, children }: IllustrationButtonProps) {
  if (!onClick) return <>{children}</>

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="mx-auto block w-full max-w-[220px] cursor-pointer rounded-xl transition-transform duration-(--duration-enter) ease-out-expo hover:-translate-y-0.5 active:translate-y-0"
    >
      {children}
    </button>
  )
}
