import { ReceiptText } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'

export function InvoicesEmpty() {
  return (
    <EmptyState
      icon={ReceiptText}
      title="Invoices"
      description="Draft, send and track invoices from here."
    />
  )
}
