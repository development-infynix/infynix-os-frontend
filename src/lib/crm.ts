import { keepPreviousData, queryOptions } from '@tanstack/react-query'
import type { BoardColumns, CrmDeal, CrmPipeline, CrmStage } from '@/crm/types'
import { api } from './api'

/** Every CRM query starts with this key: invalidate it after a change. */
export const CRM_KEY = ['crm'] as const
export const CRM_PIPELINES_KEY = [...CRM_KEY, 'pipelines'] as const

/** All pipelines, each with its stages in board order. */
export const crmPipelinesQuery = () =>
  queryOptions({
    queryKey: [...CRM_PIPELINES_KEY],
    queryFn: () => api<CrmPipeline[]>('/crm/pipelines'),
  })

export interface CrmBoard {
  pipeline: CrmPipeline
  stages: CrmStage[]
  columns: BoardColumns
  /** Each stage's true count, even when only the first 100 cards are loaded. */
  totals: Record<string, number>
}

/** One pipeline's board, loading up to 100 cards per stage. */
export const crmBoardQuery = (pipelineId: string) =>
  queryOptions({
    queryKey: [...CRM_KEY, 'board', pipelineId],
    queryFn: () => api<CrmBoard>(`/crm/pipelines/${pipelineId}/board?limit=100`),
    enabled: Boolean(pipelineId),
  })

export interface CrmDealSearch {
  items: CrmDeal[]
}

/** Name/email/phone search inside one pipeline. Keeps the last results while typing. */
export const crmDealSearchQuery = (pipelineId: string, q: string) =>
  queryOptions({
    queryKey: [...CRM_KEY, 'deal-search', pipelineId, q],
    queryFn: () => {
      const params = new URLSearchParams({ pipelineId, q, limit: '20' })
      return api<CrmDealSearch>(`/crm/deals?${params.toString()}`)
    },
    enabled: Boolean(pipelineId && q.trim()),
    placeholderData: keepPreviousData,
  })

export interface CreatePipelineInput {
  name: string
  /** The wizard's stages, left to right. Omit to use the backend's default Sales board. */
  stages?: string[]
  /** Pipeline access: people with the CRM menu who may see and work in it. */
  userIds?: string[]
}

/** Someone who can be given pipeline access: active, not the owner, with the CRM menu. */
export interface CrmEligibleUser {
  id: string
  fullName: string
  email: string
}

/** People who can be given pipeline access (owners and managers only). */
export const crmEligibleUsersQuery = () =>
  queryOptions({
    queryKey: [...CRM_KEY, 'eligible-users'],
    queryFn: () => api<CrmEligibleUser[]>('/crm/pipelines/eligible-users'),
  })

export const createCrmPipeline = (input: CreatePipelineInput) =>
  api<CrmPipeline>('/crm/pipelines', { method: 'POST', body: JSON.stringify(input) })

export interface CreateDealInput {
  pipelineId: string
  /** Defaults to the pipeline's first stage. */
  stageId?: string
  clientId?: string
  name?: string
  email?: string | null
  phone?: string | null
  customDetails?: Record<string, unknown>
}

/** Adds a client (unless `clientId` is given) and its deal in one transaction. */
export const createCrmDeal = (input: CreateDealInput) =>
  api<CrmDeal>('/crm/deals', { method: 'POST', body: JSON.stringify(input) })

export const moveCrmDeal = (id: string, stageId: string, position: number) =>
  api<CrmDeal>(`/crm/deals/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ stageId, position }),
  })

export const renameCrmPipeline = (id: string, name: string) =>
  api<CrmPipeline>(`/crm/pipelines/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) })

/** What deleting a pipeline would remove: shown in the delete confirmation. */
export interface CrmPipelineDeleteImpact {
  dealCount: number
  stageCount: number
}

export const crmPipelineDeleteImpactQuery = (id: string) =>
  queryOptions({
    queryKey: [...CRM_KEY, 'delete-impact', id],
    queryFn: () => api<CrmPipelineDeleteImpact>(`/crm/pipelines/${id}/delete-impact`),
    enabled: Boolean(id),
    // Counts change as deals move; always ask fresh when the confirmation opens.
    staleTime: 0,
  })

/** Deletes the pipeline with its deals, stages and access list. Clients stay. */
export const deleteCrmPipeline = (id: string) => api<void>(`/crm/pipelines/${id}`, { method: 'DELETE' })

/** Most clients one bulk-add request takes; the Clients page sends larger selections in chunks. */
export const CRM_BULK_CHUNK = 100

export interface AddCrmDealsResult {
  added: number
  /** Already had a deal in that pipeline: skipped, not an error. */
  alreadyInPipeline: number
  /** No longer a client of the company (deleted meanwhile). */
  notFound: number
}

/** Adds existing clients (up to CRM_BULK_CHUNK) as deals in one stage of a pipeline. */
export const addCrmDeals = (input: { pipelineId: string; stageId?: string; clientIds: string[] }) =>
  api<AddCrmDealsResult>('/crm/deals/bulk', { method: 'POST', body: JSON.stringify(input) })
