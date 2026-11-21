import { RotateCcwIcon } from '@animateicons/react/lucide'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
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
  /** null = untouched (the saved target shows as picked); '' = unchecked; otherwise a user id. */
  const [singlePick, setSinglePick] = useState<string | null>(null)
  /** The tool card folded open (one at a time); Creator and Manual have no tools. */
  const [expanded, setExpanded] = useState<AssignmentRule | null>(null)
  /** The Round robin card's people list (folded by default). */
  const [rrListOpen, setRrListOpen] = useState(false)
  /** The Single user card's person list: open by default until a target is set. */
  const [singleOpen, setSingleOpen] = useState<boolean | null>(null)
  const [run, setRun] = useState<ToolRun | null>(null)
  const [toolError, setToolError] = useState<{ card: AssignmentRule; message: string } | null>(null)
  /** A person's Unassign ▾ choice, waiting for confirmation. */
  const [unassignTarget, setUnassignTarget] = useState<{
    person: AssignmentPerson
    card: AssignmentRule
    scope: 'method' | 'all'
  } | null>(null)
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
  const singleTarget = singlePick ?? data.singleUserId ?? ''
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

  /** Unassigns one person's deals: this card's method only, or all of theirs. */
  const unassignPerson = (person: AssignmentPerson, card: AssignmentRule, scope: 'method' | 'all') => {
    const total = scope === 'method' ? (person.bySource[card] ?? 0) : person.dealCount
    return runTool(card, `Unassigning ${person.fullName}’s deals`, total, async () => {
      const r = await unassignCrmDeals(pipelineId, { userId: person.userId, source: scope === 'method' ? card : undefined })
      return { done: r.unassigned, remaining: r.remaining }
    })
  }

  const target = unassignTarget
  const targetCount = target ? (target.scope === 'method' ? (target.person.bySource[target.card] ?? 0) : target.person.dealCount) : 0

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
        const hasTools = key === 'round_robin' || key === 'single_user'
        // A running tool keeps its card open so its progress stays visible.
        const isOpen = hasTools && (expanded === key || cardRun !== null)
        return (
          <section
            key={key}
            aria-label={RULE_LABEL[key]}
            className={`card-3d rounded-xl ${active ? 'outline-2 outline-secondary' : ''}`}
          >
            <div className="flex items-start gap-3 p-4">
              <button
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={`Use ${RULE_LABEL[key]} for new deals`}
                title={active ? 'New deals are assigned by this rule' : 'Use for new deals'}
                disabled={!canManage || busy || active}
                onClick={() => {
                  // Single user needs a person first: open its card to pick one.
                  if (key === 'single_user' && !singleTarget) {
                    setExpanded('single_user')
                    setSingleOpen(true)
                  } else setPendingRule(key)
                }}
                className="mt-0.5 disabled:cursor-not-allowed"
              >
                <RadioDot checked={active} />
              </button>
              <button
                type="button"
                onClick={() => (hasTools ? setExpanded(isOpen ? null : key) : setPendingRule(key))}
                disabled={!hasTools && (!canManage || busy || active)}
                aria-expanded={hasTools ? isOpen : undefined}
                className="flex min-w-0 flex-1 items-start gap-3 text-left disabled:cursor-default"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-body font-semibold text-ink">{RULE_LABEL[key]}</span>
                    {active && (
                      <span className="rounded-md bg-secondary-soft px-1.5 py-0.5 text-micro font-semibold text-secondary-text">
                        New deals{key === 'single_user' && singleName ? ` · ${singleName}` : ''}
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-label text-ink-2">{description}</span>
                </span>
                {hasTools && (
                  <ChevronDown
                    size={16}
                    strokeWidth={2}
                    aria-hidden
                    className={`mt-1 shrink-0 text-ink-3 transition-transform duration-press ${isOpen ? 'rotate-180' : ''}`}
                  />
                )}
              </button>
            </div>

            {isOpen && (
            <div className="border-t border-line px-4 pt-3 pb-4">
            {key === 'round_robin' && (
              <div className="flex flex-col gap-3">
                <div className="overflow-hidden rounded-lg ring-1 ring-line">
                  <button
                    type="button"
                    onClick={() => setRrListOpen((current) => !current)}
                    aria-expanded={rrListOpen}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-surface-hover/50"
                  >
                    <span className="min-w-0 flex-1 truncate text-body text-ink">
                      Round robin rule for {eligible.length} {eligible.length === 1 ? 'user' : 'users'}
                    </span>
                    <ChevronDown
                      size={16}
                      strokeWidth={2}
                      aria-hidden
                      className={`shrink-0 text-ink-3 transition-transform duration-press ${rrListOpen ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {rrListOpen && (
                    <div className="max-h-96 min-h-40 overflow-y-auto border-t border-line px-3 py-2.5">
                      <PeopleCounts
                        people={data.people}
                        count={(p) => p.bySource.round_robin ?? 0}
                        canManage={canManage && !busy}
                        method="round_robin"
                        onUnassign={(person, scope) => setUnassignTarget({ person, card: 'round_robin', scope })}
                      />
                    </div>
                  )}
                </div>
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
              <SingleUserSection
                people={data.people}
                isRule={data.rule === 'single_user'}
                targetId={data.singleUserId}
                pickedId={singleTarget || null}
                onPick={setSinglePick}
                open={singleOpen ?? !(data.rule === 'single_user' && data.singleUserId)}
                onOpenChange={setSingleOpen}
                unassigned={unassigned}
                canManage={canManage}
                busy={busy}
                onGive={() => void give()}
                onUseForNewDeals={() => setPendingRule('single_user')}
                onUnassign={(person, scope) => setUnassignTarget({ person, card: 'single_user', scope })}
              />
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
      <AlertDialog
        open={target !== null}
        onOpenChange={(open) => !open && setUnassignTarget(null)}
        tone="danger"
        width="compact"
        title={`Unassign deals from ${target?.person.fullName ?? ''}?`}
        description={
          target
            ? `${
                target.scope === 'method'
                  ? `This removes ${target.person.fullName} from ${number.format(targetCount)} ${RULE_LABEL[target.card].toLowerCase()} deal${targetCount === 1 ? '' : 's'}.`
                  : `This removes ${target.person.fullName} from all ${number.format(targetCount)} deal${targetCount === 1 ? '' : 's'} they own in this pipeline, however they were assigned.`
              }${
                data.rule === 'single_user' && data.singleUserId === target.person.userId
                  ? ` ${target.person.fullName} still gets new deals until you change the rule.`
                  : ''
              }`
            : undefined
        }
        confirmLabel={`Unassign ${number.format(targetCount)}`}
        onConfirm={() => {
          const chosen = target
          setUnassignTarget(null)
          if (chosen) void unassignPerson(chosen.person, chosen.card, chosen.scope)
        }}
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
  method,
  onUnassign,
}: {
  people: AssignmentPerson[]
  count: (person: AssignmentPerson) => number
  canManage: boolean
  /** The card's method: the narrower Unassign scope. */
  method: AssignmentRule
  onUnassign: (person: AssignmentPerson, scope: 'method' | 'all') => void
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
              <span className="block h-full rounded-full bg-secondary" style={{ width: `${Math.round((n / max) * 100)}%` }} />
            </span>
            <span className="w-10 shrink-0 text-right text-label text-ink-2 tabular-nums">{number.format(n)}</span>
            {canManage && (
              <span className="flex w-7 shrink-0 justify-end">
                <UnassignMenu
                  name={person.fullName}
                  methodLabel={`${RULE_LABEL[method]} deals`}
                  methodCount={person.bySource[method] ?? 0}
                  totalCount={person.dealCount}
                  onPick={(scope) => onUnassign(person, scope)}
                />
              </span>
            )}
          </li>
        )
      })}
    </ul>
  )
}

/**
 * A person's unassign button (an animated rotate-back icon): a small menu with
 * this card's deals or all their deals, each with its count; an option is
 * disabled when it would remove nothing or the same deals as the other.
 */
function UnassignMenu({
  name,
  methodLabel,
  methodCount,
  totalCount,
  onPick,
}: {
  name: string
  methodLabel: string
  methodCount: number
  totalCount: number
  onPick: (scope: 'method' | 'all') => void
}) {
  /** Where the menu sits, relative to its host (the drawer, or the page). */
  const [menu, setMenu] = useState<{ top?: number; bottom?: number; right: number; host: HTMLElement } | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menu) return
    const close = () => setMenu(null)
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node
      if (!menuRef.current?.contains(target) && !buttonRef.current?.contains(target)) close()
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault() // close the menu, not the drawer
      event.stopPropagation()
      close()
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey, true)
    window.addEventListener('resize', close)
    window.addEventListener('scroll', close, true)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey, true)
      window.removeEventListener('resize', close)
      window.removeEventListener('scroll', close, true)
    }
  }, [menu])

  if (!totalCount) return null
  const options = [
    { scope: 'method' as const, label: `Unassign ${methodLabel.toLowerCase()}`, count: methodCount, disabled: methodCount === 0 },
    { scope: 'all' as const, label: 'Unassign all deals', count: totalCount, disabled: methodCount === totalCount },
  ]

  function toggle() {
    if (menu || !buttonRef.current) {
      setMenu(null)
      return
    }
    // The menu goes into the drawer itself (outside the scrolling list, so it is
    // never clipped). The drawer is translated, so fixed positions are relative
    // to it: measure against the drawer, not the window.
    const host = (buttonRef.current.closest('dialog') as HTMLElement | null) ?? document.body
    const box = host.getBoundingClientRect()
    const rect = buttonRef.current.getBoundingClientRect()
    const right = box.right - rect.right
    // Open upwards when there's no room below.
    setMenu(
      window.innerHeight - rect.bottom < 120
        ? { bottom: box.bottom - rect.top + 4, right, host }
        : { top: rect.bottom - box.top + 4, right, host },
    )
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={Boolean(menu)}
        aria-label={`Unassign deals from ${name}`}
        title="Unassign"
        className={`grid size-7 place-items-center rounded-md text-ink-3 transition-colors hover:bg-surface-hover hover:text-ink ${
          menu ? 'bg-surface-hover text-ink' : ''
        }`}
      >
        <RotateCcwIcon size={15} duration={0.6} color="currentColor" aria-hidden />
      </button>
      {menu &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label={`Unassign deals from ${name}`}
            className="fixed z-50 w-56 rounded-lg bg-surface py-1 shadow-dialog"
            style={{ top: menu.top, bottom: menu.bottom, right: menu.right }}
          >
            {options.map((option) => (
              <button
                key={option.scope}
                type="button"
                role="menuitem"
                disabled={option.disabled}
                onClick={() => {
                  setMenu(null)
                  onPick(option.scope)
                }}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-body text-ink hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent"
              >
                <span>{option.label}</span>
                <span className="shrink-0 text-label text-ink-3 tabular-nums">{number.format(option.count)}</span>
              </button>
            ))}
          </div>,
          menu.host,
        )}
    </>
  )
}

/**
 * Single user, as in the reference: a folding list of the people on the
 * pipeline (the current target in the header, "Gets new deals"). Pick someone
 * to assign the unassigned deals now or use them for new deals; click the
 * picked person again to uncheck. Each row shows their deals as a bar and has
 * the unassign menu.
 */
function SingleUserSection({
  people,
  isRule,
  targetId,
  pickedId,
  onPick,
  open,
  onOpenChange,
  unassigned,
  canManage,
  busy,
  onGive,
  onUseForNewDeals,
  onUnassign,
}: {
  people: AssignmentPerson[]
  isRule: boolean
  targetId: string | null
  pickedId: string | null
  onPick: (userId: string) => void
  open: boolean
  onOpenChange: (open: boolean) => void
  unassigned: number
  canManage: boolean
  busy: boolean
  onGive: () => void
  onUseForNewDeals: () => void
  onUnassign: (person: AssignmentPerson, scope: 'method' | 'all') => void
}) {
  const hasTarget = isRule && Boolean(targetId)
  const target = people.find((p) => p.userId === targetId) ?? null
  const maxDeals = Math.max(1, ...people.map((p) => p.dealCount))
  const picked = people.find((p) => p.userId === pickedId && p.eligible) ?? null
  const pickedIsTarget = Boolean(picked) && hasTarget && picked?.userId === targetId

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-lg ring-1 ring-line">
        <button
          type="button"
          onClick={() => onOpenChange(!open)}
          aria-expanded={open}
          className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-surface-hover/50"
        >
          {hasTarget && <Initial name={target?.fullName ?? '?'} />}
          <span className={`min-w-0 flex-1 truncate text-body ${hasTarget ? 'font-medium text-ink' : 'text-ink-3'}`}>
            {hasTarget ? (target?.fullName ?? 'Person unavailable') : 'Choose a person'}
            {hasTarget && <span className="ml-1.5 text-caption font-normal text-ink-3">(Gets new deals)</span>}
          </span>
          <span className="shrink-0 text-caption text-ink-3 tabular-nums">
            {people.length} {people.length === 1 ? 'person' : 'people'}
          </span>
          <ChevronDown
            size={16}
            strokeWidth={2}
            aria-hidden
            className={`shrink-0 text-ink-3 transition-transform duration-press ${open ? 'rotate-180' : ''}`}
          />
        </button>

        {open &&
          (people.length === 0 ? (
            <p className="border-t border-line px-3 py-4 text-label text-ink-3">
              Nobody is on this pipeline yet. Add people in Access users.
            </p>
          ) : (
            <ul role="radiogroup" aria-label="People" className="max-h-96 min-h-40 divide-y divide-line overflow-y-auto border-t border-line">
              {people.map((person) => {
                const isPicked = person.userId === pickedId
                const isTarget = hasTarget && person.userId === targetId
                const pickable = canManage && person.eligible && !busy
                return (
                  <li key={person.userId} className={isPicked ? 'bg-secondary-soft/50' : ''}>
                    <div className="flex items-center gap-3 px-3 py-2">
                      <button
                        type="button"
                        role="radio"
                        aria-checked={isPicked}
                        disabled={!pickable}
                        // Clicking the checked person again unchecks them.
                        onClick={() => onPick(isPicked ? '' : person.userId)}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:cursor-default"
                      >
                        <span className={person.eligible ? '' : 'opacity-40'}>
                          <RadioDot checked={isPicked} small />
                        </span>
                        <span className="flex w-36 min-w-0 shrink-0 items-center gap-1.5">
                          <span
                            className={`truncate text-body ${person.eligible ? 'text-ink' : 'text-ink-3'} ${isPicked ? 'font-medium' : ''}`}
                            title={person.fullName}
                          >
                            {person.fullName}
                          </span>
                          {isTarget && (
                            <span className="shrink-0 rounded bg-secondary-soft px-1 text-micro font-semibold text-secondary-text" title="Gets new deals">
                              New
                            </span>
                          )}
                        </span>
                        {/* Their deals here, against whoever has the most. */}
                        <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-hover">
                          <span
                            className="block h-full rounded-full bg-secondary"
                            style={{ width: `${Math.round((person.dealCount / maxDeals) * 100)}%` }}
                          />
                        </span>
                        <span className="w-10 shrink-0 text-right text-label text-ink-2 tabular-nums">
                          {number.format(person.dealCount)}
                        </span>
                      </button>
                      {canManage && !busy && (
                        <span className="flex w-7 shrink-0 justify-end">
                          <UnassignMenu
                            name={person.fullName}
                            methodLabel="Single user deals"
                            methodCount={person.bySource.single_user ?? 0}
                            totalCount={person.dealCount}
                            onPick={(scope) => onUnassign(person, scope)}
                          />
                        </span>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          ))}
      </div>

      {canManage && picked ? (
        <div className="flex flex-col gap-2">
          <p className="text-label text-ink">
            <span className="font-medium">{picked.fullName}</span>
            {pickedIsTarget ? ' gets new deals.' : ' will get every new deal if you use them for new deals.'}
          </p>
          <div className="flex flex-wrap gap-2">
            {unassigned > 0 && (
              <Button size="sm" variant="primary" disabled={busy} onClick={onGive}>
                Assign {number.format(unassigned)} deal{unassigned === 1 ? '' : 's'} now
              </Button>
            )}
            {!pickedIsTarget && (
              <Button size="sm" variant="secondary" disabled={busy} onClick={onUseForNewDeals}>
                Use for new deals
              </Button>
            )}
          </div>
        </div>
      ) : canManage && people.some((p) => p.eligible) ? (
        <p className="text-label text-ink-3">Pick a person to give them the unassigned deals, or to make them get every new deal.</p>
      ) : null}
    </div>
  )
}

/** A person's initial in a small round badge. */
function Initial({ name }: { name: string }) {
  return (
    <span
      aria-hidden
      className="grid size-7 shrink-0 place-items-center rounded-full bg-secondary-soft text-label font-semibold text-secondary-text uppercase"
    >
      {name.slice(0, 1)}
    </span>
  )
}
