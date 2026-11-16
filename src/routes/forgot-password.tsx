import { createFileRoute } from '@tanstack/react-router'
import { ForgotPasswordPage } from '@/authentication/pages/ForgotPasswordPage'

export const Route = createFileRoute('/forgot-password')({
  component: ForgotPasswordPage,
})
