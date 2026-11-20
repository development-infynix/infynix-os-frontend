import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { ApiError } from '@/lib/api'
import { CLIENTS_KEY } from '@/lib/clients'
import { addCrmDeals, CRM_BULK_CHUNK, CRM_KEY } from '@/lib/crm'

export type AddToPipelinePhase = 'idle' | 'running' | 'done' | 'failed'

export interface AddToPipelineTally {
  added: number
  alreadyInPipeline: number
  notFound: number
  /** Clients sent so far (chunks that succeeded). */
  sent: number
}

const EMPTY_TALLY: AddToPipelineTally = { added: 0, alreadyInPipeline: 0, notFound: 0, sent: 0 }

interface Target {
  pipelineId: string
  stageId: string
}

/**
 * Adds existing clients to a pipeline stage in chunks (CRM_BULK_CHUNK each),
 * with a running tally. A failed chunk stops the run; `retry` carries on from
 * that chunk, and clients already added are skipped by the server, so nothing
 * doubles. Used by Move to CRM, Add deal › Existing import and Add deal ›
 * Import data.
 */
export function useAddToPipeline({ onDone }: { onDone?: () => void } = {}) {
  const queryClient = useQueryClient()
  const [phase, setPhase] = useState<AddToPipelinePhase>('idle')
  const [tally, setTally] = useState<AddToPipelineTally>(EMPTY_TALLY)
  const [error, setError] = useState<string | null>(null)
  /** The ids being sent and where to, frozen when the run starts. */
  const [batch, setBatch] = useState<{ ids: string[]; target: Target } | null>(null)

  async function run(ids: string[], target: Target, start: AddToPipelineTally) {
    setPhase('running')
    setError(null)
    let current = start
    for (let index = start.sent; index < ids.length; index += CRM_BULK_CHUNK) {
      const chunk = ids.slice(index, index + CRM_BULK_CHUNK)
      try {
        const result = await addCrmDeals({ pipelineId: target.pipelineId, stageId: target.stageId, clientIds: chunk })
        current = {
          added: current.added + result.added,
          alreadyInPipeline: current.alreadyInPipeline + result.alreadyInPipeline,
          notFound: current.notFound + result.notFound,
          sent: current.sent + chunk.length,
        }
        setTally(current)
      } catch (caught) {
        setError(
          caught instanceof ApiError && caught.status !== 500
            ? caught.message
            : 'Couldn’t add the rest. Check your connection and try again.',
        )
        setPhase('failed')
        await refresh()
        return
      }
    }
    setPhase('done')
    await refresh()
    onDone?.()
  }

  /** The board, the pipeline counts and the clients list may all have changed. */
  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: CRM_KEY }),
      queryClient.invalidateQueries({ queryKey: CLIENTS_KEY }),
    ])
  }

  return {
    phase,
    tally,
    error,
    /** How many clients this run covers. */
    total: batch?.ids.length ?? 0,
    percent: batch?.ids.length ? Math.round((tally.sent / batch.ids.length) * 100) : 0,
    start(ids: string[], target: Target) {
      const frozen = [...ids]
      setBatch({ ids: frozen, target })
      setTally(EMPTY_TALLY)
      void run(frozen, target, EMPTY_TALLY)
    },
    /** Carries on from the chunk that failed. */
    retry() {
      if (batch) void run(batch.ids, batch.target, tally)
    },
    reset() {
      setPhase('idle')
      setTally(EMPTY_TALLY)
      setError(null)
      setBatch(null)
    },
  }
}

export type AddToPipelineRun = ReturnType<typeof useAddToPipeline>
