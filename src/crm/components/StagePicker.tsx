import { Check } from 'lucide-react'
import { useId } from 'react'
import type { CrmStage } from '../types'

/** "Land in stage": a numbered radio list of a pipeline's stages. */
export function StagePicker({
  stages,
  value,
  onChange,
  label = 'Land in stage',
}: {
  stages: CrmStage[]
  value: string | null
  onChange: (stageId: string) => void
  label?: string
}) {
  const labelId = useId()
  return (
    <div>
      <p id={labelId} className="text-label font-medium text-ink-2">
        {label}
      </p>
      <ol role="radiogroup" aria-labelledby={labelId} className="mt-2.5 overflow-hidden rounded-lg bg-surface ring-1 ring-line">
        {stages.map((stage, index) => {
          const active = stage.id === value
          return (
            <li key={stage.id} role="presentation" className="border-b border-line last:border-b-0">
              <button
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onChange(stage.id)}
                className={`flex w-full items-center gap-3 px-3.5 py-2.5 text-left text-body transition-colors duration-press ${
                  active ? 'bg-secondary-soft/60 text-ink' : 'text-ink-2 hover:bg-surface-hover/60 hover:text-ink'
                }`}
              >
                <span className="w-5 shrink-0 text-right text-label text-ink-3 tabular-nums">{index + 1}</span>
                <span className={`min-w-0 flex-1 truncate ${active ? 'font-medium' : ''}`} title={stage.name}>
                  {stage.name}
                </span>
                <RadioDot checked={active} small />
              </button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

/** The round selection mark used for pipelines and stages. */
export function RadioDot({ checked, small = false }: { checked: boolean; small?: boolean }) {
  return (
    <span
      aria-hidden
      className={`grid ${small ? 'size-4' : 'size-5'} shrink-0 place-items-center rounded-full border transition-colors duration-press ${
        checked ? 'border-secondary bg-secondary text-on-secondary' : 'border-line-strong bg-surface text-transparent'
      }`}
    >
      <Check size={small ? 10 : 12} strokeWidth={3} />
    </span>
  )
}
