import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { UsersPage } from '@/admin/pages/UsersPage'
import { membersPageQuery } from '@/lib/members'

/** `?page=2` keeps the current page in the URL (back button, shared links); no page means 1. */
const searchSchema = z.object({
  page: z.coerce.number().int().min(1).optional().catch(undefined),
})

/**
 * Admin › System (users). The page of users is fetched in the background so
 * the screen opens at once and shows the loader in the table until it lands.
 */
export const Route = createFileRoute('/_authed/admin/users')({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ page: search.page ?? 1 }),
  loader: ({ context, deps }) => {
    void context.queryClient.prefetchQuery(membersPageQuery(deps.page))
  },
  component: UsersPage,
})
