import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { ClientsPage } from '@/clients/pages/ClientsPage'
import { requireAccess } from '@/lib/access'
import { clientsPageQuery } from '@/lib/clients'

/** Page, search and import filter stay in the URL (back button, shared links). */
const searchSchema = z.object({
  page: z.coerce.number().int().min(1).optional().catch(undefined),
  q: z.string().optional().catch(''),
  importId: z.string().uuid().optional().catch(undefined),
})

export const Route = createFileRoute('/_authed/clients')({
  beforeLoad: ({ context }) => requireAccess(context.session, 'clients'),
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ page: search.page ?? 1, q: search.q ?? '', importId: search.importId }),
  loader: ({ context, deps }) => {
    void context.queryClient.prefetchQuery(clientsPageQuery(deps.page, deps.q, deps.importId))
  },
  component: ClientsPage,
})
