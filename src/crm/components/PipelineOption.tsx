import { Layers } from 'lucide-react'
import type { CrmPipeline } from '../types'
import { RadioDot, StagePicker } from './StagePicker'

/** A pipeline to pick; once picked, its stages fold out as a list to choose where the deals land. */
export function PipelineOption({
  pipeline,
  selected,
  stageId,
  onSelect,
  onSelectStage,
}: {
  pipeline: CrmPipeline
  selected: boolean
  stageId: string | null
  onSelect: () => void
  onSelectStage: (id: string) => void
}) {
  const stageCount = pipeline.stages.length
  return (
    <div
      className={`overflow-hidden rounded-xl transition-shadow duration-press ${
        selected ? 'bg-surface shadow-lift ring-2 ring-secondary' : 'bg-surface ring-1 ring-line'
      }`}
    >
      <button
        type="button"
        role="radio"
        aria-checked={selected}
        onClick={onSelect}
        disabled={stageCount === 0}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors duration-press hover:bg-surface-hover/50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary-soft text-secondary-text">
          <Layers size={17} strokeWidth={2} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-body font-semibold text-ink">{pipeline.name}</span>
          <span className="mt-0.5 block text-caption text-ink-3 tabular-nums">
            {stageCount === 0 ? 'No stages' : `${stageCount} ${stageCount === 1 ? 'stage' : 'stages'}`}
          </span>
        </span>
        <RadioDot checked={selected} />
      </button>

      {/* Stages fold out under the chosen pipeline (grid rows 0fr → 1fr). */}
      <div
        className={`grid transition-[grid-template-rows] duration-enter ease-out-expo ${
          selected ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
        inert={!selected}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="border-t border-line bg-canvas/50 px-4 pt-3 pb-4">
            <StagePicker stages={pipeline.stages} value={stageId} onChange={onSelectStage} />
          </div>
        </div>
      </div>
    </div>
  )
}
