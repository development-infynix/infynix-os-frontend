import type { QueryClient } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'

interface RouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
})

function RootLayout() {
  return (
    <>
      <Outlet />
      {import.meta.env.DEV && (
        <>
          {/* Both on the right so they never cover the sidebar's Sign out. */}
          <TanStackRouterDevtools position="bottom-right" />
          <div className="fixed right-3 bottom-14 z-50">
            <ReactQueryDevtools buttonPosition="relative" />
          </div>
        </>
      )}
    </>
  )
}
