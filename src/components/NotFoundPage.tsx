import { Link } from '@tanstack/react-router'
import { ThemeToggle } from './ThemeToggle'

/** Any address that matches no page (the router's default not-found view). */
export function NotFoundPage() {
  return (
    <div className="dot-grid flex min-h-dvh flex-col">
      <header className="flex h-14 items-center justify-end px-4 sm:px-6">
        <ThemeToggle />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pt-[12vh] sm:items-center sm:pt-0">
        <div className="w-full max-w-auth">
          <img src="/infynixicon.svg" alt="Infynix" width={36} height={36} className="mb-5 dark:brightness-[1.35]" />
          <h1 className="text-display-sm font-semibold leading-tight tracking-display text-ink">Page not found</h1>
          <p className="mt-1.5 text-body text-ink-2">
            This address doesn’t exist in Infynix OS. It may be an old link.
          </p>
          <Link to="/" className="btn btn-primary mt-6 h-10 px-4 text-body">
            Go to Infynix OS
          </Link>
        </div>
      </main>
    </div>
  )
}
