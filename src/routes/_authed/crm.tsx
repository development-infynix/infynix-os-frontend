import { createFileRoute } from '@tanstack/react-router'
import { CrmPage } from '@/crm/pages/CrmPage'
import { requireAccess } from '@/lib/access'
import { crmBoardQuery, crmPipelinesQuery, readStoredPipelineId } from '@/lib/crm'

export const Route = createFileRoute('/_authed/crm')({
  beforeLoad: ({ context }) => requireAccess(context.session, 'crm'),
  // Start both requests together (and on link hover, via preload) instead of the board waiting for the
  // pipeline list. Not awaited: the page shows its own loading states.
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery(crmPipelinesQuery())
    const pipelineId = readStoredPipelineId()
    if (pipelineId) void context.queryClient.prefetchQuery(crmBoardQuery(pipelineId))
  },
  component: CrmPage,
})
