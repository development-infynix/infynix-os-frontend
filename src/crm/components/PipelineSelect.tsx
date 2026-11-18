import { Check, ChevronDown } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import type { CrmPipeline } from '../types'

interface PipelineSelectProps {
  pipelines: CrmPipeline[]
  value: string
  onChange: (id: string) => void
}

/** Picks the pipeline both tabs work on. */
export function PipelineSelect({ pipelines, value, onChange }: PipelineSelectProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const listId = useId()
  const current = pipelines.find((pipeline) => pipeline.id === value)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((next) => !next)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={`Pipeline: ${current?.name ?? 'none'}`}
        className="field-input flex h-9 w-40 items-center justify-between gap-2 text-left sm:w-56"
      >
        <span className="min-w-0 truncate font-medium text-ink">{current?.name ?? 'Choose a pipeline'}</span>
        <ChevronDown
          size={16}
          strokeWidth={2}
          aria-hidden
          className={`shrink-0 text-ink-3 transition-transform duration-press ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Pipelines"
          className="absolute right-0 z-30 mt-1 max-h-72 w-full min-w-48 overflow-y-auto rounded-lg bg-surface py-1 shadow-dialog"
        >
          {pipelines.map((pipeline) => {
            const selected = pipeline.id === value
            return (
              <li key={pipeline.id} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onChange(pipeline.id)
                    setOpen(false)
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-body ${
                    selected
                      ? 'bg-secondary-soft font-medium text-secondary-text'
                      : 'text-ink-2 hover:bg-surface-hover hover:text-ink'
                  }`}
                >
                  <span className="min-w-0 flex-1 truncate">{pipeline.name}</span>
                  <span className="shrink-0 text-caption text-ink-3 tabular-nums">
                    {pipeline.stages.length} stages
                  </span>
                  {selected && <Check size={14} strokeWidth={2} aria-hidden className="shrink-0" />}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
