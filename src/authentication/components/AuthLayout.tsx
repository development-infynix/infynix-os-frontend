import type { ReactNode } from 'react'
import { ThemeToggle } from '@/components/ThemeToggle'

interface AuthLayoutProps {
  title: string
  subtitle: string
  children: ReactNode
  /** Below the card: the link to the other auth page, help text. */
  footer?: ReactNode
}

/** The shared frame of sign-in and sign-up: dotted canvas, mark, heading, card. */
export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="dot-grid flex min-h-dvh flex-col">
      <header className="flex h-14 items-center justify-end px-4 sm:px-6">
        <ThemeToggle />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pt-[6vh] pb-16 sm:items-center sm:pt-0">
        <div className="w-full max-w-auth">
          <div className="mb-6">
            <img src="/infynixicon.svg" alt="AgencyOS" width={36} height={36} className="mb-5 dark:brightness-[1.35]" />
            <h1 className="text-display-sm font-semibold leading-tight tracking-display text-ink">{title}</h1>
            <p className="mt-1.5 text-body text-ink-2">{subtitle}</p>
          </div>
          <div className="rounded-xl bg-surface p-5 shadow-lift sm:p-6">{children}</div>
          {footer && <div className="mt-5 flex flex-col gap-2 text-label leading-5 text-ink-3">{footer}</div>}
        </div>
      </main>
    </div>
  )
}
