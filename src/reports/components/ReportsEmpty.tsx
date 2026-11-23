import { BarChart3 } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'

export function ReportsEmpty() {
  return (
    <EmptyState
      icon={BarChart3}
      title="Reports"
      description="Analytics and reports will be kept here."
    />
  )
}
