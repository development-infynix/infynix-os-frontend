import { createFileRoute, redirect } from '@tanstack/react-router'
import { SignupPage } from '@/authentication/pages/SignupPage'
import { sessionQuery } from '@/lib/auth'

export const Route = createFileRoute('/signup')({
  beforeLoad: async ({ context }) => {
    const session = await context.queryClient.ensureQueryData(sessionQuery)
    if (session) throw redirect({ to: '/' })
  },
  component: SignupPage,
})
