import { Images } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'

export function MediaEmpty() {
  return (
    <EmptyState
      icon={Images}
      title="Media"
      description="Images, documents and shared files will be kept here."
    />
  )
}
