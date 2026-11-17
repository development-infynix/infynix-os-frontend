import { createFileRoute } from '@tanstack/react-router'
import { PaymentsBudgetPage } from '@/payments-budget/pages/PaymentsBudgetPage'
import { requireAccess } from '@/lib/access'

export const Route = createFileRoute('/_authed/payments-budget')({
  beforeLoad: ({ context }) => requireAccess(context.session, 'payments-budget'),
  component: PaymentsBudgetPage,
})
