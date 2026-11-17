import { createFileRoute } from '@tanstack/react-router'
import { CalendarPage } from '@/calendar/pages/CalendarPage'
import { requireAccess } from '@/lib/access'

export const Route = createFileRoute('/_authed/calendar')({
  beforeLoad: ({ context }) => requireAccess(context.session, 'calendar'),
  component: CalendarPage,
})
