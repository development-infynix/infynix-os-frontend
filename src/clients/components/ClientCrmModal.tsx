import { useQuery } from '@tanstack/react-query'
import { Layers } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/Button'
import { Loader } from '@/components/Loader'
import { Modal, ModalFooter } from '@/components/Modal'
import { crmPipelinesQuery } from '@/lib/crm'
import { AddToPipelineProgress } from '@/crm/components/AddToPipelineProgress'
import { RadioDot, StagePicker } from '@/crm/components/StagePicker'
import { useAddToPipeline } from '@/crm/useAddToPipeline'
import type { CrmPipeline } from '@/crm/types'

interface ClientCrmModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The selected clients, in selection order. */
  clientIds: string[]
  /** Called once the run finishes (all chunks sent), so the page can clear its selection. */
  onDone: () => void
}

const number = new Intl.NumberFormat()

/**
 * Clients → CRM: pick a pipeline, then the stage the deals land in, and add
 * the selected clients in chunks of 500 with a progress bar. A failed chunk
 * can be retried; the chunks before it stay added.
 */
export function ClientCrmModal({ open, onOpenChange, clientIds, onDone }: ClientCrmModalProps) {
  const pipelinesQuery = useQuery({ ...crmPipelinesQuery(), enabled: open })
  const pipelines = pipelinesQuery.data ?? []
  const [pipelineId, setPipelineId] = useState<string | null>(null)
  const [stageId, setStageId] = useState<string | null>(null)
  const run = useAddToPipeline({ onDone })

  // Start over each time the modal opens.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setPipelineId(null)
      setStageId(null)
      run.reset()
    }
  }

  const pipeline = pipelines.find((item) => item.id === pipelineId) ?? null
  const stage = pipeline?.stages.find((item) => item.id === stageId) ?? pipeline?.stages[0] ?? null
  const choosing = run.phase === 'idle'
  const running = run.phase === 'running'
  const total = choosing ? clientIds.length : run.total

  function choosePipeline(next: CrmPipeline) {
    setPipelineId(next.id)
    setStageId(next.stages[0]?.id ?? null)
  }

  function start() {
    if (!pipeline || !stage) return
    run.start(clientIds, { pipelineId: pipeline.id, stageId: stage.id })
  }

  const count = number.format(total)
  const where = pipeline && stage ? `${pipeline.name} › ${stage.name}` : ''

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      busy={running}
      bare={run.phase === 'done'}
      title="Add to a pipeline"
      description={
        choosing
          ? `${count} selected ${clientIds.length === 1 ? 'client becomes a deal' : 'clients become deals'} in the pipeline you choose.`
          : `Adding ${count} ${total === 1 ? 'client' : 'clients'} to ${where}.`
      }
    >
      <div className="flex flex-col">
        <div className={`max-h-[min(60vh,30rem)] overflow-y-auto px-5 ${run.phase === 'done' ? 'pt-8 pb-6' : 'pt-5'}`}>
          {choosing ? (
            pipelinesQuery.isPending ? (
              <div className="grid place-items-center py-8">
                <Loader label="Loading pipelines" />
              </div>
            ) : pipelinesQuery.isError ? (
              <div className="py-6 text-center">
                <p className="text-label text-ink-2">Couldn’t load your pipelines.</p>
                <Button size="sm" variant="secondary" className="mt-3" onClick={() => void pipelinesQuery.refetch()}>
                  Try again
                </Button>
              </div>
            ) : pipelines.length === 0 ? (
              <p className="py-6 text-center text-label text-ink-2">
                You aren’t on any pipeline yet. Ask an owner or manager to give you access to one.
              </p>
            ) : (
              <div role="radiogroup" aria-label="Pipeline" className="flex flex-col gap-3 pb-1">
                {pipelines.map((item) => (
                  <PipelineOption
                    key={item.id}
                    pipeline={item}
                    selected={item.id === pipelineId}
                    stageId={item.id === pipelineId ? (stage?.id ?? null) : null}
                    onSelect={() => choosePipeline(item)}
                    onSelectStage={setStageId}
                  />
                ))}
              </div>
            )
          ) : (
            <AddToPipelineProgress run={run} where={where} onDone={() => onOpenChange(false)} />
          )}
        </div>

        {run.phase !== 'done' && (
        <ModalFooter>
          {choosing ? (
            <>
              <Button variant="secondary" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={start} disabled={!pipeline || !stage || !clientIds.length}>
                Add to pipeline
              </Button>
            </>
          ) : run.phase === 'failed' ? (
            <>
              <Button variant="secondary" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button variant="primary" onClick={run.retry}>
                Try again
              </Button>
            </>
          ) : (
            <Button variant="primary" onClick={() => onOpenChange(false)} loading={running}>
              {running ? 'Adding…' : 'Done'}
            </Button>
          )}
        </ModalFooter>
        )}
      </div>
    </Modal>
  )
}

/** A pipeline to pick; once picked, its stages fold out as a list to choose where the deals land. */
function PipelineOption({
  pipeline,
  selected,
  stageId,
  onSelect,
  onSelectStage,
}: {
  pipeline: CrmPipeline
  selected: boolean
  stageId: string | null
  onSelect: () => void
  onSelectStage: (id: string) => void
}) {
  const stageCount = pipeline.stages.length
  return (
    <div
      className={`overflow-hidden rounded-xl transition-shadow duration-press ${
        selected ? 'bg-surface shadow-lift ring-2 ring-secondary' : 'bg-surface ring-1 ring-line'
      }`}
    >
      <button
        type="button"
        role="radio"
        aria-checked={selected}
        onClick={onSelect}
        disabled={stageCount === 0}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors duration-press hover:bg-surface-hover/50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary-soft text-secondary-text">
          <Layers size={17} strokeWidth={2} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-body font-semibold text-ink">{pipeline.name}</span>
          <span className="mt-0.5 block text-caption text-ink-3 tabular-nums">
            {stageCount === 0 ? 'No stages' : `${stageCount} ${stageCount === 1 ? 'stage' : 'stages'}`}
          </span>
        </span>
        <RadioDot checked={selected} />
      </button>

      {/* Stages fold out under the chosen pipeline (grid rows 0fr → 1fr). */}
      <div
        className={`grid transition-[grid-template-rows] duration-enter ease-out-expo ${
          selected ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
        inert={!selected}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="border-t border-line bg-canvas/50 px-4 pt-3 pb-4">
            <StagePicker stages={pipeline.stages} value={stageId} onChange={onSelectStage} />
          </div>
        </div>
      </div>
    </div>
  )
}
