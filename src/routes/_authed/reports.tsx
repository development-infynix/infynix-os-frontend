import { createFileRoute } from '@tanstack/react-router'
import { ReportsPage } from '@/reports/pages/ReportsPage'
import { requireAccess } from '@/lib/access'

export const Route = createFileRoute('/_authed/reports')({
  beforeLoad: ({ context }) => requireAccess(context.session, 'reports'),
  component: ReportsPage,
})
