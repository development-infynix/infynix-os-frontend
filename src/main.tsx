import { QueryClientProvider } from '@tanstack/react-query'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorPage } from './components/ErrorPage'
import { PageLoader } from './components/Loader'
import { NotFoundPage } from './components/NotFoundPage'
import { queryClient } from './lib/query-client'
import { applyTheme } from './lib/theme'
import { routeTree } from './routeTree.gen'
import './index.css'

const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent', // prefetch route code + data on link hover
  defaultPreloadStaleTime: 0, // let TanStack Query decide freshness
  scrollRestoration: true,
  defaultNotFoundComponent: NotFoundPage,
  // A page's data failed to load (most often the backend being down or unreachable).
  defaultErrorComponent: ErrorPage,
  // Shown when a page takes a moment to load (after a short delay, so fast
  // navigations never flash it).
  defaultPendingComponent: PageLoader,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

applyTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
