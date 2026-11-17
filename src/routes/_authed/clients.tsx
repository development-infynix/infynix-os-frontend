import { createFileRoute } from '@tanstack/react-router'
import { ClientsPage } from '@/clients/pages/ClientsPage'
import { requireAccess } from '@/lib/access'

export const Route = createFileRoute('/_authed/clients')({
  beforeLoad: ({ context }) => requireAccess(context.session, 'clients'),
  component: ClientsPage,
})
