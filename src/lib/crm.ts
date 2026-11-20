import { keepPreviousData, queryOptions } from '@tanstack/react-query'
import type { BoardColumns, CrmDeal, CrmPipeline, CrmStage } from '@/crm/types'
import { api } from './api'

/** Every CRM query starts with this key: invalidate it after a change. */
export const CRM_KEY = ['crm'] as const
export const CRM_PIPELINES_KEY = [...CRM_KEY, 'pipelines'] as const

/** Where the CRM page remembers the pipeline last open. */
export const CRM_PIPELINE_STORAGE_KEY = 'infynix-crm-pipeline'

/** The pipeline last open, if remembered (storage can be blocked, e.g. private mode). */
export function readStoredPipelineId(): string | null {
  try {
    return localStorage.getItem(CRM_PIPELINE_STORAGE_KEY)
  } catch {
    return null
  }
}

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
  /** Each stage's true count, even when only some of its cards are loaded. */
  totals: Record<string, number>
}

export const crmBoardKey = (pipelineId: string) => [...CRM_KEY, 'board', pipelineId] as const

/** Cards per column on first load, and per page as you scroll down a column. */
export const CRM_PAGE_SIZE = 100
/** Most cards one stage-page request returns (the backend's cap). */
const STAGE_FETCH_MAX = 500

export interface CrmStagePage {
  items: CrmDeal[]
  /** The stage's true count right now. */
  total: number
}

/** Cards `offset` onwards of one column, in board order. */
export const fetchCrmStageDeals = (stageId: string, offset: number, limit = CRM_PAGE_SIZE) =>
  api<CrmStagePage>(`/crm/stages/${stageId}/deals?offset=${offset}&limit=${limit}`)

/** `extra` appended to `cards`, skipping ids already there (offsets drift when cards move). */
export function appendCards(cards: CrmDeal[], extra: CrmDeal[]): CrmDeal[] {
  const seen = new Set(cards.map((card) => card.id))
  return [...cards, ...extra.filter((card) => !seen.has(card.id))]
}

/**
 * One pipeline's board: the first CRM_PAGE_SIZE cards of each stage. A
 * refetch keeps the depth already scrolled to: a column that had loaded 300
 * cards gets 300 back, rather than shrinking to 100 under the reader.
 */
export const crmBoardQuery = (pipelineId: string) =>
  queryOptions({
    queryKey: crmBoardKey(pipelineId),
    queryFn: async ({ client }) => {
      const previous = client.getQueryData<CrmBoard>(crmBoardKey(pipelineId))
      const board = await api<CrmBoard>(`/crm/pipelines/${pipelineId}/board?limit=${CRM_PAGE_SIZE}`)
      if (!previous) return board
      await Promise.all(
        board.stages.map(async ({ id }) => {
          const depth = previous.columns[id]?.length ?? 0
          let cards = board.columns[id] ?? []
          while (cards.length < depth && cards.length < (board.totals[id] ?? 0)) {
            const page = await fetchCrmStageDeals(id, cards.length, Math.min(depth - cards.length, STAGE_FETCH_MAX))
            const next = appendCards(cards, page.items)
            board.totals[id] = page.total
            if (next.length === cards.length) break // nothing new: stop rather than ask for the same slice again
            cards = next
          }
          board.columns[id] = cards
        }),
      )
      return board
    },
    enabled: Boolean(pipelineId),
  })

/** One deal, fresh from the server: the details drawer opens with the card's copy and refreshes from this. */
export const crmDealQuery = (dealId: string) =>
  queryOptions({
    queryKey: [...CRM_KEY, 'deal', dealId],
    queryFn: () => api<CrmDeal>(`/crm/deals/${dealId}`),
    enabled: Boolean(dealId),
    staleTime: 0,
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

/** Shared by every card move, so the board can tell when the last pending one has finished. */
export const CRM_MOVE_KEY = [...CRM_KEY, 'move-deal'] as const

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
