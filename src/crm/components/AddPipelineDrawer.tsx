import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type Modifier,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, ChevronDown, GripVertical, Handshake, Layers, Pencil, Plus, Trash2, Users, X } from 'lucide-react'
import { forwardRef, useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Button } from '@/components/Button'
import { FormError, FormField } from '@/components/FormField'
import { ApiError } from '@/lib/api'
import { useSession } from '@/lib/auth'
import { createCrmPipeline, crmEligibleUsersQuery, CRM_PIPELINES_KEY, crmPipelinesQuery } from '@/lib/crm'
import type { CrmPipeline } from '../types'
import { PIPELINE_TEMPLATES, templateFor, type PipelineTemplateKey } from '../templates'
import { PipelineAccessPicker } from './PipelineAccessPicker'

interface AddPipelineDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** `visible` is false when a manager left themselves off the access list. */
  onCreated: (pipeline: CrmPipeline, visible: boolean) => void
}

interface DraftStage {
  key: string
  name: string
}

const STEPS = ['Template', 'Stages', 'People'] as const
type Step = 1 | 2 | 3

const DEFAULT_TEMPLATE: PipelineTemplateKey = 'sales'

/** Stages only move up and down. */
const verticalOnly: Modifier = ({ transform }) => ({ ...transform, x: 0 })

let stageKey = 0
const draftStage = (name: string): DraftStage => ({ key: `stage-${++stageKey}`, name })
const draftStages = (names: string[]) => names.map(draftStage)

/**
 * Create a pipeline from a template, then rename, add, remove or reorder its
 * stages. A side drawer on the shared `app-drawer` shell. It stays mounted so
 * it can slide out, and starts over at step 1 every time it opens.
 */
export function AddPipelineDrawer({ open, onOpenChange, onCreated }: AddPipelineDrawerProps) {
  const queryClient = useQueryClient()
  const ref = useRef<HTMLDialogElement>(null)
  // The dialog element in state too, for the drag announcer's container (refs can't be read in render).
  const [dialogEl, setDialogEl] = useState<HTMLDialogElement | null>(null)
  const attachDialog = useCallback((node: HTMLDialogElement | null) => {
    ref.current = node
    setDialogEl(node)
  }, [])
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
  /** Step 2: the "Add stage" field, its error, and the stage being renamed (one at a time). */
  const [newStageName, setNewStageName] = useState('')
  const [newStageError, setNewStageError] = useState<string | null>(null)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const newStageRef = useRef<HTMLInputElement>(null)
  /** Step 3: people unticked by hand. Everyone else with CRM access is on the list. */
  const [excluded, setExcluded] = useState<Set<string>>(() => new Set())
  /** Step 3: the summary's stage list, folded away until asked for. */
  const [stagesShown, setStagesShown] = useState(false)
  const { user } = useSession()
  const isOwner = user.role === 'owner'
  const eligibleQuery = useQuery({ ...crmEligibleUsersQuery(), enabled: open })
  const eligibleUsers = eligibleQuery.data
  const stageSensors = useSensors(
    // A few pixels before a drag starts, so a click on the handle stays a click.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

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
      setNewStageName('')
      setNewStageError(null)
      setEditingKey(null)
      setExcluded(new Set())
      setStagesShown(false)
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

  /** Empty, or the same as another stage (case-insensitive). `exceptKey` skips the stage being renamed. */
  function stageNameProblem(value: string, exceptKey?: string): string | null {
    const wanted = value.trim().toLowerCase()
    if (!wanted) return 'Enter a stage name.'
    if (stages.some((stage) => stage.key !== exceptKey && stage.name.trim().toLowerCase() === wanted)) {
      return 'A stage with that name already exists.'
    }
    return null
  }

  /** Saves a rename. Returns the problem instead when the name can't be used. */
  function renameStage(key: string, value: string): string | null {
    const problem = stageNameProblem(value, key)
    if (problem) return problem
    setStages((current) => current.map((stage) => (stage.key === key ? { ...stage, name: value.trim() } : stage)))
    setEditingKey(null)
    setError(null)
    setConfiguring(true)
    return null
  }

  /** Drag and drop: puts the dragged stage where it was dropped. */
  function onStageDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    setStages((current) => {
      const from = current.findIndex((stage) => stage.key === active.id)
      const to = current.findIndex((stage) => stage.key === over.id)
      return from < 0 || to < 0 ? current : arrayMove(current, from, to)
    })
    setConfiguring(true)
  }

  const stageLabel = (key: string | number) => {
    const index = stages.findIndex((stage) => stage.key === key)
    return stages[index]?.name.trim() || `Stage ${index + 1}`
  }
  const position = (key: string | number) => stages.findIndex((stage) => stage.key === key) + 1
  const stageAnnouncements: Announcements = {
    onDragStart: ({ active }) =>
      `Picked up ${stageLabel(active.id)}, position ${position(active.id)} of ${stages.length}.`,
    onDragOver: ({ active, over }) =>
      over ? `${stageLabel(active.id)} moved to position ${position(over.id)} of ${stages.length}.` : undefined,
    onDragEnd: ({ active, over }) =>
      over ? `Dropped ${stageLabel(active.id)} at position ${position(over.id)} of ${stages.length}.` : undefined,
    onDragCancel: ({ active }) => `Cancelled. ${stageLabel(active.id)} is back where it was.`,
  }

  function removeStage(key: string) {
    if (stages.length === 1) return
    setStages((current) => current.filter((stage) => stage.key !== key))
    if (editingKey === key) setEditingKey(null)
    setError(null)
    setConfiguring(true)
  }

  /** The "Add stage" field: appends the stage, then clears and refocuses the field for the next one. */
  function addStage() {
    const problem = stageNameProblem(newStageName)
    if (problem) {
      setNewStageError(problem)
      newStageRef.current?.focus()
      return
    }
    setStages((current) => [...current, draftStage(newStageName.trim())])
    setNewStageName('')
    setNewStageError(null)
    setError(null)
    setConfiguring(true)
    newStageRef.current?.focus()
  }

  function toggleAccess(id: string) {
    setExcluded((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setConfiguring(true)
  }

  /**
   * Select all: untick everyone when everyone listed is ticked, otherwise tick
   * them all. Decided from the people listed now, so someone who dropped off
   * the list (lost the CRM menu) can't make the first click look dead.
   */
  function toggleAllAccess() {
    const everyone = (eligibleUsers ?? []).map((person) => person.id)
    setExcluded((current) => (everyone.every((id) => !current.has(id)) ? new Set(everyone) : new Set()))
    setConfiguring(true)
  }

  /** The access list to save: everyone eligible who wasn't unticked. */
  const accessIds = (eligibleUsers ?? []).filter((person) => !excluded.has(person.id)).map((person) => person.id)
  // Managers need a row to see a pipeline; owners see every pipeline.
  const creatorKeepsAccess = isOwner || accessIds.includes(user.id)
  const selfWarning =
    !isOwner && eligibleUsers?.some((person) => person.id === user.id) && excluded.has(user.id)
      ? 'You won’t see this pipeline after creating it.'
      : null

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
    if (!eligibleQuery.isSuccess) {
      setError(
        eligibleQuery.isError
          ? 'Couldn’t load the people with CRM access. Try again before creating the pipeline.'
          : 'Still loading the people with CRM access. Try again in a moment.',
      )
      return
    }
    setSaving(true)
    setError(null)
    try {
      const pipeline = await createCrmPipeline({
        name: name.trim(),
        stages: stages.map((stage) => stage.name.trim()),
        userIds: accessIds,
      })
      // Put it in the list before selecting it, so the page doesn't fall back
      // to the old first pipeline while the list refetches. Skipped when the
      // creator left themselves off: they won't see it.
      if (creatorKeepsAccess) {
        queryClient.setQueryData<CrmPipeline[]>([...CRM_PIPELINES_KEY], (current = []) => [
          ...current.filter((item) => item.id !== pipeline.id),
          pipeline,
        ])
      }
      await queryClient.invalidateQueries({ queryKey: CRM_PIPELINES_KEY })
      onCreated(pipeline, creatorKeepsAccess)
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
      ref={attachDialog}
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
              <div className="flex flex-col gap-4">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <h3 className="text-body font-semibold text-ink">Stages in order</h3>
                    <p className="mt-0.5 text-label text-ink-2">
                      Add, rename or remove stages, and drag them into the order your team works.
                    </p>
                  </div>
                  <span className="shrink-0 text-caption text-ink-3 tabular-nums">{stages.length} stages</span>
                </div>

                <div className="rounded-xl bg-surface p-3 ring-1 ring-line">
                  <label htmlFor="add-stage-name" className="text-label text-ink-2">
                    Add stage
                  </label>
                  <div className="mt-1.5 flex gap-2">
                    <input
                      ref={newStageRef}
                      id="add-stage-name"
                      maxLength={80}
                      value={newStageName}
                      onChange={(event) => {
                        setNewStageName(event.target.value)
                        setNewStageError(null)
                      }}
                      onKeyDown={(event) => {
                        // Enter adds the stage here; it must not submit the wizard (Next).
                        if (event.key !== 'Enter') return
                        event.preventDefault()
                        addStage()
                      }}
                      placeholder="New stage name"
                      aria-invalid={!!newStageError}
                      aria-describedby={newStageError ? 'add-stage-error' : undefined}
                      className="field-input h-9 min-w-0 flex-1"
                    />
                    <Button
                      type="button"
                      variant="primary"
                      onClick={addStage}
                      disabled={!newStageName.trim()}
                      aria-label="Add stage"
                      title="Add stage"
                      className="w-9 shrink-0 px-0!"
                    >
                      <Plus size={17} strokeWidth={2.25} aria-hidden />
                    </Button>
                  </div>
                  {newStageError && (
                    <p id="add-stage-error" className="mt-1.5 text-caption text-danger">
                      {newStageError}
                    </p>
                  )}
                </div>

                <DndContext
                  sensors={stageSensors}
                  collisionDetection={closestCenter}
                  modifiers={[verticalOnly]}
                  onDragEnd={onStageDragEnd}
                  accessibility={{
                    // Inside the dialog: a modal dialog makes the rest of the page inert, so a
                    // live region left on <body> would never be read out.
                    container: dialogEl ?? undefined,
                    announcements: stageAnnouncements,
                    screenReaderInstructions: {
                      draggable:
                        'To move a stage, press Space or Enter on its handle. Use the up and down arrow keys to move it, Space or Enter to drop it, or Escape to cancel.',
                    },
                  }}
                >
                  <SortableContext items={stages.map((stage) => stage.key)} strategy={verticalListSortingStrategy}>
                    <ul className="flex flex-col gap-2" aria-label="Pipeline stages">
                      {stages.map((stage, index) => (
                        <SortableStageRow
                          key={stage.key}
                          stage={stage}
                          index={index}
                          count={stages.length}
                          editing={editingKey === stage.key}
                          onStartEdit={() => setEditingKey(stage.key)}
                          onRename={(value) => renameStage(stage.key, value)}
                          onCancelEdit={() => setEditingKey(null)}
                          onRemove={() => removeStage(stage.key)}
                        />
                      ))}
                    </ul>
                  </SortableContext>
                </DndContext>
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                {/* What will be created: the name leads; its stages fold out on demand. */}
                <section className="rounded-xl bg-surface shadow-lift">
                  <h3>
                    <button
                      type="button"
                      onClick={() => setStagesShown((shown) => !shown)}
                      aria-expanded={stagesShown}
                      aria-controls={`${titleId}-stages`}
                      className="flex w-full items-center gap-3 rounded-xl px-4 py-3.5 text-left transition-colors duration-press hover:bg-surface-hover/50"
                    >
                      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-secondary-soft text-secondary-text">
                        <Layers size={19} strokeWidth={2} aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          className="block truncate text-title font-semibold tracking-title text-ink"
                          title={name.trim()}
                        >
                          {name.trim()}
                        </span>
                        <span className="block text-label text-ink-3">
                          {template.name} template <span aria-hidden>·</span>{' '}
                          <span className="tabular-nums">{stages.length}</span>{' '}
                          {stages.length === 1 ? 'stage' : 'stages'}
                        </span>
                      </span>
                      <ChevronDown
                        size={18}
                        strokeWidth={2}
                        aria-hidden
                        className={`shrink-0 text-ink-3 transition-transform duration-enter ease-out-expo ${
                          stagesShown ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                  </h3>
                  {/* Height animates through grid rows (0fr → 1fr); hidden content stays out of the tab order. */}
                  <div
                    id={`${titleId}-stages`}
                    className={`grid transition-[grid-template-rows] duration-enter ease-out-expo ${
                      stagesShown ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                    }`}
                    inert={!stagesShown}
                  >
                    <div className="min-h-0 overflow-hidden">
                      <ol className="border-t border-line px-4 py-2" aria-label="Stages in order">
                        {stages.map((stage, index) => (
                          <li key={stage.key} className="flex items-baseline gap-3 py-1.5 text-body text-ink">
                            <span className="w-5 shrink-0 text-right text-label text-ink-3 tabular-nums">{index + 1}</span>
                            <span className="min-w-0 break-words">{stage.name.trim()}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  </div>
                </section>

                <PipelineAccessPicker
                  users={eligibleUsers}
                  loading={eligibleQuery.isPending}
                  failed={eligibleQuery.isError}
                  onRetry={() => void eligibleQuery.refetch()}
                  excluded={excluded}
                  onToggle={toggleAccess}
                  onToggleAll={toggleAllAccess}
                  selfWarning={selfWarning}
                  canManagePermissions={isOwner}
                />
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

/**
 * One stage in step 2: drag handle, number, name, then rename and remove.
 * Rename swaps the name for a field: Enter or leaving the field saves,
 * Escape cancels (and doesn't close the drawer).
 */
function SortableStageRow({
  stage,
  index,
  count,
  editing,
  onStartEdit,
  onRename,
  onCancelEdit,
  onRemove,
}: {
  stage: DraftStage
  index: number
  count: number
  editing: boolean
  onStartEdit: () => void
  /** Returns the problem when the name can't be used; the field then stays open. */
  onRename: (value: string) => string | null
  onCancelEdit: () => void
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: stage.key,
    disabled: editing,
  })
  const [draft, setDraft] = useState(stage.name)
  const [problem, setProblem] = useState<string | null>(null)
  const editButtonRef = useRef<HTMLButtonElement>(null)
  const wasEditing = useRef(editing)
  const errorId = `${stage.key}-error`
  const label = stage.name.trim() || `stage ${index + 1}`

  // Opening the field starts from the current name; closing it hands focus back to the pencil.
  useEffect(() => {
    if (editing && !wasEditing.current) {
      setDraft(stage.name)
      setProblem(null)
    }
    if (!editing && wasEditing.current) editButtonRef.current?.focus()
    wasEditing.current = editing
  }, [editing, stage.name])

  function save() {
    setProblem(onRename(draft))
  }

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`relative rounded-lg bg-surface px-2 py-2 ring-1 ${
        isDragging ? 'z-10 shadow-dialog ring-line-strong' : 'ring-line'
      }`}
    >
      <div className="flex min-h-9 items-center gap-2">
        <button
          ref={setActivatorNodeRef}
          type="button"
          aria-label={`Drag ${label} to reorder`}
          title="Drag to reorder"
          disabled={editing}
          className={`grid h-8 w-7 shrink-0 touch-none place-items-center rounded-md text-ink-3 hover:bg-surface-hover hover:text-ink disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent ${
            isDragging ? 'cursor-grabbing' : 'cursor-grab'
          }`}
          {...attributes}
          {...listeners}
        >
          <GripVertical size={16} strokeWidth={2} aria-hidden />
        </button>
        <span className="w-5 shrink-0 text-right text-label text-ink-3 tabular-nums">{index + 1}</span>

        {editing ? (
          <input
            autoFocus
            aria-label={`Rename ${label}`}
            maxLength={80}
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value)
              setProblem(null)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                // Save the name; don't submit the wizard.
                event.preventDefault()
                save()
              } else if (event.key === 'Escape') {
                // Cancel the rename; preventDefault keeps the dialog from closing.
                event.preventDefault()
                event.stopPropagation()
                onCancelEdit()
              }
            }}
            // Leaving the field saves a usable name and quietly drops one that isn't.
            onBlur={() => {
              if (onRename(draft)) onCancelEdit()
            }}
            onFocus={(event) => event.currentTarget.select()}
            aria-invalid={!!problem}
            aria-describedby={problem ? errorId : undefined}
            className="field-input h-9 min-w-0 flex-1"
          />
        ) : (
          <span className="min-w-0 flex-1 truncate text-body text-ink" title={stage.name}>
            {stage.name}
          </span>
        )}

        {!editing && (
          <>
            <IconButton ref={editButtonRef} label={`Rename ${label}`} onClick={onStartEdit}>
              <Pencil size={15} strokeWidth={2} aria-hidden />
            </IconButton>
            <IconButton label={`Remove ${label}`} onClick={onRemove} disabled={count === 1} danger>
              <Trash2 size={15} strokeWidth={2} aria-hidden />
            </IconButton>
          </>
        )}
      </div>
      {editing && problem && (
        <p id={errorId} className="mt-1 pl-16 text-caption text-danger">
          {problem}
        </p>
      )}
    </li>
  )
}

const IconButton = forwardRef<
  HTMLButtonElement,
  { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: ReactNode }
>(function IconButton({ label, onClick, disabled = false, danger = false, children }, ref) {
  return (
    <button
      ref={ref}
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
})
