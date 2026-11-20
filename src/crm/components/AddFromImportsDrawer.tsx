import { X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { Button } from '@/components/Button'
import { ImportsList } from '@/clients/components/ImportsList'
import type { CrmPipeline } from '../types'
import { useAddToPipeline } from '../useAddToPipeline'
import { AddToPipelineProgress } from './AddToPipelineProgress'
import { StagePicker } from './StagePicker'

const number = new Intl.NumberFormat()

interface AddFromImportsDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The pipeline open on the board: the deals land here. */
  pipeline: CrmPipeline
}

/**
 * Add deal › Existing import, as a right-side sheet: tick whole imports (the
 * same list as Select › Select imports on the Clients page), then pick the
 * stage, and every client from those imports becomes a deal here. Clients already in the
 * pipeline are skipped; a failed chunk can be retried without doubling anything.
 */
export function AddFromImportsDrawer({ open, onOpenChange, pipeline }: AddFromImportsDrawerProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  const [stageId, setStageId] = useState<string | null>(pipeline.stages[0]?.id ?? null)
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  /** Bumped on every opening, so the imports list fetches fresh from the server. */
  const [session, setSession] = useState(0)
  const run = useAddToPipeline()

  // Start over each time the drawer opens.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setStageId(pipeline.stages[0]?.id ?? null)
      setSelected(new Set())
      setSession((current) => current + 1)
      run.reset()
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

  const stage = pipeline.stages.find((item) => item.id === stageId) ?? pipeline.stages[0] ?? null
  const choosing = run.phase === 'idle'
  const busy = run.phase === 'running'
  const where = stage ? `${pipeline.name} › ${stage.name}` : pipeline.name
  const count = choosing ? selected.size : run.total

  function close() {
    if (busy) return
    onOpenChange(false)
  }

  function add(ids: string[]) {
    setSelected((current) => new Set([...current, ...ids]))
  }

  function remove(ids: string[]) {
    setSelected((current) => {
      const next = new Set(current)
      for (const id of ids) next.delete(id)
      return next
    })
  }

  return (
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
              Add deals from an import
            </h2>
            <p id={descriptionId} className="mt-0.5 text-label text-ink-3">
              {choosing
                ? `Every client in the imports you tick becomes a deal in ${pipeline.name}.`
                : `Adding ${number.format(count)} ${count === 1 ? 'client' : 'clients'} to ${where}.`}
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

        <div className="flex flex-1 flex-col overflow-y-auto bg-canvas px-5 py-5">
          {choosing ? (
            <div className="flex flex-col gap-6">
              <div>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-label font-medium text-ink-2">Imports</p>
                  <p className="text-caption text-ink-3 tabular-nums" aria-live="polite">
                    {selected.size
                      ? `${number.format(selected.size)} ${selected.size === 1 ? 'client' : 'clients'} selected`
                      : 'Tick the imports to add'}
                  </p>
                </div>
                <div className="-mx-2 mt-1.5">
                  <ImportsList active={open} session={session} selected={selected} onAdd={add} onRemove={remove} />
                </div>
              </div>
              <StagePicker stages={pipeline.stages} value={stage?.id ?? null} onChange={setStageId} />
            </div>
          ) : (
            <AddToPipelineProgress run={run} where={where} onDone={close} />
          )}
        </div>

        {run.phase !== 'done' && (
        <div className="flex justify-end gap-2 border-t border-line bg-canvas/60 px-5 py-3.5">
          {choosing ? (
            <>
              <Button variant="secondary" onClick={close}>
                Cancel
              </Button>
              <Button
                variant="primary"
                disabled={!stage || selected.size === 0}
                onClick={() => stage && run.start([...selected], { pipelineId: pipeline.id, stageId: stage.id })}
              >
                {selected.size ? `Add ${number.format(selected.size)} to pipeline` : 'Add to pipeline'}
              </Button>
            </>
          ) : run.phase === 'failed' ? (
            <>
              <Button variant="secondary" onClick={close}>
                Close
              </Button>
              <Button variant="primary" onClick={run.retry}>
                Try again
              </Button>
            </>
          ) : (
            <Button variant="primary" onClick={close} loading={busy}>
              {busy ? 'Adding…' : 'Done'}
            </Button>
          )}
        </div>
        )}
      </div>
    </dialog>
  )
}
