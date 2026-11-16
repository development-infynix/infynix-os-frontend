import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { canAdminister } from '@/lib/auth'

/** The Admin area: owners only. Anyone else is sent home before it loads. */
export const Route = createFileRoute('/_authed/admin')({
  beforeLoad: ({ context }) => {
    if (!canAdminister(context.session.user.role)) throw redirect({ to: '/' })
  },
  component: Outlet,
})
