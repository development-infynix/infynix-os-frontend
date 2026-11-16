import { createFileRoute, redirect } from '@tanstack/react-router'
import { LoginPage } from '@/authentication/pages/LoginPage'
import { sessionQuery } from '@/lib/auth'

export const Route = createFileRoute('/login')({
  beforeLoad: async ({ context }) => {
    const session = await context.queryClient.ensureQueryData(sessionQuery)
    if (session) throw redirect({ to: '/' })
  },
  component: LoginPage,
})
