import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { ReportsPage } from '@/reports/pages/ReportsPage'
import { requireAccess } from '@/lib/access'

/** Page and filters stay in the URL (back button, shared links). */
const searchSchema = z.object({
  page: z.coerce.number().int().min(1).optional().catch(undefined),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .catch(undefined),
  userId: z.string().uuid().optional().catch(undefined),
})

export const Route = createFileRoute('/_authed/reports')({
  beforeLoad: ({ context }) => requireAccess(context.session, 'reports'),
  validateSearch: searchSchema,
  component: ReportsPage,
})
