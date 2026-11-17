import { Contact } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'

export function ClientsEmpty() {
  return (
    <EmptyState
      icon={Contact}
      title="Clients"
      description="Your client directory will live here, with contacts, company details and history in one place."
    />
  )
}
