import { FileText, Upload, X } from 'lucide-react'
import { useId, useState, type DragEvent } from 'react'
import { MAX_REPORT_FILE_BYTES, REPORT_FILE_ACCEPT } from '../api'
import { formatBytes } from '../lib/format'

export interface SlotFile {
  name: string
  size: number
}

interface ReportFileSlotProps {
  /** The attached file (uploaded now, or the report's current one). */
  file: SlotFile | null
  /** 0–1 while uploading; null otherwise. */
  progress: number | null
  error: string | null
  disabled?: boolean
  onPick: (file: File) => void
  onRemove: () => void
}

/**
 * The Upload tab: a drop zone (click or drag a file in) until a file is
 * attached, then the file as one row with its size and a remove button, and a
 * progress bar while it uploads.
 */
export function ReportFileSlot({ file, progress, error, disabled = false, onPick, onRemove }: ReportFileSlotProps) {
  const inputId = useId()
  const [dragging, setDragging] = useState(false)

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    setDragging(false)
    const dropped = event.dataTransfer.files[0]
    if (dropped && !disabled) onPick(dropped)
  }

  return (
    <div className="mt-3">
      {file ? (
        <div className="rounded-lg bg-canvas/60 px-3 py-2.5 shadow-[inset_0_0_0_1px_var(--line-strong)]">
          <div className="flex items-center gap-2.5">
            <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-md bg-surface text-ink-3 shadow-lift">
              <FileText size={16} strokeWidth={1.9} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-label font-medium text-ink" title={file.name}>
                {file.name}
              </p>
              <p className="text-caption text-ink-3 tabular-nums">
                {progress !== null ? `Uploading… ${Math.round(progress * 100)}%` : formatBytes(file.size)}
              </p>
            </div>
            <button
              type="button"
              onClick={onRemove}
              disabled={disabled}
              aria-label={progress !== null ? `Cancel uploading ${file.name}` : `Remove ${file.name}`}
              title={progress !== null ? 'Cancel upload' : 'Remove file'}
              className="grid size-8 shrink-0 place-items-center rounded-md text-ink-3 hover:bg-surface-hover hover:text-danger disabled:opacity-50"
            >
              <X size={16} strokeWidth={2} aria-hidden />
            </button>
          </div>
          {progress !== null && (
            <div
              role="progressbar"
              aria-label={`Uploading ${file.name}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress * 100)}
              className="mt-2 h-1 overflow-hidden rounded-full bg-line"
            >
              <div className="h-full rounded-full bg-primary transition-[width] duration-150" style={{ width: `${progress * 100}%` }} />
            </div>
          )}
        </div>
      ) : (
        <label
          htmlFor={inputId}
          onDragOver={(event) => {
            event.preventDefault()
            if (!disabled) setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed px-4 py-5 text-center transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--focus)] ${
            dragging ? 'border-secondary-text bg-secondary-soft' : 'border-line-strong bg-canvas/50 hover:bg-surface-hover'
          } ${disabled ? 'pointer-events-none opacity-60' : ''}`}
        >
          <span aria-hidden className="grid size-9 place-items-center rounded-lg bg-surface text-ink-3 shadow-lift">
            <Upload size={17} strokeWidth={1.9} />
          </span>
          <span className="text-label font-medium text-ink-2">
            {dragging ? 'Drop to upload' : 'Click to choose a file, or drag it here'}
          </span>
          <span className="text-caption text-ink-3">
            PDF, images, Word, Excel, PowerPoint, CSV or text · up to {formatBytes(MAX_REPORT_FILE_BYTES)}
          </span>
          <input
            id={inputId}
            type="file"
            accept={REPORT_FILE_ACCEPT}
            disabled={disabled}
            onChange={(event) => {
              const picked = event.target.files?.[0]
              event.target.value = ''
              if (picked) onPick(picked)
            }}
            className="sr-only"
          />
        </label>
      )}
      {error && (
        <p role="alert" className="mt-1.5 text-caption text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
