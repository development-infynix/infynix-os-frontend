import { createFileRoute } from '@tanstack/react-router'
import { ProjectManagementPage } from '@/project-management/pages/ProjectManagementPage'
import { requireAccess } from '@/lib/access'

export const Route = createFileRoute('/_authed/project-management')({
  beforeLoad: ({ context }) => requireAccess(context.session, 'project-management'),
  component: ProjectManagementPage,
})
