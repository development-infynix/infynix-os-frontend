import { FolderKanban } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'

export function ProjectManagementEmpty() {
  return (
    <EmptyState
      icon={FolderKanban}
      title="Project Management"
      description="Projects, stages and assignments will be planned here."
    />
  )
}
