import { LayoutDashboard } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'

export function MainPage() {
  return (
    <div className="flex w-full flex-col px-5 pt-8 pb-24 sm:min-h-0 sm:flex-1 sm:px-10 sm:py-10">
      <h1 className="sr-only">Overview</h1>
      <EmptyState
        icon={LayoutDashboard}
        title="Overview"
        description="Clients, projects and payments will come together here as your team starts working."
      />
    </div>
  )
}
