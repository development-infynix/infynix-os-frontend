import { keepPreviousData, queryOptions } from '@tanstack/react-query'
import type { AssignmentRule, BoardColumns, CrmDeal, CrmPipeline, CrmStage } from '@/crm/types'
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

/**
 * Just the stages and their deal counts for the stage manager. The board
 * endpoint with `limit=1` returns those without loading the cards.
 */
export const crmStageSummaryKey = (pipelineId: string) => [...CRM_KEY, 'stage-summary', pipelineId] as const

export const crmStageSummaryQuery = (pipelineId: string) =>
  queryOptions({
    queryKey: crmStageSummaryKey(pipelineId),
    queryFn: () => api<CrmBoard>(`/crm/pipelines/${pipelineId}/board?limit=1`),
    enabled: Boolean(pipelineId),
    staleTime: 0,
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

/** A new deal; `existingClient` when the form's email or phone already belonged to a client, which was used instead. */
export type CreatedCrmDeal = CrmDeal & { existingClient: boolean }

/**
 * Adds a client (unless `clientId` is given) and its deal in one transaction.
 * A client already in the directory (same email or phone) is reused, never copied.
 */
export const createCrmDeal = (input: CreateDealInput) =>
  api<CreatedCrmDeal>('/crm/deals', { method: 'POST', body: JSON.stringify(input) })

/** Shared by every card move, so the board can tell when the last pending one has finished. */
export const CRM_MOVE_KEY = [...CRM_KEY, 'move-deal'] as const

export const moveCrmDeal = (id: string, stageId: string, position: number) =>
  api<CrmDeal>(`/crm/deals/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ stageId, position }),
  })

export const renameCrmPipeline = (id: string, name: string) =>
  api<CrmPipeline>(`/crm/pipelines/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) })

export const renameCrmStage = (id: string, name: string) =>
  api<CrmStage>(`/crm/stages/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) })

/** Adds a stage at the end of the pipeline's board. */
export const createCrmStage = (pipelineId: string, name: string) =>
  api<CrmStage>(`/crm/pipelines/${pipelineId}/stages`, { method: 'POST', body: JSON.stringify({ name }) })

/** Persists the full order: `stageIds` must list every stage in the pipeline. */
export const reorderCrmStages = (pipelineId: string, stageIds: string[]) =>
  api<void>(`/crm/pipelines/${pipelineId}/stages/order`, {
    method: 'PUT',
    body: JSON.stringify({ stageIds }),
  })

/** Only succeeds while the stage holds no deals; the server rejects otherwise. */
export const deleteCrmStage = (id: string) => api<void>(`/crm/stages/${id}`, { method: 'DELETE' })

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

/* ── Deal assignment (docs/user-deals-assignment.md) ─────────────────────── */

export type SourceCounts = Partial<Record<AssignmentRule, number>>

/** Someone on the pipeline's access list, with the deals they own here. */
export interface AssignmentPerson {
  userId: string
  fullName: string
  email: string
  role: string
  /** Can receive deals now (active, CRM access, not the Owner). */
  eligible: boolean
  dealCount: number
  bySource: SourceCounts
}

export interface AssignmentOverview {
  rule: AssignmentRule
  singleUserId: string | null
  total: number
  assigned: number
  bySource: SourceCounts
  people: AssignmentPerson[]
  chunkSize: number
}

export const crmAssignmentKey = (pipelineId: string) => [...CRM_KEY, 'assignment', pipelineId] as const

export const crmAssignmentQuery = (pipelineId: string) =>
  queryOptions({
    queryKey: crmAssignmentKey(pipelineId),
    queryFn: () => api<AssignmentOverview>(`/crm/pipelines/${pipelineId}/assignment`),
    enabled: Boolean(pipelineId),
    staleTime: 0,
  })

export const setCrmAssignmentRule = (pipelineId: string, rule: AssignmentRule, singleUserId?: string) =>
  api<AssignmentOverview>(`/crm/pipelines/${pipelineId}/assignment-rule`, {
    method: 'PUT',
    body: JSON.stringify({ rule, ...(singleUserId ? { singleUserId } : {}) }),
  })

/** One chunk: Share (round robin) or Give (single user) the oldest unassigned deals. */
export const distributeCrmDeals = (pipelineId: string, method: 'round_robin' | 'single_user', userId?: string) =>
  api<{ assigned: number; remaining: number; eligibleCount: number }>(`/crm/pipelines/${pipelineId}/assignments/share`, {
    method: 'POST',
    body: JSON.stringify({ method, ...(userId ? { userId } : {}) }),
  })

/** One chunk: unassign a person's deals and/or one source's deals. */
export const unassignCrmDeals = (pipelineId: string, scope: { userId?: string; source?: AssignmentRule }) =>
  api<{ unassigned: number; remaining: number }>(`/crm/pipelines/${pipelineId}/assignments/unassign`, {
    method: 'POST',
    body: JSON.stringify(scope),
  })

/** Everyone who could be on the access list, and who is. */
export interface AccessCandidate {
  userId: string
  fullName: string
  email: string
  role: string
  onList: boolean
  eligible: boolean
  dealCount: number
}

export const crmAccessListQuery = (pipelineId: string) =>
  queryOptions({
    queryKey: [...CRM_KEY, 'access-list', pipelineId],
    queryFn: () => api<AccessCandidate[]>(`/crm/pipelines/${pipelineId}/users`),
    enabled: Boolean(pipelineId),
    staleTime: 0,
  })

export const saveCrmAccessList = (
  pipelineId: string,
  userIds: string[],
  handover?: { mode: 'unassign' | 'transfer'; toUserId?: string },
) =>
  api<AccessCandidate[]>(`/crm/pipelines/${pipelineId}/users`, {
    method: 'PUT',
    body: JSON.stringify({ userIds, ...(handover ? { handover } : {}) }),
  })

/** A hand-picked owner (or none) for one deal. */
export const setCrmDealOwner = (dealId: string, ownerId: string | null) =>
  api<CrmDeal>(`/crm/deals/${dealId}/owner`, { method: 'PATCH', body: JSON.stringify({ ownerId }) })

/** Runs a chunked tool until nothing remains, reporting progress after each chunk. */
export async function runInChunks(
  step: () => Promise<{ done: number; remaining: number }>,
  onProgress: (done: number, total: number) => void,
): Promise<number> {
  let done = 0
  for (;;) {
    const result = await step()
    done += result.done
    onProgress(done, done + result.remaining)
    // Nothing moved but some remain (e.g. nobody can receive them): stop rather than loop.
    if (result.remaining === 0 || result.done === 0) return done
  }
}

/* ── Deal transfer (docs/deal-transfer.md) ─────────────────────────────── */

/** Deals per transfer request (the endpoint's maximum). */
export const TRANSFER_CHUNK = 500

/** Every deal in the chosen stages of a pipeline, in board order (not only the loaded cards). */
export const fetchCrmDealIds = (pipelineId: string, stageIds: string[]) =>
  api<{ ids: string[] }>(`/crm/pipelines/${pipelineId}/deal-ids?stageIds=${stageIds.join(',')}`)

export interface TransferChunkResult {
  mode: 'move' | 'copy'
  moved: number
  /** New deals created by Add to another pipeline. */
  added: number
  /** Moved deals that arrived without an owner. */
  unassigned: number
  /** Requested deals that no longer existed. */
  missing: number
  /** Left behind: their client already has a deal in the target. */
  skipped: { dealId: string; clientName: string }[]
}

/** One chunk (up to TRANSFER_CHUNK deals from one pipeline): Move, or Add to another pipeline (`copy`). */
export const transferCrmDeals = (input: {
  mode: 'move' | 'copy'
  dealIds: string[]
  targetPipelineId: string
  targetStageId?: string
}) => api<TransferChunkResult>('/crm/deals/transfer', { method: 'POST', body: JSON.stringify(input) })

/** Most clients one bulk-add request takes; the Clients page sends larger selections in chunks. */
export const CRM_BULK_CHUNK = 500

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
