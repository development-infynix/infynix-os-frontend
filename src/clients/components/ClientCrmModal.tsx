import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Layers } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/Button'
import { FormError } from '@/components/FormField'
import { Loader } from '@/components/Loader'
import { Modal, ModalFooter } from '@/components/Modal'
import { ApiError } from '@/lib/api'
import { CLIENTS_KEY } from '@/lib/clients'
import { addCrmDeals, CRM_BULK_CHUNK, CRM_KEY, crmPipelinesQuery } from '@/lib/crm'
import type { CrmPipeline } from '@/crm/types'

interface ClientCrmModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The selected clients, in selection order. */
  clientIds: string[]
  /** Called once the run finishes (all chunks sent), so the page can clear its selection. */
  onDone: () => void
}

type Phase = 'choose' | 'running' | 'done' | 'failed'

interface Tally {
  added: number
  alreadyInPipeline: number
  notFound: number
  /** Clients sent so far (chunks that succeeded). */
  sent: number
}

const EMPTY_TALLY: Tally = { added: 0, alreadyInPipeline: 0, notFound: 0, sent: 0 }
const number = new Intl.NumberFormat()

/**
 * Clients → CRM: pick a pipeline, then the stage the deals land in, and add
 * the selected clients in chunks of 100 with a progress bar. A failed chunk
 * can be retried; the chunks before it stay added.
 */
export function ClientCrmModal({ open, onOpenChange, clientIds, onDone }: ClientCrmModalProps) {
  const queryClient = useQueryClient()
  const pipelinesQuery = useQuery({ ...crmPipelinesQuery(), enabled: open })
  const pipelines = pipelinesQuery.data ?? []
  const [pipelineId, setPipelineId] = useState<string | null>(null)
  const [stageId, setStageId] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('choose')
  const [tally, setTally] = useState<Tally>(EMPTY_TALLY)
  const [error, setError] = useState<string | null>(null)
  /** The ids being sent, frozen when the run starts (the page clears its selection when it's done). */
  const [batch, setBatch] = useState<string[]>([])

  // Start over each time the modal opens.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setPipelineId(null)
      setStageId(null)
      setPhase('choose')
      setTally(EMPTY_TALLY)
      setError(null)
      setBatch([])
    }
  }

  const pipeline = pipelines.find((item) => item.id === pipelineId) ?? null
  const stage = pipeline?.stages.find((item) => item.id === stageId) ?? pipeline?.stages[0] ?? null
  const total = phase === 'choose' ? clientIds.length : batch.length
  const percent = total ? Math.round((tally.sent / total) * 100) : 0
  const running = phase === 'running'

  function choosePipeline(next: CrmPipeline) {
    setPipelineId(next.id)
    setStageId(next.stages[0]?.id ?? null)
    setError(null)
  }

  /** Sends `ids` from `from` onwards, one chunk at a time, adding to the tally. */
  async function run(ids: string[], from: number, start: Tally) {
    if (!pipeline || !stage) return
    setPhase('running')
    setError(null)
    let current = start
    for (let index = from; index < ids.length; index += CRM_BULK_CHUNK) {
      const chunk = ids.slice(index, index + CRM_BULK_CHUNK)
      try {
        const result = await addCrmDeals({ pipelineId: pipeline.id, stageId: stage.id, clientIds: chunk })
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
        await refreshAfterRun()
        return
      }
    }
    setPhase('done')
    await refreshAfterRun()
    onDone()
  }

  /** The board and the pipeline counts changed; refresh them for the CRM page. */
  async function refreshAfterRun() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: CRM_KEY }),
      queryClient.invalidateQueries({ queryKey: CLIENTS_KEY }),
    ])
  }

  function start() {
    if (!pipeline || !stage) return
    const ids = [...clientIds]
    setBatch(ids)
    setTally(EMPTY_TALLY)
    void run(ids, 0, EMPTY_TALLY)
  }

  const count = number.format(total)
  const where = pipeline && stage ? `${pipeline.name} › ${stage.name}` : ''

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      busy={running}
      title="Add to a pipeline"
      description={
        phase === 'choose'
          ? `${count} selected ${clientIds.length === 1 ? 'client becomes a deal' : 'clients become deals'} in the pipeline you choose.`
          : `Adding ${count} ${batch.length === 1 ? 'client' : 'clients'} to ${where}.`
      }
    >
      <div className="flex flex-col">
        <div className="max-h-[min(60vh,30rem)] overflow-y-auto px-5 pt-5">
          {phase === 'choose' ? (
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
            <Progress phase={phase} tally={tally} total={total} percent={percent} where={where} error={error} />
          )}
        </div>

        <ModalFooter>
          {phase === 'choose' ? (
            <>
              <Button variant="secondary" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={start} disabled={!pipeline || !stage || !clientIds.length}>
                Add to pipeline
              </Button>
            </>
          ) : phase === 'failed' ? (
            <>
              <Button variant="secondary" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button variant="primary" onClick={() => void run(batch, tally.sent, tally)}>
                Try again
              </Button>
            </>
          ) : (
            <Button variant="primary" onClick={() => onOpenChange(false)} loading={running}>
              {running ? 'Adding…' : 'Done'}
            </Button>
          )}
        </ModalFooter>
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
            <p id={`${pipeline.id}-stage-label`} className="text-label font-medium text-ink-2">
              Land in stage
            </p>
            <ol
              role="radiogroup"
              aria-labelledby={`${pipeline.id}-stage-label`}
              className="mt-2.5 overflow-hidden rounded-lg bg-surface ring-1 ring-line"
            >
              {pipeline.stages.map((stage, index) => {
                const active = stage.id === stageId
                return (
                  <li key={stage.id} role="presentation" className="border-b border-line last:border-b-0">
                    <button
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => onSelectStage(stage.id)}
                      className={`flex w-full items-center gap-3 px-3.5 py-2.5 text-left text-body transition-colors duration-press ${
                        active ? 'bg-secondary-soft/60 text-ink' : 'text-ink-2 hover:bg-surface-hover/60 hover:text-ink'
                      }`}
                    >
                      <span className="w-5 shrink-0 text-right text-label text-ink-3 tabular-nums">{index + 1}</span>
                      <span className={`min-w-0 flex-1 truncate ${active ? 'font-medium' : ''}`} title={stage.name}>
                        {stage.name}
                      </span>
                      <RadioDot checked={active} small />
                    </button>
                  </li>
                )
              })}
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}

/** The round selection mark used for both pipelines and stages. */
function RadioDot({ checked, small = false }: { checked: boolean; small?: boolean }) {
  return (
    <span
      aria-hidden
      className={`grid ${small ? 'size-4' : 'size-5'} shrink-0 place-items-center rounded-full border transition-colors duration-press ${
        checked ? 'border-secondary bg-secondary text-on-secondary' : 'border-line-strong bg-surface text-transparent'
      }`}
    >
      <Check size={small ? 10 : 12} strokeWidth={3} />
    </span>
  )
}

/** The running, finished or failed view: a progress bar and what happened. */
function Progress({
  phase,
  tally,
  total,
  percent,
  where,
  error,
}: {
  phase: Exclude<Phase, 'choose'>
  tally: Tally
  total: number
  percent: number
  where: string
  error: string | null
}) {
  const label = phase === 'running' ? 'Adding clients…' : phase === 'done' ? 'All done' : 'Stopped'
  return (
    <div className="pb-1">
      <div className="flex items-center justify-between text-label text-ink-2">
        <span>{label}</span>
        <span className="tabular-nums">
          {number.format(tally.sent)} / {number.format(total)}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label="Progress adding clients to the pipeline"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        className="mt-2 h-2 overflow-hidden rounded-full bg-surface-hover"
      >
        <div
          className={`h-full rounded-full transition-[width] duration-200 ${phase === 'failed' ? 'bg-danger' : 'bg-secondary'}`}
          style={{ width: `${percent}%` }}
        />
      </div>

      {phase !== 'running' && (
        <dl className="mt-4 flex flex-col gap-1.5 text-label">
          <Row label={`Added to ${where}`} value={tally.added} strong />
          {tally.alreadyInPipeline > 0 && <Row label="Already in this pipeline (skipped)" value={tally.alreadyInPipeline} />}
          {tally.notFound > 0 && <Row label="No longer in your directory (skipped)" value={tally.notFound} />}
          {phase === 'failed' && <Row label="Not sent yet" value={total - tally.sent} />}
        </dl>
      )}
      {error && (
        <div className="mt-3">
          <FormError message={error} />
        </div>
      )}
    </div>
  )
}

function Row({ label, value, strong = false }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="min-w-0 text-ink-2">{label}</dt>
      <dd className={`shrink-0 tabular-nums ${strong ? 'font-semibold text-ink' : 'text-ink-2'}`}>{number.format(value)}</dd>
    </div>
  )
}
