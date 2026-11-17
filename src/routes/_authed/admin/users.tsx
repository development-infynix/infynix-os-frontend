import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { UsersPage } from '@/admin/pages/UsersPage'
import { MEMBER_FILTERS, membersPageQuery } from '@/lib/members'

/** Page and filter stay in the URL (back button, shared links); their defaults are 1 and all. */
const searchSchema = z.object({
  page: z.coerce.number().int().min(1).optional().catch(undefined),
  filter: z.enum(MEMBER_FILTERS).optional().catch('all'),
})

/**
 * Admin › System (users). The page of users is fetched in the background so
 * the screen opens at once and shows the loader in the table until it lands.
 */
export const Route = createFileRoute('/_authed/admin/users')({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ page: search.page ?? 1, filter: search.filter ?? 'all' }),
  loader: ({ context, deps }) => {
    void context.queryClient.prefetchQuery(membersPageQuery(deps.page, deps.filter))
  },
  component: UsersPage,
})
