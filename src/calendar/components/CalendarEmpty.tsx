import { CalendarDays } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'

export function CalendarEmpty() {
  return (
    <EmptyState
      icon={CalendarDays}
      title="Calendar"
      description="Scheduled work, visits and deadlines will share one calendar here."
    />
  )
}
