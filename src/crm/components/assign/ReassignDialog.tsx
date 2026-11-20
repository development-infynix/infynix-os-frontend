import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Button } from '@/components/Button'
import { FormError } from '@/components/FormField'
import { Modal, ModalFooter } from '@/components/Modal'
import { ApiError } from '@/lib/api'
import {
  CRM_KEY,
  runInChunks,
  transferCrmDeals,
  unassignCrmDeals,
  type AssignmentPerson,
} from '@/lib/crm'
import type { AssignmentRule } from '../../types'
import { RULE_LABEL } from './rules'

const number = new Intl.NumberFormat()

/**
 * One person's deals: unassign them, or transfer them to someone else on the
 * pipeline. Scope is this card's method or all their deals. Transfer only
 * changes the owner (each deal keeps how it was assigned; the rule is untouched).
 */
export function ReassignDialog({
  pipelineId,
  person,
  method,
  people,
  onClose,
  onBusyChange,
}: {
  pipelineId: string
  /** Whose deals; null closes the dialog. */
  person: AssignmentPerson | null
  /** The card it was opened from: its method is the narrower scope. */
  method: AssignmentRule
  /** Everyone on the list: transfer targets are the eligible ones other than `person`. */
  people: AssignmentPerson[]
  onClose: () => void
  onBusyChange: (busy: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [scope, setScope] = useState<'method' | 'all'>('method')
  const [target, setTarget] = useState('')
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [wasPerson, setWasPerson] = useState(person)
  if (person !== wasPerson) {
    setWasPerson(person)
    setScope((person?.bySource[method] ?? 0) > 0 ? 'method' : 'all')
    setTarget('')
    setProgress(null)
    setError(null)
  }

  const busy = progress !== null && progress.done < progress.total
  const methodCount = person?.bySource[method] ?? 0
  const allCount = person?.dealCount ?? 0
  const count = scope === 'method' ? methodCount : allCount
  const targets = people.filter((p) => p.eligible && p.userId !== person?.userId)
  const targetName = targets.find((p) => p.userId === target)?.fullName

  async function run(kind: 'unassign' | 'transfer') {
    if (!person) return
    setError(null)
    setProgress({ done: 0, total: count })
    onBusyChange(true)
    const source = scope === 'method' ? method : undefined
    try {
      await runInChunks(
        async () => {
          if (kind === 'unassign') {
            const r = await unassignCrmDeals(pipelineId, { userId: person.userId, source })
            return { done: r.unassigned, remaining: r.remaining }
          }
          const r = await transferCrmDeals(pipelineId, { fromUserId: person.userId, toUserId: target, source })
          return { done: r.transferred, remaining: r.remaining }
        },
        (done, total) => setProgress({ done, total }),
      )
      await queryClient.invalidateQueries({ queryKey: CRM_KEY })
      onBusyChange(false)
      onClose()
    } catch (caught) {
      setError(caught instanceof ApiError && caught.status !== 500 ? caught.message : 'Couldn’t finish. Try again.')
      setProgress(null)
      onBusyChange(false)
      await queryClient.invalidateQueries({ queryKey: CRM_KEY })
    }
  }

  return (
    <Modal
      open={person !== null}
      onOpenChange={(open) => !open && !busy && onClose()}
      busy={busy}
      title={person ? `${person.fullName}’s deals` : 'Deals'}
      description="Unassign them, or transfer them to someone else on this pipeline."
    >
      <div className="flex flex-col gap-4 px-5 pt-4">
        <fieldset className="flex flex-col gap-2" disabled={busy}>
          <legend className="mb-1 text-label font-medium text-ink-2">Which deals</legend>
          <ScopeOption
            checked={scope === 'method'}
            disabled={methodCount === 0}
            onChange={() => setScope('method')}
            label={`${RULE_LABEL[method]} deals`}
            count={methodCount}
          />
          <ScopeOption
            checked={scope === 'all'}
            disabled={allCount === 0 || allCount === methodCount}
            onChange={() => setScope('all')}
            label="All their deals"
            count={allCount}
          />
        </fieldset>
        <label className="flex flex-col gap-1.5">
          <span className="text-label font-medium text-ink-2">Transfer to</span>
          <select
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            disabled={busy || targets.length === 0}
            className="field-input h-10"
          >
            <option value="">{targets.length ? 'Choose a person' : 'Nobody else can own deals here'}</option>
            {targets.map((p) => (
              <option key={p.userId} value={p.userId}>
                {p.fullName}
              </option>
            ))}
          </select>
        </label>
        {progress && (
          <div>
            <div className="flex justify-between text-caption text-ink-3 tabular-nums">
              <span>Working…</span>
              <span>
                {number.format(progress.done)} / {number.format(progress.total)}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-hover">
              <div
                className="h-full rounded-full bg-secondary transition-[width] duration-200"
                style={{ width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%` }}
              />
            </div>
          </div>
        )}
        <FormError message={error} />
      </div>
      <ModalFooter>
        <Button variant="secondary" onClick={() => void run('unassign')} disabled={busy || count === 0}>
          Unassign {number.format(count)}
        </Button>
        <Button variant="primary" onClick={() => void run('transfer')} disabled={busy || count === 0 || !target} loading={busy}>
          {targetName ? `Transfer to ${targetName}` : 'Transfer'}
        </Button>
      </ModalFooter>
    </Modal>
  )
}

function ScopeOption({
  checked,
  disabled,
  onChange,
  label,
  count,
}: {
  checked: boolean
  disabled: boolean
  onChange: () => void
  label: string
  count: number
}) {
  return (
    <label
      className={`flex items-center gap-2.5 rounded-lg px-3 py-2 ring-1 ring-line ${
        disabled ? 'opacity-50' : 'cursor-pointer hover:bg-surface-hover/60'
      } ${checked ? 'bg-secondary-soft/60' : 'bg-surface'}`}
    >
      <input type="radio" checked={checked} disabled={disabled} onChange={onChange} className="accent-[var(--secondary)]" />
      <span className="min-w-0 flex-1 text-body text-ink">{label}</span>
      <span className="text-label text-ink-3 tabular-nums">{number.format(count)}</span>
    </label>
  )
}
