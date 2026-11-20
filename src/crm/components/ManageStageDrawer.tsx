import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
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
import { Check, GripVertical, Pencil, Plus, Trash2, X } from 'lucide-react'
import { forwardRef, useEffect, useId, useRef, useState } from 'react'
import { AlertDialog } from '@/components/Alert'
import { Button } from '@/components/Button'
import { Loader } from '@/components/Loader'
import { ApiError } from '@/lib/api'
import {
  crmBoardKey,
  CRM_PIPELINES_KEY,
  crmStageSummaryKey,
  crmStageSummaryQuery,
  createCrmStage,
  deleteCrmStage,
  renameCrmStage,
  reorderCrmStages,
  type CrmBoard,
} from '@/lib/crm'
import type { CrmStage } from '../types'

interface ManageStageDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The pipeline whose stages are managed. */
  pipelineId: string
}

/**
 * The stage manager: loads the selected pipeline's stages and their deal
 * counts, reorders by drag, renames in place, and deletes only empty stages.
 * Same `app-drawer` shell as the other CRM drawers; it stays mounted.
 */
export function ManageStageDrawer({ open, onOpenChange, pipelineId }: ManageStageDrawerProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const queryClient = useQueryClient()
  const summary = useQuery({ ...crmStageSummaryQuery(pipelineId), enabled: open && Boolean(pipelineId) })

  /** A drag reorders locally until the save finishes; server data is shown otherwise. */
  const [optimistic, setOptimistic] = useState<{ pipelineId: string; stages: CrmStage[] } | null>(null)
  const stages = optimistic?.pipelineId === pipelineId ? optimistic.stages : (summary.data?.stages ?? [])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<CrmStage | null>(null)
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newNameError, setNewNameError] = useState<string | null>(null)
  const newNameRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Start clean each time it opens (in render, so nothing stale slides in).
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setEditingId(null)
      setDeleting(null)
      setAdding(false)
      setNewName('')
      setNewNameError(null)
      setError(null)
    }
  }

  useEffect(() => {
    if (adding) newNameRef.current?.focus()
  }, [adding])

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      dialog.focus()
    } else if (!open && dialog.open) dialog.close()
  }, [open])

  function close() {
    if (busy) return
    onOpenChange(false)
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  /**
   * Stage edits only change names, order and counts. Updating those caches in
   * place avoids refetching the board, which would replay every loaded page.
   * The pipeline list is refreshed in the background so its stages stay fresh.
   */
  function updateCaches(change: (board: CrmBoard) => CrmBoard) {
    for (const key of [crmStageSummaryKey(pipelineId), crmBoardKey(pipelineId)]) {
      queryClient.setQueryData<CrmBoard>(key, (current) => (current ? change(current) : current))
    }
    void queryClient.invalidateQueries({ queryKey: CRM_PIPELINES_KEY })
  }

  const label = (id: string | number) => stages.find((stage) => stage.id === id)?.name ?? 'stage'

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${label(active.id)}.`,
    onDragOver: ({ active, over }) => (over ? `${label(active.id)} moved over ${label(over.id)}.` : undefined),
    onDragEnd: ({ active, over }) =>
      over ? `Dropped ${label(active.id)} at position ${stages.findIndex((s) => s.id === over.id) + 1}.` : undefined,
    onDragCancel: ({ active }) => `Cancelled. ${label(active.id)} is back where it was.`,
  }

  /** Reorder optimistically, then persist the whole order. */
  async function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    const from = stages.findIndex((stage) => stage.id === active.id)
    const to = stages.findIndex((stage) => stage.id === over.id)
    if (from < 0 || to < 0) return
    const next = arrayMove(stages, from, to)
    setOptimistic({ pipelineId, stages: next })
    setError(null)
    setBusy(true)
    try {
      await reorderCrmStages(pipelineId, next.map((stage) => stage.id))
      updateCaches((board) => ({
        ...board,
        stages: next.map((stage, index) => ({ ...stage, position: index })),
      }))
    } catch (caught) {
      setError(message(caught, 'Couldn’t reorder the stages. Try again.'))
    } finally {
      // Back to the server's order, whether the save worked or not.
      setOptimistic(null)
      setBusy(false)
    }
  }

  /** Validate locally first: names must be non-blank and unique here. */
  function nameProblem(id: string, value: string): string | null {
    const wanted = value.trim().toLowerCase()
    if (!wanted) return 'Enter a stage name.'
    if (stages.some((stage) => stage.id !== id && stage.name.trim().toLowerCase() === wanted)) {
      return 'A stage with that name already exists.'
    }
    return null
  }

  async function rename(stage: CrmStage, value: string): Promise<string | null> {
    const next = value.trim()
    if (next === stage.name) {
      setEditingId(null)
      return null
    }
    const problem = nameProblem(stage.id, next)
    if (problem) return problem
    setBusy(true)
    try {
      await renameCrmStage(stage.id, next)
      updateCaches((board) => ({
        ...board,
        stages: board.stages.map((item) => (item.id === stage.id ? { ...item, name: next } : item)),
      }))
      setEditingId(null)
      return null
    } catch (caught) {
      return message(caught, 'Couldn’t rename the stage. Try again.')
    } finally {
      setBusy(false)
    }
  }

  async function confirmDelete() {
    if (!deleting) return
    const id = deleting.id
    setBusy(true)
    try {
      await deleteCrmStage(id)
      setDeleting(null)
      updateCaches((board) => {
        const columns = { ...board.columns }
        delete columns[id]
        const totals = { ...board.totals }
        delete totals[id]
        return { ...board, stages: board.stages.filter((stage) => stage.id !== id), columns, totals }
      })
    } catch (caught) {
      setDeleting(null)
      setError(message(caught, 'Couldn’t delete the stage. Try again.'))
    } finally {
      setBusy(false)
    }
  }

  function cancelAdd() {
    setAdding(false)
    setNewName('')
    setNewNameError(null)
  }

  /** New stages go last, with an empty column; the list refreshes quietly afterwards. */
  async function addStage() {
    const name = newName.trim()
    if (!name) {
      setNewNameError('Enter a stage name.')
      newNameRef.current?.focus()
      return
    }
    if (stages.some((stage) => stage.name.trim().toLowerCase() === name.toLowerCase())) {
      setNewNameError('A stage with that name already exists.')
      newNameRef.current?.focus()
      return
    }
    setBusy(true)
    try {
      const stage: CrmStage = await createCrmStage(pipelineId, name)
      updateCaches((board) => ({
        ...board,
        stages: [...board.stages, stage],
        totals: { ...board.totals, [stage.id]: 0 },
        columns: { ...board.columns, [stage.id]: [] },
      }))
      cancelAdd()
    } catch (caught) {
      setNewNameError(message(caught, 'Couldn’t add the stage. Try again.'))
    } finally {
      setBusy(false)
    }
  }

  const totals = summary.data?.totals ?? {}
  const loading = summary.isPending && Boolean(pipelineId)

  return (
    <>
      <dialog
        ref={ref}
        aria-labelledby={titleId}
        onCancel={(event) => {
          event.preventDefault()
          close()
        }}
        onClose={() => {
          if (busy) ref.current?.showModal()
          else if (open) onOpenChange(false)
        }}
        onKeyDown={(event) => event.key === 'Escape' && event.stopPropagation()}
        onClick={(event) => event.target === event.currentTarget && close()}
        tabIndex={-1}
        className="app-drawer w-full max-w-sheet border-0 bg-surface p-0 text-ink shadow-dialog outline-none"
      >
        <div className="flex h-full flex-col">
          <div className="flex items-start gap-2 border-b border-line px-4 py-3.5">
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="truncate text-title font-semibold tracking-title">
                Manage stages
              </h2>
            </div>
            <button
              type="button"
              onClick={close}
              disabled={busy}
              aria-label="Close"
              className="grid size-9 shrink-0 place-items-center rounded-md text-ink-3 hover:bg-surface-hover hover:text-ink disabled:opacity-50"
            >
              <X size={18} strokeWidth={1.9} aria-hidden />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto bg-canvas px-4 py-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <p className="min-w-0 self-center text-label text-ink-2">
                Drag to reorder. Delete only empty stages.
              </p>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setError(null)
                  setNewNameError(null)
                  setAdding(true)
                }}
                disabled={busy || adding}
                aria-label="Add stage"
                title="Add stage"
                className="w-8 shrink-0 self-center px-0!"
              >
                <Plus size={16} strokeWidth={2.5} aria-hidden />
              </Button>
            </div>
            {adding && (
              <div className="card-3d mb-3 rounded-lg p-2">
                <div className="flex items-center gap-2">
                  <input
                    ref={newNameRef}
                    aria-label="New stage name"
                    maxLength={80}
                    value={newName}
                    onChange={(event) => {
                      setNewName(event.target.value)
                      setNewNameError(null)
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        void addStage()
                      } else if (event.key === 'Escape') {
                        event.preventDefault()
                        event.stopPropagation()
                        cancelAdd()
                      }
                    }}
                    placeholder="New stage name"
                    aria-invalid={Boolean(newNameError)}
                    className="field-input h-9 min-w-0 flex-1"
                  />
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => void addStage()}
                    disabled={busy}
                    aria-label="Save stage"
                    title="Save stage"
                    className="w-8 shrink-0 px-0!"
                  >
                    <Check size={16} strokeWidth={2.5} aria-hidden />
                  </Button>
                  <IconButton label="Cancel" onClick={cancelAdd} disabled={busy}>
                    <X size={16} strokeWidth={2} aria-hidden />
                  </IconButton>
                </div>
                {newNameError && <p className="mt-1 text-caption text-danger">{newNameError}</p>}
              </div>
            )}
            {error && <p role="alert" className="mb-3 text-label text-danger">{error}</p>}
            {loading ? (
              <div className="grid place-items-center py-10">
                <Loader label="Loading stages" />
              </div>
            ) : summary.isError ? (
              <div className="text-center">
                <p className="text-label text-danger">Couldn’t load the stages. Try again.</p>
                <Button variant="secondary" className="mt-3" onClick={() => void summary.refetch()}>
                  Retry
                </Button>
              </div>
            ) : stages.length === 0 ? (
              <p className="py-10 text-center text-label text-ink-3">This pipeline has no stages.</p>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={(event) => void onDragEnd(event)}
                accessibility={{ announcements }}
              >
                <SortableContext items={stages.map((stage) => stage.id)} strategy={verticalListSortingStrategy}>
                  <ul className="flex flex-col gap-2" aria-label="Stages in board order">
                    {stages.map((stage, index) => (
                      <StageRow
                        key={stage.id}
                        stage={stage}
                        index={index}
                        count={totals[stage.id]}
                        editing={editingId === stage.id}
                        locked={busy}
                        onStartEdit={() => {
                          setError(null)
                          setEditingId(stage.id)
                        }}
                        onRename={(value) => rename(stage, value)}
                        onCancelEdit={() => setEditingId(null)}
                        onDelete={() => {
                          setError(null)
                          setDeleting(stage)
                        }}
                      />
                    ))}
                  </ul>
                </SortableContext>
              </DndContext>
            )}
          </div>

          <div className="flex justify-end border-t border-line bg-canvas/60 px-5 py-3.5">
            <Button variant="secondary" onClick={close} disabled={busy}>
              Done
            </Button>
          </div>
        </div>
      </dialog>

      <AlertDialog
        open={Boolean(deleting)}
        onOpenChange={(next) => !next && setDeleting(null)}
        tone="danger"
        title={`Delete ${deleting?.name ?? 'this stage'}?`}
        description="The stage is empty, so only the column is removed. Your clients are untouched. This can’t be undone."
        confirmLabel="Delete stage"
        pendingLabel="Deleting…"
        onConfirm={confirmDelete}
      />
    </>
  )
}

function message(caught: unknown, fallback: string): string {
  return caught instanceof ApiError && caught.status !== 500 ? caught.message : fallback
}

interface StageRowProps {
  stage: CrmStage
  index: number
  /** Deal count; `undefined` means it wasn't loaded, so deleting is disabled. */
  count: number | undefined
  editing: boolean
  locked: boolean
  onStartEdit: () => void
  onRename: (value: string) => Promise<string | null>
  onCancelEdit: () => void
  onDelete: () => void
}

function StageRow({
  stage,
  index,
  count,
  editing,
  locked,
  onStartEdit,
  onRename,
  onCancelEdit,
  onDelete,
}: StageRowProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: stage.id,
    disabled: editing || locked,
  })
  const [draft, setDraft] = useState(stage.name)
  const [problem, setProblem] = useState<string | null>(null)
  const done = useRef(false)
  const editButtonRef = useRef<HTMLButtonElement>(null)
  const wasEditing = useRef(editing)
  const errorId = `${stage.id}-error`
  const label = stage.name.trim() || `stage ${index + 1}`
  const canDelete = count === 0

  useEffect(() => {
    if (editing && !wasEditing.current) {
      done.current = false
      setDraft(stage.name)
      setProblem(null)
    }
    // Only hand focus back when a rename actually finished, not on mount.
    if (!editing && wasEditing.current) editButtonRef.current?.focus()
    wasEditing.current = editing
  }, [editing, stage.name])

  /** Enter and blur can both fire; `done` makes the second one a no-op. */
  async function save() {
    if (done.current) return
    done.current = true
    const issue = await onRename(draft)
    setProblem(issue)
    if (issue) done.current = false
  }

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      // Raised like the buttons; while held, the bigger dialog shadow lifts it off the list.
      className={`card-3d rounded-lg px-2 py-2 ${isDragging ? 'relative z-10 shadow-dialog' : ''}`}
    >
      <div className="flex min-h-9 items-center gap-2">
        <button
          ref={setActivatorNodeRef}
          type="button"
          aria-label={`Drag ${label} to reorder`}
          title="Drag to reorder"
          disabled={editing || locked}
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
                event.preventDefault()
                void save()
              } else if (event.key === 'Escape') {
                event.preventDefault()
                event.stopPropagation()
                done.current = true
                onCancelEdit()
              }
            }}
            onBlur={() => void save()}
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

        {editing ? (
          <Button
            variant="primary"
            size="sm"
            onClick={() => void save()}
            disabled={locked}
            aria-label={`Save ${label}`}
            title={`Save ${label}`}
            className="w-8 shrink-0 px-0!"
          >
            <Check size={16} strokeWidth={2.5} aria-hidden />
          </Button>
        ) : (
          <span
            className="shrink-0 rounded-md bg-surface-hover px-1.5 py-0.5 text-caption text-ink-3 tabular-nums"
            aria-label={`${count ?? 0} deals`}
          >
            {count ?? '–'}
          </span>
        )}

        {!editing && (
          <>
            <IconButton
              ref={editButtonRef}
              label={`Rename ${label}`}
              onClick={onStartEdit}
              disabled={locked}
            >
              <Pencil size={15} strokeWidth={2} aria-hidden />
            </IconButton>
            {canDelete && (
              <IconButton label={`Delete ${label}`} onClick={onDelete} disabled={locked} danger>
                <Trash2 size={15} strokeWidth={2} aria-hidden />
              </IconButton>
            )}
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
  {
    label: string
    onClick: () => void
    disabled?: boolean
    danger?: boolean
    children: React.ReactNode
  }
>(function IconButton({ label, onClick, disabled, danger, children }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`grid size-7 shrink-0 place-items-center rounded-md transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent ${
        danger ? 'text-danger' : 'text-ink-3 hover:text-ink'
      }`}
    >
      {children}
    </button>
  )
})
