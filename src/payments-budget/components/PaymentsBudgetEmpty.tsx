import { Wallet } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'

export function PaymentsBudgetEmpty() {
  return (
    <EmptyState
      icon={Wallet}
      title="Payments & Budget"
      description="Incoming payments, outgoings and budget lines will be managed here."
    />
  )
}
