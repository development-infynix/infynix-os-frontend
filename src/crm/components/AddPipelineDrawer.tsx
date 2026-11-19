import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, Check, Handshake, Layers, Plus, Trash2, Users, X } from 'lucide-react'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Button } from '@/components/Button'
import { FormError, FormField } from '@/components/FormField'
import { ApiError } from '@/lib/api'
import { createCrmPipeline, CRM_PIPELINES_KEY, crmPipelinesQuery } from '@/lib/crm'
import type { CrmPipeline } from '../types'
import { PIPELINE_TEMPLATES, templateFor, type PipelineTemplateKey } from '../templates'

interface AddPipelineDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (pipeline: CrmPipeline) => void
}

interface DraftStage {
  key: string
  name: string
}

const STEPS = ['Template', 'Stages', 'People'] as const
type Step = 1 | 2 | 3

const DEFAULT_TEMPLATE: PipelineTemplateKey = 'sales'

let stageKey = 0
const draftStage = (name: string): DraftStage => ({ key: `stage-${++stageKey}`, name })
const draftStages = (names: string[]) => names.map(draftStage)

function uniqueStageName(stages: DraftStage[]): string {
  const taken = new Set(stages.map((stage) => stage.name.trim().toLowerCase()))
  let number = stages.length + 1
  while (taken.has(`stage ${number}`)) number += 1
  return `Stage ${number}`
}

/**
 * Create a pipeline from a template, then rename, add, remove or reorder its
 * stages. A side drawer on the shared `app-drawer` shell. It stays mounted so
 * it can slide out, and starts over at step 1 every time it opens.
 */
export function AddPipelineDrawer({ open, onOpenChange, onCreated }: AddPipelineDrawerProps) {
  const queryClient = useQueryClient()
  const ref = useRef<HTMLDialogElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  const [step, setStep] = useState<Step>(1)
  const [templateKey, setTemplateKey] = useState<PipelineTemplateKey>(DEFAULT_TEMPLATE)
  const [name, setName] = useState('')
  /** Shown on the name field: the name is checked on step 1, never left for the save. */
  const [nameError, setNameError] = useState<string | null>(null)
  // Already loaded by the page; used to catch a duplicate name before step 2.
  const { data: existingPipelines = [] } = useQuery(crmPipelinesQuery())
  const [stages, setStages] = useState<DraftStage[]>(() => draftStages(templateFor(DEFAULT_TEMPLATE).stages))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  /** Set by the first change. While configuring, a click on the scrim doesn't close the drawer. */
  const [configuring, setConfiguring] = useState(false)

  // Start over each time the drawer opens. Done during render (not in an
  // effect) so the fresh wizard is what slides in, never last time's step.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      const fresh = templateFor(DEFAULT_TEMPLATE)
      setStep(1)
      setTemplateKey(DEFAULT_TEMPLATE)
      setName('')
      setNameError(null)
      setStages(draftStages(fresh.stages))
      setError(null)
      setConfiguring(false)
    }
  }

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      nameRef.current?.focus()
    } else if (!open && dialog.open) dialog.close()
  }, [open])

  const template = templateFor(templateKey)

  /** Closes unless a save is running. */
  function close() {
    if (saving) return
    onOpenChange(false)
  }

  function chooseTemplate(nextKey: PipelineTemplateKey) {
    if (nextKey === templateKey) return
    const next = templateFor(nextKey)
    setTemplateKey(nextKey)
    // The template only sets the stages; the name is always the person's own.
    setStages(draftStages(next.stages))
    setError(null)
    setConfiguring(true)
  }

  function setStageName(index: number, value: string) {
    setStages((current) => current.map((stage, i) => (i === index ? { ...stage, name: value } : stage)))
    setError(null)
    setConfiguring(true)
  }

  function moveStage(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= stages.length) return
    setStages((current) => {
      const next = [...current]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
    setConfiguring(true)
  }

  function removeStage(index: number) {
    if (stages.length === 1) return
    setStages((current) => current.filter((_, i) => i !== index))
    setError(null)
    setConfiguring(true)
  }

  function addStage() {
    setStages((current) => [...current, draftStage(uniqueStageName(current))])
    setError(null)
    setConfiguring(true)
  }

  /** Empty, or already used by another pipeline (case-insensitive, like the server). */
  function nameProblem(): string | null {
    const value = name.trim().toLowerCase()
    if (!value) return 'Give the pipeline a name.'
    if (existingPipelines.some((pipeline) => pipeline.name.trim().toLowerCase() === value)) {
      return 'A pipeline with that name already exists. Choose another name.'
    }
    return null
  }

  function validateStages(): string | null {
    if (!stages.length) return 'Add at least one stage.'
    if (stages.some((stage) => !stage.name.trim())) return 'Every stage needs a name.'
    const names = stages.map((stage) => stage.name.trim().toLowerCase())
    if (new Set(names).size !== names.length) return 'Stage names must be unique.'
    return null
  }

  function goNext() {
    setError(null)
    if (step === 1) {
      const problem = nameProblem()
      if (problem) {
        setNameError(problem)
        nameRef.current?.focus()
        return
      }
      setStep(2)
      setConfiguring(true)
      return
    }
    if (step === 2) {
      const problem = validateStages()
      if (problem) {
        setError(problem)
        return
      }
      setStep(3)
      return
    }
    void save()
  }

  async function save() {
    const problem = validateStages()
    if (problem) {
      setStep(2)
      setError(problem)
      return
    }
    setSaving(true)
    setError(null)
    try {
      const pipeline = await createCrmPipeline({
        name: name.trim(),
        stages: stages.map((stage) => stage.name.trim()),
      })
      // Put it in the list before selecting it, so the page doesn't fall back
      // to the old first pipeline while the list refetches.
      queryClient.setQueryData<CrmPipeline[]>([...CRM_PIPELINES_KEY], (current = []) => [
        ...current.filter((item) => item.id !== pipeline.id),
        pipeline,
      ])
      await queryClient.invalidateQueries({ queryKey: CRM_PIPELINES_KEY })
      onCreated(pipeline)
      onOpenChange(false)
    } catch (caught) {
      // Someone else took the name since step 1: send them back to the name field.
      if (caught instanceof ApiError && caught.status === 409) {
        setStep(1)
        setNameError(caught.message)
        requestAnimationFrame(() => nameRef.current?.focus())
        return
      }
      setError(
        caught instanceof ApiError && caught.status !== 500
          ? caught.message
          : 'Couldn’t create the pipeline. Try again.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      aria-busy={saving || undefined}
      // Escape: the browser's cancel. Kept as a way out while configuring; blocked while saving.
      onCancel={(event) => {
        event.preventDefault()
        close()
      }}
      // The browser can force-close the dialog itself (Escape pressed twice). Mid-save that
      // would hide the result, so reopen it; otherwise keep the page's state in step.
      onClose={() => {
        if (saving) ref.current?.showModal()
        else if (open) onOpenChange(false)
      }}
      onKeyDown={(event) => event.key === 'Escape' && event.stopPropagation()}
      // The scrim: closes only before anything has been configured.
      onClick={(event) => event.target === event.currentTarget && !configuring && close()}
      tabIndex={-1}
      className="app-drawer w-full max-w-sheet border-0 bg-surface p-0 text-ink shadow-dialog outline-none"
    >
      <form
        noValidate
        className="flex h-full flex-col"
        onSubmit={(event) => {
          event.preventDefault()
          goNext()
        }}
      >
        <div className="flex items-start gap-2 border-b border-line px-4 py-3.5">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="truncate text-title font-semibold tracking-title">
              Create a pipeline
            </h2>
            <p id={descriptionId} className="mt-0.5 text-label text-ink-3">
              Start from a template, then make the stages yours.
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            disabled={saving}
            aria-label="Close"
            className="grid size-9 shrink-0 place-items-center rounded-md text-ink-3 hover:bg-surface-hover hover:text-ink disabled:opacity-40"
          >
            <X size={18} strokeWidth={1.9} aria-hidden />
          </button>
        </div>

        {/* Secondary header: the steps stay in view while the body scrolls. */}
        <nav aria-label="Create pipeline progress" className="border-b border-line bg-surface px-5 py-3">
          <ol className="flex items-center gap-2">
            {STEPS.map((label, index) => {
              const number = (index + 1) as Step
              const done = number < step
              const active = number === step
              return (
                <li key={label} className="flex min-w-0 flex-1 items-center gap-2">
                  <span
                    aria-current={active ? 'step' : undefined}
                    className={`grid size-7 shrink-0 place-items-center rounded-full text-micro font-semibold ${
                      done || active ? 'bg-secondary text-on-secondary' : 'bg-surface-hover text-ink-3'
                    }`}
                    title={label}
                  >
                    {done ? <Check size={14} strokeWidth={2.4} aria-hidden /> : number}
                  </span>
                  <span className={`truncate text-caption ${active ? 'font-medium text-ink' : 'text-ink-3'}`}>
                    {label}
                  </span>
                  {number < STEPS.length && (
                    <span className={`h-px flex-1 ${number < step ? 'bg-secondary' : 'bg-line'}`} />
                  )}
                </li>
              )
            })}
          </ol>
        </nav>

        <div className="flex-1 overflow-y-auto bg-canvas px-5 py-5">
          <div>
            <FormError message={error} />

            {step === 1 ? (
              <div className="flex flex-col gap-4">
                <FormField label="Pipeline name" htmlFor="create-pipeline-name" error={nameError ?? undefined}>
                  <input
                    ref={nameRef}
                    id="create-pipeline-name"
                    maxLength={120}
                    value={name}
                    onChange={(event) => {
                      setName(event.target.value)
                      setNameError(null)
                      setError(null)
                      setConfiguring(true)
                    }}
                    placeholder={`e.g. ${template.name}`}
                    aria-invalid={!!nameError}
                    className="field-input"
                  />
                </FormField>

                <div role="group" aria-label="Pipeline template">
                  <span className="mb-1.5 block text-label font-medium text-ink-2">Start from a template</span>
                  {/* One column: the drawer is narrow at every screen size. */}
                  <div className="grid gap-3">
                    {PIPELINE_TEMPLATES.map((option) => {
                      const selected = option.key === templateKey
                      const Icon = option.key === 'sales' ? Handshake : Users
                      return (
                        <button
                          key={option.key}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => chooseTemplate(option.key)}
                          className={`flex h-full flex-col rounded-xl p-4 text-left ring-1 transition-colors duration-press ${
                            selected
                              ? 'bg-secondary-soft/50 ring-2 ring-secondary'
                              : 'bg-surface ring-line hover:bg-surface-hover/40'
                          }`}
                        >
                          <span className="flex items-center gap-2.5">
                            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface text-secondary-text shadow-lift">
                              <Icon size={18} strokeWidth={2} aria-hidden />
                            </span>
                            <span className="text-body font-semibold text-ink">{option.name}</span>
                            {selected && (
                              <Check size={16} strokeWidth={2.2} aria-hidden className="ml-auto shrink-0 text-secondary-text" />
                            )}
                          </span>
                          <span className="mt-2 block text-label text-ink-2">{option.description}</span>
                          <span className="mt-3 flex flex-wrap gap-1.5">
                            {option.stages.slice(0, 4).map((stage) => (
                              <span key={stage} className="rounded-md bg-surface-hover px-1.5 py-0.5 text-caption text-ink-2">
                                {stage}
                              </span>
                            ))}
                            {option.stages.length > 4 && (
                              <span className="rounded-md bg-surface-hover px-1.5 py-0.5 text-caption text-ink-3">
                                +{option.stages.length - 4}
                              </span>
                            )}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            ) : step === 2 ? (
              <div>
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <h3 className="text-body font-semibold text-ink">Stages in order</h3>
                    <p className="mt-0.5 text-label text-ink-2">
                      Rename them, add or remove a stage, and put them in the order your team works.
                    </p>
                  </div>
                  <span className="shrink-0 text-caption text-ink-3 tabular-nums">{stages.length} stages</span>
                </div>

                <ul className="mt-3 flex flex-col gap-2" aria-label="Pipeline stages">
                  {stages.map((stage, index) => (
                    <li key={stage.key} className="flex items-center gap-1.5 rounded-lg bg-surface p-1.5 ring-1 ring-line">
                      <span className="grid size-7 shrink-0 place-items-center rounded-md bg-surface-hover text-caption font-semibold text-ink-2 tabular-nums">
                        {index + 1}
                      </span>
                      <input
                        aria-label={`Stage ${index + 1} name`}
                        maxLength={80}
                        value={stage.name}
                        onChange={(event) => setStageName(index, event.target.value)}
                        className="field-input h-9 min-w-0 flex-1"
                      />
                      <IconButton
                        label={`Move ${stage.name || `stage ${index + 1}`} up`}
                        onClick={() => moveStage(index, -1)}
                        disabled={index === 0}
                      >
                        <ArrowUp size={15} strokeWidth={2} aria-hidden />
                      </IconButton>
                      <IconButton
                        label={`Move ${stage.name || `stage ${index + 1}`} down`}
                        onClick={() => moveStage(index, 1)}
                        disabled={index === stages.length - 1}
                      >
                        <ArrowDown size={15} strokeWidth={2} aria-hidden />
                      </IconButton>
                      <IconButton
                        label={`Remove ${stage.name || `stage ${index + 1}`}`}
                        onClick={() => removeStage(index)}
                        disabled={stages.length === 1}
                        danger
                      >
                        <Trash2 size={15} strokeWidth={2} aria-hidden />
                      </IconButton>
                    </li>
                  ))}
                </ul>

                <Button type="button" variant="secondary" onClick={addStage} className="mt-2 w-full">
                  <Plus size={16} strokeWidth={2} aria-hidden />
                  Add stage
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                {/* What will be created: the name leads, then its stages in order. */}
                <section aria-labelledby={`${titleId}-summary`} className="rounded-xl bg-surface shadow-lift">
                  <div className="flex items-center gap-3 px-4 py-3.5">
                    <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-secondary-soft text-secondary-text">
                      <Layers size={19} strokeWidth={2} aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3
                        id={`${titleId}-summary`}
                        className="truncate text-title font-semibold tracking-title text-ink"
                        title={name.trim()}
                      >
                        {name.trim()}
                      </h3>
                      <p className="text-label text-ink-3">
                        {template.name} template <span aria-hidden>·</span>{' '}
                        <span className="tabular-nums">{stages.length}</span>{' '}
                        {stages.length === 1 ? 'stage' : 'stages'}
                      </p>
                    </div>
                  </div>
                  <ol className="border-t border-line px-4 py-2" aria-label="Stages in order">
                    {stages.map((stage, index) => (
                      <li key={stage.key} className="flex items-baseline gap-3 py-1.5 text-body text-ink">
                        <span className="w-5 shrink-0 text-right text-label text-ink-3 tabular-nums">{index + 1}</span>
                        <span className="min-w-0 break-words">{stage.name.trim()}</span>
                      </li>
                    ))}
                  </ol>
                </section>

                {/* People: a note about what comes next, so it stays quieter than the summary. */}
                <div className="flex gap-3 px-1">
                  <Users size={18} strokeWidth={2} aria-hidden className="mt-0.5 shrink-0 text-ink-3" />
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-body font-semibold text-ink">
                      People
                      <span className="rounded-md bg-surface-hover px-1.5 py-0.5 text-micro font-medium text-ink-2">
                        Soon
                      </span>
                    </p>
                    <p className="mt-1 text-label text-ink-2">
                      Choose who can work this pipeline. You’ll be able to add people after creating it.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Step 1 can be cancelled; later steps go Back instead (✕ and Escape still close). */}
        <div className="flex items-center gap-2 border-t border-line bg-canvas/60 px-5 py-3.5 [&>*]:flex-1 sm:justify-end sm:[&>*]:flex-none">
          {step === 1 ? (
            <Button variant="secondary" type="button" onClick={close} disabled={saving}>
              Cancel
            </Button>
          ) : (
            <Button
              variant="secondary"
              type="button"
              onClick={() => {
                setError(null)
                setStep((current) => (current - 1) as Step)
              }}
              disabled={saving}
            >
              Back
            </Button>
          )}
          <Button type="submit" variant="primary" loading={saving}>
            {saving ? 'Creating…' : step === 3 ? 'Create pipeline' : 'Next'}
          </Button>
        </div>
      </form>
    </dialog>
  )
}

function IconButton({
  label,
  onClick,
  disabled = false,
  danger = false,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`grid size-8 shrink-0 place-items-center rounded-md transition-colors duration-press disabled:opacity-30 ${
        danger ? 'text-ink-3 hover:bg-danger-soft hover:text-danger' : 'text-ink-3 hover:bg-surface-hover hover:text-ink'
      }`}
    >
      {children}
    </button>
  )
}
