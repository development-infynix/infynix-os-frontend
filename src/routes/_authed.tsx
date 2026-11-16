import { createFileRoute, redirect } from '@tanstack/react-router'
import { sessionQuery } from '@/lib/auth'
import { AppLayout } from '@/mainpage/components/AppLayout'

/** Everything under this layout needs a signed-in person; it renders the app shell. */
export const Route = createFileRoute('/_authed')({
  beforeLoad: async ({ context }) => {
    const session = await context.queryClient.ensureQueryData(sessionQuery)
    if (!session) throw redirect({ to: '/login' })
    return { session }
  },
  component: AppLayout,
})
