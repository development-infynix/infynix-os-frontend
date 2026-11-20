import { useRouter, type ErrorComponentProps } from '@tanstack/react-router'
import { RotateCw } from 'lucide-react'
import { useState } from 'react'
import { ApiError } from '@/lib/api'
import { ThemeToggle } from './ThemeToggle'

/** The backend is down, unreachable, or failed on its side (rather than a bug in the page). */
const isServerError = (error: unknown) => error instanceof ApiError && (error.status === 0 || error.status >= 500)

/**
 * The router's error view: a page's data failed to load. Backend failures get
 * the lost-in-space illustration and a retry; anything else a plain message.
 */
export function ErrorPage({ error, reset }: ErrorComponentProps) {
  const router = useRouter()
  const [retrying, setRetrying] = useState(false)
  const server = isServerError(error)
  const offline = error instanceof ApiError && error.status === 0

  async function retry() {
    setRetrying(true)
    try {
      reset()
      await router.invalidate()
    } finally {
      setRetrying(false)
    }
  }

  return (
    <div className="dot-grid flex min-h-dvh flex-col">
      <header className="flex h-14 items-center justify-end px-4 sm:px-6">
        <ThemeToggle />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pt-[6vh] pb-12 sm:items-center sm:pt-0">
        <div className="flex w-full max-w-md flex-col items-center text-center">
          {server && (
            <img
              src="/astranouterror.svg"
              alt=""
              width={750}
              height={500}
              // Full colour (people, planets): dimmed a touch in the dark theme so it doesn't glare.
              className="mb-2 h-auto w-full max-w-sm select-none dark:brightness-[0.85]"
              draggable={false}
            />
          )}
          <h1 className="text-display-sm font-semibold leading-tight tracking-display text-ink">
            {offline ? 'Can’t reach Infynix' : server ? 'Infynix is having trouble' : 'Something went wrong'}
          </h1>
          <p className="mt-2 max-w-[40ch] text-body text-ink-2">
            {offline
              ? 'We couldn’t connect to the server. Check your internet connection, then try again.'
              : server
                ? 'The server ran into a problem loading this page. It’s usually brief, so try again in a moment.'
                : 'This page hit an unexpected error. Try again, and if it keeps happening, reload the app.'}
          </p>
          <button
            type="button"
            onClick={() => void retry()}
            disabled={retrying}
            className="btn btn-primary mt-6 h-10 gap-2 px-4 text-body"
          >
            <RotateCw size={16} strokeWidth={2} aria-hidden className={retrying ? 'animate-spin' : ''} />
            {retrying ? 'Trying again…' : 'Try again'}
          </button>
          {import.meta.env.DEV && !server && error instanceof Error && (
            <pre className="mt-6 max-h-40 w-full overflow-auto rounded-lg bg-surface p-3 text-left text-caption text-ink-3 shadow-lift">
              {error.message}
            </pre>
          )}
        </div>
      </main>
    </div>
  )
}
