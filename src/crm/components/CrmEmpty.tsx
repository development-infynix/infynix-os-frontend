import { Handshake } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'

export function CrmEmpty() {
  return (
    <EmptyState
      icon={Handshake}
      title="CRM"
      description="Leads, conversations and follow-ups will be tracked here so no opportunity goes cold."
    />
  )
}
