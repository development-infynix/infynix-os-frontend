import { createFileRoute } from '@tanstack/react-router'
import { CrmPage } from '@/crm/pages/CrmPage'
import { requireAccess } from '@/lib/access'

export const Route = createFileRoute('/_authed/crm')({
  beforeLoad: ({ context }) => requireAccess(context.session, 'crm'),
  component: CrmPage,
})
