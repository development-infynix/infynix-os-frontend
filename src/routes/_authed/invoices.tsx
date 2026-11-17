import { createFileRoute } from '@tanstack/react-router'
import { InvoicesPage } from '@/invoices/pages/InvoicesPage'
import { requireAccess } from '@/lib/access'

export const Route = createFileRoute('/_authed/invoices')({
  beforeLoad: ({ context }) => requireAccess(context.session, 'invoices'),
  component: InvoicesPage,
})
