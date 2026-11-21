import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeftRight, Check, CopyPlus, Info, X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { Button } from '@/components/Button'
import { FormError } from '@/components/FormField'
import { SuccessState } from '@/components/SuccessState'
import { ApiError } from '@/lib/api'
import {
  CRM_KEY,
  crmAssignmentQuery,
  fetchCrmDealIds,
  TRANSFER_CHUNK,
  transferCrmDeals,
  type AssignmentOverview,
  type TransferChunkResult,
} from '@/lib/crm'
import type { CrmPipeline } from '../types'
import { PipelineOption } from './PipelineOption'
import { RadioDot } from './StagePicker'

const STEPS = ['Select', 'Stages', 'Destination'] as const
/** Add to pipeline (`copy`) or Move to pipeline, picked from the Deal transfer card's menu. */
export type TransferAction = 'copy' | 'move'
type Step = 1 | 2 | 3
const number = new Intl.NumberFormat()

interface Totals {
  /** Deals moved, or new deals added. */
  done: number
  unassigned: number
  missing: number
  skipped: TransferChunkResult['skipped']
}
const NO_TOTALS: Totals = { done: 0, unassigned: 0, missing: 0, skipped: [] }

/**
 * CRM › Actions › Deal transfer › Add to pipeline / Move to pipeline
 * (docs/deal-transfer.md): choose whole stages of this pipeline, then the
 * target pipeline and landing stage. Runs 500 deals per request with progress.
 */
export function DealTransferDrawer({
  open,
  onOpenChange,
  action,
  pipeline,
  pipelines,
  totals,
  dealIds,
  onDone,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** What this drawer does: Add to pipeline (`copy`) or Move to pipeline. */
  action: TransferAction
  /** The pipeline open on the board: the deals come from here. */
  pipeline: CrmPipeline
  /** Every pipeline the person can see: the others are the destinations. */
  pipelines: CrmPipeline[]
  /** Each stage's true deal count (from the board), not just the loaded cards. */
  totals: Record<string, number>
  /**
   * The board's Select › Move / Add: these exact deals. The drawer opens at
   * the Destination step, with no Select or Stages steps.
   */
  dealIds?: string[]
  /** After a run that finished (the board leaves select mode). */
  onDone?: () => void
}) {
  const fromSelection = dealIds !== undefined
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const queryClient = useQueryClient()
  const [step, setStep] = useState<Step>(1)
  const [stageIds, setStageIds] = useState<Set<string>>(new Set())
  const [targetId, setTargetId] = useState<string | null>(null)
  const [targetStageId, setTargetStageId] = useState<string | null>(null)
  const [phase, setPhase] = useState<'choose' | 'running' | 'done' | 'failed'>('choose')
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [result, setResult] = useState<Totals>(NO_TOTALS)
  const [error, setError] = useState<string | null>(null)
  /** The ids being moved and where the run stopped, so Try again carries on. */
  const [batch, setBatch] = useState<{ ids: string[]; next: number }>({ ids: [], next: 0 })

  // Start over each time the drawer opens.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setStep(dealIds !== undefined ? 3 : 1)
      setStageIds(new Set())
      setTargetId(null)
      setTargetStageId(null)
      setPhase('choose')
      setProgress({ done: 0, total: 0 })
      setResult(NO_TOTALS)
      setError(null)
      setBatch({ ids: [], next: 0 })
    }
  }

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      dialog.focus()
    } else if (!open && dialog.open) dialog.close()
  }, [open])

  const running = phase === 'running'
  const destinations = pipelines.filter((p) => p.id !== pipeline.id)
  const target = destinations.find((p) => p.id === targetId) ?? null
  const landing = target?.stages.find((s) => s.id === targetStageId) ?? target?.stages[0] ?? null
  const selectedCount = fromSelection
    ? dealIds.length
    : [...stageIds].reduce((sum, id) => sum + (totals[id] ?? 0), 0)
  const where = target ? `${target.name}${landing ? ` › ${landing.name}` : ''}` : ''
  // What will happen to owners in the target, so nobody moves deals blind.
  const targetRules = useQuery({ ...crmAssignmentQuery(targetId ?? ''), enabled: open && Boolean(targetId) })

  function close() {
    if (running) return
    onOpenChange(false)
  }

  function toggleStage(id: string) {
    setStageIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  /** Sends the ids from `from` onwards, 500 at a time, adding to the totals. */
  async function run(ids: string[], from: number, start: Totals) {
    if (!target) return
    setPhase('running')
    setError(null)
    let current = start
    for (let index = from; index < ids.length; index += TRANSFER_CHUNK) {
      const chunk = ids.slice(index, index + TRANSFER_CHUNK)
      try {
        const r = await transferCrmDeals({
          mode: action,
          dealIds: chunk,
          targetPipelineId: target.id,
          targetStageId: landing?.id,
        })
        current = {
          done: current.done + (action === 'move' ? r.moved : r.added),
          unassigned: current.unassigned + r.unassigned,
          missing: current.missing + r.missing,
          skipped: [...current.skipped, ...r.skipped],
        }
        setResult(current)
        setProgress({ done: Math.min(index + chunk.length, ids.length), total: ids.length })
        setBatch({ ids, next: index + chunk.length })
      } catch (caught) {
        setError(caught instanceof ApiError && caught.status !== 500 ? caught.message : 'Couldn’t finish. Try again.')
        setPhase('failed')
        await queryClient.invalidateQueries({ queryKey: CRM_KEY })
        return
      }
    }
    setPhase('done')
    onDone?.()
    await queryClient.invalidateQueries({ queryKey: CRM_KEY })
  }

  async function start() {
    setPhase('running')
    setError(null)
    setResult(NO_TOTALS)
    try {
      // The selected cards, or every deal in the chosen stages (not only the loaded cards).
      const ids = fromSelection ? dealIds : (await fetchCrmDealIds(pipeline.id, [...stageIds])).ids
      setProgress({ done: 0, total: ids.length })
      setBatch({ ids, next: 0 })
      await run(ids, 0, NO_TOTALS)
    } catch (caught) {
      setError(caught instanceof ApiError && caught.status !== 500 ? caught.message : 'Couldn’t load the deals. Try again.')
      setPhase('failed')
    }
  }

  // Step 1 only offers By stage for now, so it's always ready.
  const canNext = step === 1 ? true : step === 2 ? stageIds.size > 0 : Boolean(target && landing)
  const moving = action === 'move'
  const verb = moving ? 'Move' : 'Add'
  const plural = (n: number) => `${number.format(n)} deal${n === 1 ? '' : 's'}`

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => {
        if (event.target !== event.currentTarget) return
        event.preventDefault()
        close()
      }}
      onClose={(event) => {
        if (event.target !== event.currentTarget) return
        if (running) ref.current?.showModal()
        else if (open) onOpenChange(false)
      }}
      onKeyDown={(event) => event.key === 'Escape' && event.stopPropagation()}
      onClick={(event) => event.target === event.currentTarget && close()}
      tabIndex={-1}
      className="app-drawer w-full max-w-sheet border-0 bg-surface p-0 text-ink shadow-dialog outline-none"
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-2.5 border-b border-line px-4 py-3.5">
          {moving ? (
            <ArrowLeftRight size={18} strokeWidth={2} aria-hidden className="shrink-0 text-ink-3" />
          ) : (
            <CopyPlus size={18} strokeWidth={2} aria-hidden className="shrink-0 text-ink-3" />
          )}
          <h2 id={titleId} className="text-title font-semibold tracking-title">
            {moving ? 'Move to pipeline' : 'Add to pipeline'}
          </h2>
          <span className="min-w-0 truncate rounded-md bg-surface-hover px-2 py-0.5 text-caption font-medium text-ink-2" title={pipeline.name}>
            {pipeline.name}
          </span>
          <button
            type="button"
            onClick={close}
            disabled={running}
            aria-label="Close"
            className="ml-auto grid size-9 shrink-0 place-items-center rounded-md text-ink-3 hover:bg-surface-hover hover:text-ink disabled:opacity-40"
          >
            <X size={18} strokeWidth={1.9} aria-hidden />
          </button>
        </div>

        {phase === 'choose' && !fromSelection && <StepsStrip step={step} />}

        <div className="flex flex-1 flex-col overflow-y-auto bg-canvas px-4 py-4">
          {phase === 'done' ? (
            <SuccessState
              title={`${moving ? 'Moved' : 'Added'} ${plural(result.done)}`}
              action={
                <Button variant="primary" onClick={close} className="min-w-28">
                  Done
                </Button>
              }
            >
              <p>
                {moving ? 'Now in' : 'Added to'} {where}
              </p>
              {result.unassigned > 0 && (
                <p>
                  {moving
                    ? result.unassigned === result.done
                      ? 'Owners were reset, so these deals are unassigned.'
                      : `Owners were reset; ${number.format(result.unassigned)} deal${result.unassigned === 1 ? ' is' : 's are'} unassigned.`
                    : result.unassigned === result.done
                      ? 'The new deals are unassigned.'
                      : `${number.format(result.unassigned)} of the new deals ${result.unassigned === 1 ? 'is' : 'are'} unassigned.`}
                </p>
              )}
              {result.skipped.length > 0 && (
                <p>
                  {number.format(result.skipped.length)} skipped, already in {target?.name}:{' '}
                  {result.skipped.slice(0, 5).map((s) => s.clientName).join(', ')}
                  {result.skipped.length > 5 ? ` and ${number.format(result.skipped.length - 5)} more` : ''}
                </p>
              )}
              {result.missing > 0 && <p>{number.format(result.missing)} no longer existed</p>}
            </SuccessState>
          ) : phase === 'running' || phase === 'failed' ? (
            <div>
              <div className="flex items-baseline justify-between gap-3 text-label">
                <span className={`font-medium ${phase === 'failed' ? 'text-danger' : 'text-ink'}`}>
                  {phase === 'failed'
                    ? `Stopped after ${plural(result.done)}`
                    : `${moving ? 'Moving' : 'Adding'} ${number.format(progress.done)} of ${number.format(progress.total)} deals…`}
                </span>
                <span className="text-ink-3 tabular-nums">
                  {progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-hover">
                <div
                  className={`h-full rounded-full transition-[width] duration-200 ${phase === 'failed' ? 'bg-danger' : 'bg-secondary'}`}
                  style={{ width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%` }}
                />
              </div>
              <p className="mt-3 text-label text-ink-2">To {where}</p>
              {error && (
                <div className="mt-3">
                  <FormError message={error} />
                </div>
              )}
            </div>
          ) : step === 1 ? (
            <div role="radiogroup" aria-label="How to select deals" className="flex flex-col gap-3">
              <p className="px-1 text-label font-medium text-ink-2">How to select deals</p>
              <MethodCard
                title="By stage"
                description={`${moving ? 'Move' : 'Add'} every deal in the stages you choose.`}
                selected
              />
              <MethodCard title="By fields" description="Pick deals by their details." disabled badge="Coming soon" />
            </div>
          ) : step === 2 ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between px-1">
                <p className="text-label font-medium text-ink-2">Choose stages</p>
                <div className="flex gap-3 text-label">
                  <button
                    type="button"
                    className="font-medium text-ink-2 hover:underline disabled:opacity-50"
                    disabled={stageIds.size === 0}
                    onClick={() => setStageIds(new Set())}
                  >
                    Clear
                  </button>
                </div>
              </div>
              <ul className="flex flex-col gap-2" aria-label="Stages">
                {pipeline.stages.map((stage, index) => {
                  const count = totals[stage.id] ?? 0
                  const checked = stageIds.has(stage.id)
                  return (
                    <li key={stage.id}>
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={checked}
                        disabled={count === 0}
                        onClick={() => toggleStage(stage.id)}
                        className="card-3d flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <span
                          aria-hidden
                          className={`grid size-4 shrink-0 place-items-center rounded border ${
                            checked ? 'border-secondary bg-secondary text-on-secondary' : 'border-line-strong bg-surface text-transparent'
                          }`}
                        >
                          <Check size={11} strokeWidth={3} />
                        </span>
                        <span className="w-5 shrink-0 text-right text-label text-ink-3 tabular-nums">{index + 1}</span>
                        <span className="min-w-0 flex-1 truncate text-body font-medium text-ink">{stage.name}</span>
                        <span className="shrink-0 text-label text-ink-3 tabular-nums">
                          {count ? `${number.format(count)} deal${count === 1 ? '' : 's'}` : 'Empty'}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="px-1 text-label font-medium text-ink-2">Destination</p>
              <p className="px-1 text-label text-ink-3">
                {moving
                  ? `The deals leave ${pipeline.name} and go to the pipeline you choose.`
                  : `The deals stay in ${pipeline.name}; new deals for the same clients go to the pipeline you choose.`}
              </p>
              {destinations.length === 0 ? (
                <p className="py-6 text-center text-label text-ink-3">There’s no other pipeline yet.</p>
              ) : (
                <div role="radiogroup" aria-label="Target pipeline" className="flex flex-col gap-3">
                  {destinations.map((p) => (
                    <PipelineOption
                      key={p.id}
                      pipeline={p}
                      selected={p.id === targetId}
                      stageId={p.id === targetId ? (landing?.id ?? null) : null}
                      onSelect={() => {
                        setTargetId(p.id)
                        setTargetStageId(p.stages[0]?.id ?? null)
                      }}
                      onSelectStage={setTargetStageId}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {phase === 'choose' && step === 3 && target && (
          <div role="status" className="flex items-start gap-2.5 border-t border-line bg-secondary-soft/50 px-5 py-2.5 text-label text-ink">
            <Info size={16} strokeWidth={2} aria-hidden className="mt-0.5 shrink-0 text-secondary-text" />
            <p>{ownerNotice(target.name, moving, targetRules.isPending ? undefined : targetRules.data)}</p>
          </div>
        )}
        {phase !== 'done' && (
          <div className="flex items-center gap-2 border-t border-line bg-canvas/60 px-5 py-3.5">
            <span className="mr-auto text-label text-ink-3 tabular-nums">
              {phase === 'choose' && step > 1
                ? `${plural(selectedCount)} selected`
                : phase === 'choose'
                  ? `${pipeline.stages.length} stage${pipeline.stages.length === 1 ? '' : 's'} in ${pipeline.name}`
                  : ''}
            </span>
            {phase === 'failed' ? (
              <>
                <Button variant="secondary" onClick={close}>
                  Close
                </Button>
                <Button
                  variant="primary"
                  onClick={() => void (batch.ids.length ? run(batch.ids, batch.next, result) : start())}
                >
                  Try again
                </Button>
              </>
            ) : phase === 'running' ? (
              <Button variant="primary" loading disabled>
                {moving ? 'Moving…' : 'Adding…'}
              </Button>
            ) : (
              <>
                <Button
                  variant="secondary"
                  onClick={() => (step === 1 || fromSelection ? close() : setStep((step - 1) as Step))}
                >
                  {step === 1 || fromSelection ? 'Cancel' : 'Back'}
                </Button>
                {step < 3 ? (
                  <Button variant="primary" disabled={!canNext} onClick={() => setStep((step + 1) as Step)}>
                    Next
                  </Button>
                ) : (
                  <Button variant="primary" disabled={!canNext || selectedCount === 0} onClick={() => void start()}>
                    {verb} {plural(selectedCount)}
                  </Button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </dialog>
  )
}

/** Select · Stages · Destination, done steps ticked, the current one filled. */
function StepsStrip({ step }: { step: Step }) {
  return (
    <ol className="flex items-center gap-2 border-b border-line px-4 py-3" aria-label="Steps">
      {STEPS.map((label, index) => {
        const n = (index + 1) as Step
        const done = n < step
        const current = n === step
        return (
          <li key={label} className="flex min-w-0 flex-1 items-center gap-2">
            <span
              aria-current={current ? 'step' : undefined}
              className={`grid size-6 shrink-0 place-items-center rounded-full text-micro font-semibold ${
                done || current ? 'bg-secondary text-on-secondary' : 'bg-surface-hover text-ink-3'
              }`}
            >
              {done ? <Check size={12} strokeWidth={2.6} aria-hidden /> : n}
            </span>
            <span className={`truncate text-label ${current ? 'font-medium text-ink' : 'text-ink-3'}`}>{label}</span>
            {n < STEPS.length && <span className={`h-px flex-1 ${done ? 'bg-secondary' : 'bg-line'}`} />}
          </li>
        )
      })}
    </ol>
  )
}

/** A way to select deals (only By stage is available for now). */
function MethodCard({
  title,
  description,
  selected = false,
  disabled = false,
  badge,
}: {
  title: string
  description: string
  selected?: boolean
  disabled?: boolean
  badge?: string
}) {
  return (
    <div
      role="radio"
      aria-checked={selected}
      aria-disabled={disabled}
      className={`card-3d flex items-start gap-3 rounded-xl p-4 ${selected ? 'outline-2 outline-secondary' : ''} ${
        disabled ? 'opacity-60' : ''
      }`}
    >
      <span className="mt-0.5">
        <RadioDot checked={selected} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-body font-semibold text-ink">{title}</span>
          {badge && (
            <span className="rounded-md bg-surface-hover px-1.5 py-0.5 text-micro font-semibold text-ink-3">{badge}</span>
          )}
        </span>
        <span className="mt-0.5 block text-label text-ink-2">{description}</span>
      </span>
    </div>
  )
}

/**
 * What happens to owners in the target pipeline, from its assignment rule
 * (docs/deal-transfer.md, T5): only Round robin and Single user assign; Creator
 * and Manual leave transferred deals unassigned.
 */
function ownerNotice(targetName: string, moving: boolean, rules: AssignmentOverview | undefined): string {
  if (!rules) return `Checking how ${targetName} assigns deals…`
  const reset = moving ? ' Their current owners are reset.' : ''
  const eligible = rules.people.filter((p) => p.eligible)
  switch (rules.rule) {
    case 'round_robin':
      return eligible.length
        ? `Deals will be shared in turn between ${eligible.length} ${eligible.length === 1 ? 'person' : 'people'} in ${targetName} (its Round robin rule).${reset}`
        : `${targetName} uses Round robin, but nobody there can receive deals, so they'll arrive unassigned.${reset}`
    case 'single_user': {
      const person = eligible.find((p) => p.userId === rules.singleUserId)
      return person
        ? `Every deal will go to ${person.fullName} (${targetName}’s Single user rule).${reset}`
        : `${targetName} uses Single user, but nobody can receive deals there, so they'll arrive unassigned.${reset}`
    }
    case 'creator':
      return `${targetName} uses the Creator rule, so the deals will arrive unassigned.${reset}`
    default:
      return `${targetName} assigns owners by hand (Manual), so the deals will arrive unassigned.${reset}`
  }
}
