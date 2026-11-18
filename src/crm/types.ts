/** A column on the board. Stage order is the array order. */
export interface CrmStage {
  id: string
  name: string
}

export interface CrmPipeline {
  id: string
  name: string
  stages: CrmStage[]
}

/** One client's deal in a pipeline: what a kanban card shows. */
export interface CrmDeal {
  id: string
  name: string
  phone: string | null
  email: string | null
  /** ISO timestamp. */
  addedAt: string
}

/** The board's state: deal cards per stage id, top to bottom. */
export type BoardColumns = Record<string, CrmDeal[]>
