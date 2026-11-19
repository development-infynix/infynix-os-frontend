/** A column on the board. Stage order is the array order. */
export interface CrmStage {
  id: string
  name: string
  position: number
}

export interface CrmPipeline {
  id: string
  name: string
  position: number
  stages: CrmStage[]
}

/** One client's deal in a pipeline: what a kanban card shows. */
export interface CrmDeal {
  id: string
  clientId: string
  pipelineId: string
  stageId: string
  position: number
  name: string
  phone: string | null
  email: string | null
  customDetails: Record<string, unknown>
  /** ISO timestamp. */
  addedAt: string
}

/** The board's state: deal cards per stage id, top to bottom. */
export type BoardColumns = Record<string, CrmDeal[]>
