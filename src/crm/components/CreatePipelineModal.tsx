import { useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, Check, Handshake, Layers, Plus, Trash2, Users } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Button } from '@/components/Button'
import { FormError, FormField } from '@/components/FormField'
import { Modal } from '@/components/Modal'
import { ApiError } from '@/lib/api'
import { createCrmPipeline, CRM_PIPELINES_KEY } from '@/lib/crm'
import type { CrmPipeline } from '../types'
import { PIPELINE_TEMPLATES, templateFor, type PipelineTemplateKey } from '../templates'

interface CreatePipelineModalProps {
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

let stageKey = 0
const draftStage = (name: string): DraftStage => ({ key: `stage-${++stageKey}`, name })
const draftStages = (names: string[]) => names.map(draftStage)

function uniqueStageName(stages: DraftStage[]): string {
  const taken = new Set(stages.map((stage) => stage.name.trim().toLowerCase()))
  let number = stages.length + 1
  while (taken.has(`stage ${number}`)) number += 1
  return `Stage ${number}`
}

/** Create a pipeline from a template, then rename, add, remove or reorder its stages. */
export function CreatePipelineModal({ open, onOpenChange, onCreated }: CreatePipelineModalProps) {
  const queryClient = useQueryClient()
  const [step, setStep] = useState<Step>(1)
  const [templateKey, setTemplateKey] = useState<PipelineTemplateKey>('sales')
  const [name, setName] = useState(templateFor('sales').name)
  const [stages, setStages] = useState<DraftStage[]>(() => draftStages(templateFor('sales').stages))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)


  const template = templateFor(templateKey)

  function chooseTemplate(nextKey: PipelineTemplateKey) {
    const next = templateFor(nextKey)
    setTemplateKey(nextKey)
    // Keep a name the person typed; swap the template's own name for the new one.
    setName((current) => (!current.trim() || current === template.name ? next.name : current))
    setStages(draftStages(next.stages))
    setError(null)
  }

  function setStageName(index: number, value: string) {
    setStages((current) => current.map((stage, i) => (i === index ? { ...stage, name: value } : stage)))
    setError(null)
  }

  function moveStage(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= stages.length) return
    setStages((current) => {
      const next = [...current]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  function removeStage(index: number) {
    if (stages.length === 1) return
    setStages((current) => current.filter((_, i) => i !== index))
    setError(null)
  }

  function addStage() {
    setStages((current) => [...current, draftStage(uniqueStageName(current))])
    setError(null)
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
      if (!name.trim()) {
        setError('Give the pipeline a name.')
        return
      }
      setStep(2)
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
    <Modal
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : !saving && onOpenChange(false))}
      busy={saving}
      wide
      title="Create a pipeline"
      description="Start from a template, then make the stages yours."
    >
      <form
        noValidate
        className="flex max-h-[min(72vh,38rem)] flex-col overflow-hidden"
        onSubmit={(event) => {
          event.preventDefault()
          goNext()
        }}
      >
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-4">
          <ol className="flex items-center gap-2" aria-label="Create pipeline steps">
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
                  <span
                    className={`truncate text-caption ${active ? 'font-medium text-ink' : 'text-ink-3'}`}
                  >
                    {label}
                  </span>
                  {number < STEPS.length && (
                    <span className={`h-px flex-1 ${number < step ? 'bg-secondary' : 'bg-line'}`} />
                  )}
                </li>
              )
            })}
          </ol>

          <div className="mt-5">
            <FormError message={error} />

            {step === 1 ? (
              <div className="flex flex-col gap-4">
                <FormField label="Pipeline name" htmlFor="create-pipeline-name">
                  <input
                    id="create-pipeline-name"
                    autoFocus
                    maxLength={120}
                    value={name}
                    onChange={(event) => {
                      setName(event.target.value)
                      setError(null)
                    }}
                    placeholder="Sales"
                    className="field-input"
                  />
                </FormField>

                <div role="group" aria-label="Pipeline template">
                  <span className="mb-1.5 block text-label font-medium text-ink-2">Start from a template</span>
                  <div className="grid gap-3 sm:grid-cols-2">
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
                              <Check
                                size={16}
                                strokeWidth={2.2}
                                aria-hidden
                                className="ml-auto shrink-0 text-secondary-text"
                              />
                            )}
                          </span>
                          <span className="mt-2 block text-label text-ink-2">{option.description}</span>
                          <span className="mt-3 flex flex-wrap gap-1.5">
                            {option.stages.slice(0, 4).map((stage) => (
                              <span
                                key={stage}
                                className="rounded-md bg-surface-hover px-1.5 py-0.5 text-caption text-ink-2"
                              >
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
                    <li
                      key={stage.key}
                      className="flex items-center gap-1.5 rounded-lg bg-canvas p-1.5 ring-1 ring-line"
                    >
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
              <div>
                <div className="rounded-xl bg-surface p-4 shadow-lift">
                  <div className="flex items-start gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-secondary-soft text-secondary-text">
                      <Layers size={19} strokeWidth={2} aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-caption font-medium text-ink-3">New pipeline</p>
                      <h3 className="mt-0.5 truncate text-title font-semibold tracking-title text-ink">
                        {name.trim()}
                      </h3>
                    </div>
                    <span className="shrink-0 rounded-md bg-surface-hover px-2 py-0.5 text-caption font-medium text-ink-2">
                      {template.name} template
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {stages.map((stage, index) => (
                      <span
                        key={stage.key}
                        className="inline-flex items-center gap-1 rounded-md bg-surface-hover px-1.5 py-0.5 text-caption text-ink-2"
                      >
                        <span className="text-ink-3 tabular-nums">{index + 1}</span>
                        {stage.name.trim()}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-3 flex items-start gap-3 rounded-xl bg-canvas p-4 ring-1 ring-line">
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-surface text-ink-3 shadow-lift">
                    <Users size={19} strokeWidth={2} aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-body font-semibold text-ink">User assignment</h3>
                      <span className="rounded-md bg-secondary-soft px-2 py-0.5 text-caption font-medium text-secondary-text">
                        Coming soon
                      </span>
                    </div>
                    <p className="mt-1 text-label text-ink-2">
                      Choose who can work this pipeline. You’ll be able to add people after creating it.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-5 flex items-center gap-2 border-t border-line bg-canvas/60 px-5 py-3.5 [&>*]:flex-1 sm:justify-end sm:[&>*]:flex-none">
          <Button variant="secondary" type="button" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          {step > 1 && (
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
    </Modal>
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
        danger
          ? 'text-ink-3 hover:bg-danger-soft hover:text-danger'
          : 'text-ink-3 hover:bg-surface-hover hover:text-ink'
      }`}
    >
      {children}
    </button>
  )
}
