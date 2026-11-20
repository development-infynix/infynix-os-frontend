import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Layers, Pencil, Trash2, X } from 'lucide-react'
import { forwardRef, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { AlertDialog } from '@/components/Alert'
import { Button } from '@/components/Button'
import { Loader } from '@/components/Loader'
import { ApiError } from '@/lib/api'
import {
  CRM_KEY,
  crmPipelineDeleteImpactQuery,
  crmPipelinesQuery,
  deleteCrmPipeline,
  renameCrmPipeline,
} from '@/lib/crm'
import type { CrmPipeline } from '../types'

interface ManagePipelinesDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Manage pipelines: every pipeline you can see, renamed in place or deleted
 * (with its deals) after a confirmation. Same `app-drawer` shell as the
 * create-pipeline drawer; it stays mounted so it can slide out.
 */
export function ManagePipelinesDrawer({ open, onOpenChange }: ManagePipelinesDrawerProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  const queryClient = useQueryClient()
  const pipelinesQuery = useQuery({ ...crmPipelinesQuery(), enabled: open })
  const pipelines = pipelinesQuery.data ?? []
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<CrmPipeline | null>(null)
  /** True while a rename is saving: the drawer can't close mid-request. */
  const [busy, setBusy] = useState(false)

  // Start clean each time it opens (done in render so nothing stale slides in).
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setEditingId(null)
      setDeleting(null)
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

  function close() {
    if (busy) return
    onOpenChange(false)
  }

  /** Empty, or the same as another pipeline (case-insensitive, like the server). */
  function nameProblem(id: string, value: string): string | null {
    const wanted = value.trim().toLowerCase()
    if (!wanted) return 'Enter a pipeline name.'
    if (pipelines.some((item) => item.id !== id && item.name.trim().toLowerCase() === wanted)) {
      return 'A pipeline with that name already exists.'
    }
    return null
  }

  /** Saves a rename; returns the problem to show instead when it can't. */
  async function rename(pipeline: CrmPipeline, value: string): Promise<string | null> {
    const next = value.trim()
    if (next === pipeline.name) {
      setEditingId(null)
      return null
    }
    const problem = nameProblem(pipeline.id, next)
    if (problem) return problem
    setBusy(true)
    try {
      await renameCrmPipeline(pipeline.id, next)
      await queryClient.invalidateQueries({ queryKey: CRM_KEY })
      setEditingId(null)
      return null
    } catch (caught) {
      return caught instanceof ApiError && caught.status !== 500 ? caught.message : 'Couldn’t rename it. Try again.'
    } finally {
      setBusy(false)
    }
  }

  async function confirmDelete() {
    if (!deleting) return
    const id = deleting.id
    await deleteCrmPipeline(id)
    // Drop the deleted board before refetching, so nothing asks for it again.
    queryClient.removeQueries({ queryKey: [...CRM_KEY, 'board', id] })
    queryClient.removeQueries({ queryKey: [...CRM_KEY, 'delete-impact', id] })
    await queryClient.invalidateQueries({ queryKey: CRM_KEY })
  }

  const onlyOne = pipelines.length === 1

  return (
    <>
      <dialog
        ref={ref}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onCancel={(event) => {
          event.preventDefault()
          close()
        }}
        // If the browser closes it itself (Escape pressed twice), keep the page in step.
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
                Manage pipelines
              </h2>
              <p id={descriptionId} className="mt-0.5 text-label text-ink-3">
                Rename a pipeline, or delete it with all of its deals.
              </p>
            </div>
            <button
              type="button"
              onClick={close}
              disabled={busy}
              aria-label="Close"
              className="grid size-9 shrink-0 place-items-center rounded-md text-ink-3 hover:bg-surface-hover hover:text-ink disabled:opacity-40"
            >
              <X size={18} strokeWidth={1.9} aria-hidden />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto bg-canvas px-5 py-5">
            {pipelinesQuery.isPending ? (
              <div className="grid place-items-center py-10">
                <Loader label="Loading pipelines" />
              </div>
            ) : pipelinesQuery.isError ? (
              <div className="py-8 text-center">
                <p className="text-label text-ink-2">Couldn’t load your pipelines.</p>
                <Button size="sm" variant="secondary" className="mt-3" onClick={() => void pipelinesQuery.refetch()}>
                  Try again
                </Button>
              </div>
            ) : (
              <>
                {onlyOne && (
                  <p className="mb-3 px-1 text-caption text-ink-3">
                    Your company needs at least one pipeline, so the last one can’t be deleted.
                  </p>
                )}
                <ul className="flex flex-col gap-2" aria-label="Pipelines">
                  {pipelines.map((pipeline) => (
                    <PipelineRow
                      key={pipeline.id}
                      pipeline={pipeline}
                      editing={editingId === pipeline.id}
                      locked={busy && editingId !== pipeline.id}
                      deleteBlocked={onlyOne}
                      onStartEdit={() => setEditingId(pipeline.id)}
                      onCancelEdit={() => setEditingId(null)}
                      onRename={(value) => rename(pipeline, value)}
                      onDelete={() => setDeleting(pipeline)}
                    />
                  ))}
                </ul>
              </>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-line bg-canvas/60 px-5 py-3.5">
            <Button variant="secondary" onClick={close} disabled={busy}>
              Done
            </Button>
          </div>
        </div>
      </dialog>

      <DeletePipelineAlert pipeline={deleting} onClose={() => setDeleting(null)} onConfirm={confirmDelete} />
    </>
  )
}

/** The red confirmation, with exactly what will go. */
function DeletePipelineAlert({
  pipeline,
  onClose,
  onConfirm,
}: {
  pipeline: CrmPipeline | null
  onClose: () => void
  onConfirm: () => Promise<void>
}) {
  const impact = useQuery({ ...crmPipelineDeleteImpactQuery(pipeline?.id ?? ''), enabled: Boolean(pipeline) })
  const counts = impact.data
  const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`

  return (
    <AlertDialog
      open={Boolean(pipeline)}
      onOpenChange={(next) => !next && onClose()}
      tone="danger"
      title={`Delete ${pipeline?.name ?? 'this pipeline'}?`}
      description={
        impact.isPending ? (
          'Checking what’s in this pipeline…'
        ) : counts ? (
          <>
            This deletes the pipeline, its {plural(counts.stageCount, 'stage')} and{' '}
            <strong className="font-semibold text-ink">{plural(counts.dealCount, 'deal')}</strong>. The clients stay in
            your directory. This can’t be undone.
          </>
        ) : (
          'This deletes the pipeline with all of its stages and deals. The clients stay in your directory. This can’t be undone.'
        )
      }
      confirmLabel="Delete pipeline"
      pendingLabel="Deleting…"
      onConfirm={onConfirm}
    />
  )
}

/**
 * One pipeline: name and stage count, then rename and delete. Rename swaps the
 * name for a field: Enter saves, Escape cancels (without closing the drawer),
 * and leaving the field saves a changed name.
 */
function PipelineRow({
  pipeline,
  editing,
  locked,
  deleteBlocked,
  onStartEdit,
  onCancelEdit,
  onRename,
  onDelete,
}: {
  pipeline: CrmPipeline
  editing: boolean
  /** Another row is saving. */
  locked: boolean
  deleteBlocked: boolean
  onStartEdit: () => void
  onCancelEdit: () => void
  onRename: (value: string) => Promise<string | null>
  onDelete: () => void
}) {
  const [draft, setDraft] = useState(pipeline.name)
  const [problem, setProblem] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const editButtonRef = useRef<HTMLButtonElement>(null)
  const wasEditing = useRef(editing)
  const errorId = `${pipeline.id}-rename-error`

  // Opening starts from the current name; closing hands focus back to the pencil.
  useEffect(() => {
    if (editing && !wasEditing.current) {
      setDraft(pipeline.name)
      setProblem(null)
    }
    if (!editing && wasEditing.current) editButtonRef.current?.focus()
    wasEditing.current = editing
  }, [editing, pipeline.name])

  async function save() {
    if (saving) return
    setSaving(true)
    setProblem(await onRename(draft))
    setSaving(false)
  }

  const stageCount = pipeline.stages.length

  return (
    <li className="card-3d rounded-lg px-3 py-2.5">
      <div className="flex min-h-9 items-center gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-md bg-secondary-soft text-secondary-text">
          <Layers size={16} strokeWidth={2} aria-hidden />
        </span>

        {editing ? (
          <input
            autoFocus
            aria-label={`Rename ${pipeline.name}`}
            maxLength={120}
            value={draft}
            disabled={saving}
            onChange={(event) => {
              setDraft(event.target.value)
              setProblem(null)
            }}
            onFocus={(event) => event.currentTarget.select()}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                void save()
              } else if (event.key === 'Escape') {
                // Cancel the rename; preventDefault keeps the drawer open.
                event.preventDefault()
                event.stopPropagation()
                onCancelEdit()
              }
            }}
            // Leaving the field saves a changed name; an unchanged one just closes.
            onBlur={() => {
              if (draft.trim() === pipeline.name) onCancelEdit()
              else void save()
            }}
            aria-invalid={!!problem}
            aria-describedby={problem ? errorId : undefined}
            className="field-input h-9 min-w-0 flex-1"
          />
        ) : (
          <span className="min-w-0 flex-1">
            <span className="block truncate text-body font-medium text-ink" title={pipeline.name}>
              {pipeline.name}
            </span>
            <span className="block text-caption text-ink-3 tabular-nums">
              {stageCount} {stageCount === 1 ? 'stage' : 'stages'}
            </span>
          </span>
        )}

        {editing ? (
          <Button
            variant="primary"
            // Keep focus in the field: a blur would start its own save first.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => void save()}
            loading={saving}
            aria-label={saving ? 'Saving' : `Save name for ${pipeline.name}`}
            title="Save"
            className="w-9 shrink-0 px-0!"
          >
            {!saving && <Check size={16} strokeWidth={2.4} aria-hidden />}
          </Button>
        ) : (
          <>
            <RowButton ref={editButtonRef} label={`Rename ${pipeline.name}`} onClick={onStartEdit} disabled={locked}>
              <Pencil size={15} strokeWidth={2} aria-hidden />
            </RowButton>
            <RowButton
              label={deleteBlocked ? 'The last pipeline can’t be deleted' : `Delete ${pipeline.name}`}
              onClick={onDelete}
              disabled={locked || deleteBlocked}
              danger
            >
              <Trash2 size={15} strokeWidth={2} aria-hidden />
            </RowButton>
          </>
        )}
      </div>
      {editing && problem && (
        <p id={errorId} className="mt-1 pl-11 text-caption text-danger">
          {problem}
        </p>
      )}
    </li>
  )
}

const RowButton = forwardRef<
  HTMLButtonElement,
  { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: ReactNode }
>(function RowButton({ label, onClick, disabled = false, danger = false, children }, ref) {
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
