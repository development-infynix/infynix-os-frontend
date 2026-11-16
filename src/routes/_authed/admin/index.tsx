import { createFileRoute, redirect } from '@tanstack/react-router'

/** `/admin` opens its first page. */
export const Route = createFileRoute('/_authed/admin/')({
  beforeLoad: () => {
    throw redirect({ to: '/admin/users' })
  },
})
