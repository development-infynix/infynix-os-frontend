import { useQueryClient } from '@tanstack/react-query'
import { Check, Loader2, X } from 'lucide-react'
import { VscSettingsCompact } from 'react-icons/vsc'
import { useEffect, useRef, useState } from 'react'
import { AlertDialog } from '@/components/Alert'
import { Button } from '@/components/Button'
import { FormError } from '@/components/FormField'
import { ApiError } from '@/lib/api'
import {
  CLIENTS_KEY,
  CLIENT_IMPORTS_KEY,
  clientImportIdsQuery,
  deleteClientImport,
  deleteImportClientChunk,
  IMPORT_DELETE_CHUNK,
  renameClientImport,
  type ClientImport,
} from '@/lib/clients'

const dateFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
/** "16 Nov 2026" in the viewer's locale. */
const importedOn = (iso: string) => dateFormat.format(new Date(iso))

const failure = (error: unknown, fallback: string) =>
  error instanceof ApiError && error.status !== 500 ? error.message : fallback

/** One import batch: summary counts and a menu to rename, delete or move it. */
export function ClientImportCard({
  item,
  onViewRows,
  onMoveToCrm,
}: {
  item: ClientImport
  onViewRows: (item: ClientImport) => void
  /** Opens Add to a pipeline with this import's clients; absent without CRM access. */
  onMoveToCrm?: (item: ClientImport, clientIds: string[]) => void
}) {
  const queryClient = useQueryClient()
  /** Loading the import's client ids before the pipeline modal opens. */
  const [movePending, setMovePending] = useState(false)
  const [moveFailed, setMoveFailed] = useState(false)

  async function moveToCrm() {
    if (!onMoveToCrm || movePending) return
    setMovePending(true)
    setMoveFailed(false)
    try {
      // Fresh every time: clients may have been deleted from the import since.
      const ids = await queryClient.fetchQuery({ ...clientImportIdsQuery(item.id), staleTime: 0 })
      setMenuOpen(false)
      onMoveToCrm(item, ids)
    } catch {
      setMoveFailed(true)
    } finally {
      setMovePending(false)
    }
  }
  const [menuOpen, setMenuOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(item.name)
  const [nameError, setNameError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteProgress, setDeleteProgress] = useState<{ current: number; total: number } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const onPointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  function startRename() {
    setName(item.name)
    setNameError(null)
    setRenaming(true)
  }

  async function saveRename() {
    if (!name.trim()) {
      setNameError('Enter an import name')
      return
    }
    setSaving(true)
    setNameError(null)
    try {
      await renameClientImport(item.id, name.trim())
      await queryClient.invalidateQueries({ queryKey: CLIENT_IMPORTS_KEY })
      setRenaming(false)
    } catch (error) {
      setNameError(failure(error, 'Couldn’t rename the import. Try again.'))
    } finally {
      setSaving(false)
    }
  }

  // Big imports clear their clients in chunks first, so the progress bar can move.
  const chunkedDelete = item.createdCount > IMPORT_DELETE_CHUNK
  const deletePercent = deleteProgress?.total
    ? Math.round((deleteProgress.current / deleteProgress.total) * 100)
    : 0

  return (
    <>
      <li className="card-3d relative overflow-hidden rounded-xl">
        <div className={`border-b border-line bg-canvas/60 px-4 py-3 ${renaming ? '' : 'pr-12'}`}>
          {renaming ? (
            <form
              onSubmit={(event) => {
                event.preventDefault()
                void saveRename()
              }}
              className="flex flex-col gap-2"
            >
              <FormError message={nameError} />
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  aria-label="Import name"
                  className="field-input h-9 min-w-0 flex-1"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
                <button
                  type="submit"
                  aria-label="Save import name"
                  title="Save"
                  disabled={saving}
                  className="btn btn-primary grid size-9 shrink-0 place-items-center p-0 disabled:opacity-50"
                >
                  <Check size={16} strokeWidth={2.2} aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label="Cancel rename"
                  title="Cancel"
                  onClick={() => setRenaming(false)}
                  disabled={saving}
                  className="btn btn-secondary grid size-9 shrink-0 place-items-center p-0"
                >
                  <X size={16} strokeWidth={2} aria-hidden />
                </button>
              </div>
            </form>
          ) : (
            <>
              <p className="truncate text-title font-semibold text-ink">{item.name}</p>
              <p className="mt-0.5 truncate text-caption text-ink-3" title={item.fileName}>
                {item.fileName}
              </p>
            </>
          )}
        </div>
        <div className="px-4 py-3.5">
          <dl className="grid grid-cols-3 gap-2">
            <div>
              <dt className="text-caption text-ink-3">Rows</dt>
              <dd className="text-body font-medium text-ink tabular-nums">{item.rowCount}</dd>
            </div>
            <div>
              <dt className="text-caption text-ink-3">Added</dt>
              <dd className="text-body font-medium text-ink tabular-nums">{item.createdCount}</dd>
            </div>
            <div>
              <dt className="text-caption text-ink-3">Skipped</dt>
              <dd className="text-body font-medium text-ink tabular-nums">{item.skippedCount}</dd>
            </div>
          </dl>
          <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3">
            <span className="text-caption text-ink-3 tabular-nums">{importedOn(item.createdAt)}</span>
            <Button size="sm" variant="secondary" onClick={() => onViewRows(item)}>
              View rows
            </Button>
          </div>
        </div>

        {!renaming && (
          <div ref={menuRef} className="absolute top-2.5 right-2.5">
          <button
            type="button"
            onClick={() => setMenuOpen((current) => !current)}
            aria-label={`Settings for ${item.name}`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="grid size-8 place-items-center rounded-md text-ink-3 hover:bg-surface-hover hover:text-ink"
          >
            <VscSettingsCompact size={17} />
          </button>
          {menuOpen && (
            <div
              role="menu"
              aria-label={`${item.name} actions`}
              className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-lg bg-surface py-1 shadow-dialog"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false)
                  startRename()
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-body hover:bg-surface-hover text-ink"
              >
                Rename
              </button>
              {onMoveToCrm && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => void moveToCrm()}
                  disabled={movePending || item.createdCount === 0}
                  title={item.createdCount === 0 ? 'This import has no clients left' : undefined}
                  aria-busy={movePending || undefined}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-body hover:bg-surface-hover text-ink disabled:cursor-not-allowed disabled:text-ink-3 disabled:hover:bg-transparent"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block">Move to CRM</span>
                    {moveFailed && (
                      <span className="block text-caption text-danger">Couldn’t load its clients. Try again.</span>
                    )}
                  </span>
                  {movePending && <Loader2 size={15} className="shrink-0 animate-spin text-ink-3" aria-hidden />}
                </button>
              )}
              <div role="separator" className="my-1 border-t border-line" />
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false)
                  setConfirmDelete(true)
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-body hover:bg-surface-hover text-danger"
              >
                Delete
              </button>
            </div>
          )}
          </div>
        )}
      </li>

      <AlertDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        tone="danger"
        icon={null}
        width="compact"
        title={`Delete ${item.name}?`}
        description={`This removes the import and its ${item.createdCount} clients, along with their deals in every CRM pipeline. This can’t be undone.`}
        confirmLabel="Delete"
        pendingLabel="Deleting…"
        footer={
          chunkedDelete && deleteProgress ? (
            <div className="border-t border-line bg-canvas/60 px-5 py-3.5">
              <div className="mb-2 flex items-center justify-between text-caption text-ink-3">
                <span>Deleting clients…</span>
                <span className="tabular-nums">
                  {deleteProgress.current} / {deleteProgress.total}
                </span>
              </div>
              <div
                role="progressbar"
                aria-label="Delete progress"
                aria-valuenow={deletePercent}
                aria-valuemin={0}
                aria-valuemax={100}
                className="h-2 overflow-hidden rounded-full bg-surface-hover"
              >
                <div
                  className="h-full rounded-full bg-danger transition-[width] duration-200"
                  style={{ width: `${deletePercent}%` }}
                />
              </div>
            </div>
          ) : undefined
        }
        onConfirm={async () => {
          try {
            if (chunkedDelete) {
              let total = item.createdCount
              setDeleteProgress({ current: 0, total })
              while (true) {
                const batch = await deleteImportClientChunk(item.id)
                total = batch.deleted + batch.remaining
                setDeleteProgress({ current: total - batch.remaining, total })
                if (batch.remaining === 0) break
              }
            }
            await deleteClientImport(item.id)
            await Promise.all([
              queryClient.invalidateQueries({ queryKey: CLIENT_IMPORTS_KEY }),
              queryClient.invalidateQueries({ queryKey: CLIENTS_KEY }),
            ])
            setConfirmDelete(false)
          } finally {
            setDeleteProgress(null)
          }
        }}
      />
    </>
  )
}
