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
}

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
