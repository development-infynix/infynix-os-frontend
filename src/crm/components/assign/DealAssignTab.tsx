import { useQuery, useQueryClient } from '@tanstack/react-query'
import { MoreHorizontal } from 'lucide-react'
import { useState } from 'react'
import { AlertDialog } from '@/components/Alert'
import { Button } from '@/components/Button'
import { FormError } from '@/components/FormField'
import { Loader } from '@/components/Loader'
import { ApiError } from '@/lib/api'
import {
  CRM_KEY,
  crmAssignmentQuery,
  distributeCrmDeals,
  runInChunks,
  setCrmAssignmentRule,
  unassignCrmDeals,
  type AssignmentOverview,
  type AssignmentPerson,
} from '@/lib/crm'
import type { AssignmentRule } from '../../types'
import { RadioDot } from '../StagePicker'
import { ReassignDialog } from './ReassignDialog'
import { RULE_LABEL, RULES } from './rules'

const number = new Intl.NumberFormat()

/** A running bulk tool, shown in the card it was started from. */
interface ToolRun {
  card: AssignmentRule
  label: string
  done: number
  total: number
}

/**
 * Deal assign: the pipeline's rule for new deals (a radio on each card) and
 * the bulk tools for existing deals, which never change the rule.
 */
export function DealAssignTab({
  pipelineId,
  canManage,
  onBusyChange,
}: {
  pipelineId: string
  canManage: boolean
  onBusyChange: (busy: boolean) => void
}) {
  const queryClient = useQueryClient()
  const overview = useQuery(crmAssignmentQuery(pipelineId))
  const [pendingRule, setPendingRule] = useState<AssignmentRule | null>(null)
  const [singlePick, setSinglePick] = useState('')
  const [run, setRun] = useState<ToolRun | null>(null)
  const [toolError, setToolError] = useState<{ card: AssignmentRule; message: string } | null>(null)
  const [reassign, setReassign] = useState<{ person: AssignmentPerson; method: AssignmentRule } | null>(null)
  const [confirmRevert, setConfirmRevert] = useState(false)

  if (overview.isPending) {
    return (
      <div className="grid place-items-center py-12">
        <Loader label="Loading assignment" />
      </div>
    )
  }
  if (overview.isError) {
    return (
      <div className="py-10 text-center">
        <p className="text-label text-ink-2">Couldn’t load who owns these deals.</p>
        <Button size="sm" variant="secondary" className="mt-3" onClick={() => void overview.refetch()}>
          Try again
        </Button>
      </div>
    )
  }

  const data: AssignmentOverview = overview.data
  const unassigned = data.total - data.assigned
  const eligible = data.people.filter((p) => p.eligible)
  const singleTarget = singlePick || data.singleUserId || ''
  const singleName = eligible.find((p) => p.userId === singleTarget)?.fullName
  const busy = run !== null

  const refresh = () => queryClient.invalidateQueries({ queryKey: CRM_KEY })

  async function runTool(card: AssignmentRule, label: string, total: number, step: () => Promise<{ done: number; remaining: number }>) {
    setToolError(null)
    setRun({ card, label, done: 0, total })
    onBusyChange(true)
    try {
      const done = await runInChunks(step, (d, t) => setRun({ card, label, done: d, total: t }))
      if (done === 0 && total > 0) setToolError({ card, message: 'Nobody here can receive deals right now.' })
    } catch (caught) {
      setToolError({
        card,
        message: caught instanceof ApiError && caught.status !== 500 ? caught.message : 'Couldn’t finish. Try again.',
      })
    } finally {
      setRun(null)
      onBusyChange(false)
      await refresh()
    }
  }

  const share = () =>
    runTool('round_robin', 'Sharing deals', unassigned, async () => {
      const r = await distributeCrmDeals(pipelineId, 'round_robin')
      return { done: r.assigned, remaining: r.remaining }
    })

  const give = () =>
    runTool('single_user', `Giving deals to ${singleName ?? 'them'}`, unassigned, async () => {
      const r = await distributeCrmDeals(pipelineId, 'single_user', singleTarget)
      return { done: r.assigned, remaining: r.remaining }
    })

  const revert = () =>
    runTool('round_robin', 'Unassigning round-robin deals', data.bySource.round_robin ?? 0, async () => {
      const r = await unassignCrmDeals(pipelineId, { source: 'round_robin' })
      return { done: r.unassigned, remaining: r.remaining }
    })

  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-3 gap-2">
        <Tile label="Total" value={data.total} />
        <Tile label="Assigned" value={data.assigned} />
        <Tile label="Unassigned" value={unassigned} />
      </dl>

      {RULES.map(({ key, description }) => {
        const active = data.rule === key
        const cardRun = run?.card === key ? run : null
        const cardError = toolError?.card === key ? toolError.message : null
        return (
          <section
            key={key}
            aria-label={RULE_LABEL[key]}
            className={`card-3d rounded-xl p-4 ${active ? 'outline-2 outline-secondary' : ''}`}
          >
            <div className="flex items-start gap-3">
              <button
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={`Use ${RULE_LABEL[key]} for new deals`}
                title={active ? 'New deals are assigned by this rule' : 'Use for new deals'}
                disabled={!canManage || busy || active || (key === 'single_user' && !singleTarget)}
                onClick={() => setPendingRule(key)}
                className="mt-0.5 disabled:cursor-not-allowed"
              >
                <RadioDot checked={active} />
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-body font-semibold text-ink">{RULE_LABEL[key]}</h3>
                  {active && (
                    <span className="rounded-md bg-secondary-soft px-1.5 py-0.5 text-micro font-semibold text-secondary-text">
                      New deals{key === 'single_user' && singleName ? ` · ${singleName}` : ''}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-label text-ink-2">{description}</p>
              </div>
            </div>

            {key === 'round_robin' && (
              <div className="mt-4 flex flex-col gap-3">
                <PeopleCounts
                  people={data.people}
                  count={(p) => p.bySource.round_robin ?? 0}
                  canManage={canManage && !busy}
                  onManage={(person) => setReassign({ person, method: 'round_robin' })}
                />
                {canManage && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="primary" disabled={busy || unassigned === 0 || eligible.length === 0} onClick={() => void share()}>
                      Share {number.format(unassigned)} unassigned
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busy || !(data.bySource.round_robin ?? 0)}
                      onClick={() => setConfirmRevert(true)}
                    >
                      Revert round robin
                    </Button>
                  </div>
                )}
              </div>
            )}

            {key === 'single_user' && (
              <div className="mt-4 flex flex-col gap-3">
                {canManage && (
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      aria-label="Person"
                      value={singleTarget}
                      disabled={busy}
                      onChange={(event) => setSinglePick(event.target.value)}
                      className="field-input h-9 w-auto min-w-44 py-0"
                    >
                      <option value="">Choose a person</option>
                      {eligible.map((p) => (
                        <option key={p.userId} value={p.userId}>
                          {p.fullName}
                        </option>
                      ))}
                    </select>
                    <Button size="sm" variant="primary" disabled={busy || !singleTarget || unassigned === 0} onClick={() => void give()}>
                      Give {number.format(unassigned)} to {singleName ?? '…'}
                    </Button>
                  </div>
                )}
                <PeopleCounts
                  people={data.people}
                  count={(p) => p.dealCount}
                  canManage={canManage && !busy}
                  onManage={(person) => setReassign({ person, method: 'single_user' })}
                />
              </div>
            )}

            {cardRun && (
              <div className="mt-3">
                <div className="flex justify-between text-caption text-ink-3 tabular-nums">
                  <span>{cardRun.label}…</span>
                  <span>
                    {number.format(cardRun.done)} / {number.format(cardRun.total)}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-hover">
                  <div
                    className="h-full rounded-full bg-secondary transition-[width] duration-200"
                    style={{ width: `${cardRun.total ? Math.round((cardRun.done / cardRun.total) * 100) : 0}%` }}
                  />
                </div>
              </div>
            )}
            {cardError && (
              <div className="mt-3">
                <FormError message={cardError} />
              </div>
            )}
          </section>
        )
      })}

      {!canManage && <p className="px-1 text-caption text-ink-3">Only the Owner and managers can change who owns deals.</p>}

      <AlertDialog
        open={pendingRule !== null}
        onOpenChange={(open) => !open && setPendingRule(null)}
        title={`Use ${pendingRule ? RULE_LABEL[pendingRule] : ''} for new deals?`}
        description={
          pendingRule === 'single_user' && singleName
            ? `Every new deal will go to ${singleName}. Existing deals keep their owners.`
            : 'Deals added from now on are assigned this way. Existing deals keep their owners.'
        }
        confirmLabel="Use for new deals"
        pendingLabel="Saving…"
        width="compact"
        icon={null}
        onConfirm={async () => {
          if (!pendingRule) return
          await setCrmAssignmentRule(pipelineId, pendingRule, pendingRule === 'single_user' ? singleTarget : undefined)
          await refresh()
          setPendingRule(null)
        }}
      />
      <AlertDialog
        open={confirmRevert}
        onOpenChange={setConfirmRevert}
        tone="danger"
        width="compact"
        title="Revert round robin?"
        description={`${number.format(data.bySource.round_robin ?? 0)} deals shared by round robin become unassigned. Other deals keep their owners.`}
        confirmLabel="Revert"
        onConfirm={() => {
          setConfirmRevert(false)
          void revert()
        }}
      />
      <ReassignDialog
        pipelineId={pipelineId}
        person={reassign?.person ?? null}
        method={reassign?.method ?? 'round_robin'}
        people={data.people}
        onClose={() => setReassign(null)}
        onBusyChange={onBusyChange}
      />
    </div>
  )
}

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div className="card-3d rounded-xl px-3 py-2.5">
      <dt className="text-caption text-ink-3">{label}</dt>
      <dd className="text-title font-semibold text-ink tabular-nums">{number.format(value)}</dd>
    </div>
  )
}

/** Everyone on the list with a count and a bar, and a menu to unassign or transfer their deals. */
function PeopleCounts({
  people,
  count,
  canManage,
  onManage,
}: {
  people: AssignmentPerson[]
  count: (person: AssignmentPerson) => number
  canManage: boolean
  onManage: (person: AssignmentPerson) => void
}) {
  if (!people.length) {
    return <p className="text-label text-ink-3">Nobody is on this pipeline yet. Add people in Access users.</p>
  }
  const max = Math.max(1, ...people.map(count))
  return (
    <ul className="flex flex-col gap-1.5">
      {people.map((person) => {
        const n = count(person)
        return (
          <li key={person.userId} className="flex items-center gap-3">
            <span className={`w-32 shrink-0 truncate text-label ${person.eligible ? 'text-ink' : 'text-ink-3'}`} title={person.fullName}>
              {person.fullName}
            </span>
            <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-hover">
              <span className="block h-full rounded-full bg-ink-3" style={{ width: `${Math.round((n / max) * 100)}%` }} />
            </span>
            <span className="w-10 shrink-0 text-right text-label text-ink-2 tabular-nums">{number.format(n)}</span>
            {canManage && (
              <button
                type="button"
                onClick={() => onManage(person)}
                disabled={person.dealCount === 0}
                aria-label={`Unassign or transfer ${person.fullName}'s deals`}
                title="Unassign or transfer"
                className="grid size-7 shrink-0 place-items-center rounded-md text-ink-3 hover:bg-surface-hover hover:text-ink disabled:opacity-30"
              >
                <MoreHorizontal size={16} strokeWidth={2} aria-hidden />
              </button>
            )}
          </li>
        )
      })}
    </ul>
  )
}
