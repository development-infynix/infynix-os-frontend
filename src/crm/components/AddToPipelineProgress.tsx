import { FormError } from '@/components/FormField'
import type { AddToPipelineRun } from '../useAddToPipeline'

const number = new Intl.NumberFormat()

/** The running, finished or failed view of an add-to-pipeline run: a progress bar and what happened. */
export function AddToPipelineProgress({ run, where }: { run: AddToPipelineRun; where: string }) {
  const { phase, tally, total, percent, error } = run
  if (phase === 'idle') return null
  const label = phase === 'running' ? 'Adding clients…' : phase === 'done' ? 'All done' : 'Stopped'
  return (
    <div className="pb-1">
      <div className="flex items-center justify-between text-label text-ink-2">
        <span>{label}</span>
        <span className="tabular-nums">
          {number.format(tally.sent)} / {number.format(total)}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label="Progress adding clients to the pipeline"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        className="mt-2 h-2 overflow-hidden rounded-full bg-surface-hover"
      >
        <div
          className={`h-full rounded-full transition-[width] duration-200 ${phase === 'failed' ? 'bg-danger' : 'bg-secondary'}`}
          style={{ width: `${percent}%` }}
        />
      </div>

      {phase !== 'running' && (
        <dl className="mt-4 flex flex-col gap-1.5 text-label">
          <Row label={`Added to ${where}`} value={tally.added} strong />
          {tally.alreadyInPipeline > 0 && <Row label="Already in this pipeline (skipped)" value={tally.alreadyInPipeline} />}
          {tally.notFound > 0 && <Row label="No longer in your directory (skipped)" value={tally.notFound} />}
          {phase === 'failed' && <Row label="Not sent yet" value={total - tally.sent} />}
        </dl>
      )}
      {error && (
        <div className="mt-3">
          <FormError message={error} />
        </div>
      )}
    </div>
  )
}

function Row({ label, value, strong = false }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="min-w-0 text-ink-2">{label}</dt>
      <dd className={`shrink-0 tabular-nums ${strong ? 'font-semibold text-ink' : 'text-ink-2'}`}>{number.format(value)}</dd>
    </div>
  )
}
