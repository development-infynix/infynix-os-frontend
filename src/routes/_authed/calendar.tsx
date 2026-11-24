import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { CalendarPage } from '@/calendar/pages/CalendarPage'
import { requireAccess } from '@/lib/access'

/** The month shown, the selected day and the open event stay in the URL (back button, shared links). */
const searchSchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional()
    .catch(undefined),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .catch(undefined),
  event: z.string().uuid().optional().catch(undefined),
})

export const Route = createFileRoute('/_authed/calendar')({
  beforeLoad: ({ context }) => requireAccess(context.session, 'calendar'),
  validateSearch: searchSchema,
  component: CalendarPage,
})
