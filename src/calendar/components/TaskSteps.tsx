import { useState } from 'react'
import { Button } from '@/components/Button'
import { FormError } from '@/components/FormField'
import { Select } from '@/components/Select'
import { ApiError } from '@/lib/api'
import {
  STATUS_LABEL,
  stepTask,
  type AllowedTaskAction,
  type CalendarEvent,
  type TaskAction,
  type TaskField,
  type TaskStatus,
} from '../api'
import { wallParts, zonedInstant } from '../lib/zoned'

/*
 * The task's Status dropdown (decision T7, revised): one select for the
 * assignee and the creator/owner alike, listing only the moves this viewer may
 * make. Picking one shows its inputs and a Save; nothing changes until then. The server decides which steps this
 * viewer may take (`permissions.actions`); this file only gives them labels,
 * tones and input forms, as the ERP's `lib/policy.js` did.
 */

type Tone = 'primary' | 'neutral' | 'danger'

const STEPS: Record<TaskAction, { label: string; heading?: string; tone: Tone; confirm?: string }> = {
  start: { label: 'Start work', tone: 'primary' },
  submit: { label: 'Submit', heading: 'Submit for review', tone: 'primary' },
  complete: { label: 'Complete', heading: 'Mark complete', tone: 'primary' },
  approve: { label: 'Approve', heading: 'Approve the work', tone: 'primary' },
  reject: { label: 'Send back', heading: 'Send the work back', tone: 'neutral' },
  hold: { label: 'Hold', heading: 'Put on hold', tone: 'neutral' },
  resume: { label: 'Lift hold', tone: 'primary' },
  request_cancel: { label: 'Ask to cancel', heading: 'Ask to cancel the task', tone: 'neutral' },
  approve_cancel: {
    label: 'Allow cancel',
    tone: 'danger',
    confirm: 'Cancel this task as asked? Only the owner can reopen it.',
  },
  decline_cancel: { label: 'Decline', heading: 'Decline the cancel request', tone: 'neutral' },
  withdraw_cancel: { label: 'Withdraw', tone: 'neutral' },
  cancel: { label: 'Cancel task', heading: 'Cancel the task', tone: 'danger' },
  extend: { label: 'Extend', heading: 'Extend the deadline', tone: 'primary' },
  reopen: { label: 'Reopen', heading: 'Reopen the task', tone: 'neutral' },
  request_extension: { label: 'More time', heading: 'Ask for more time', tone: 'neutral' },
  approve_extension: { label: 'Approve', heading: 'Approve the new deadline', tone: 'primary' },
  decline_extension: { label: 'Decline', heading: 'Decline more time', tone: 'neutral' },
  withdraw_extension: { label: 'Withdraw', tone: 'neutral' },
}

const FIELDS: Record<TaskField, { label: string; kind: 'text' | 'datetime'; hint?: string }> = {
  holdReason: { label: 'Why is it on hold?', kind: 'text' },
  holdUntil: { label: 'Hold until', kind: 'datetime', hint: 'On or before the deadline.' },
  cancelReason: { label: 'Reason', kind: 'text' },
  completionRemarks: { label: 'Completion notes', kind: 'text' },
  note: { label: 'Note', kind: 'text' },
  deadline: { label: 'New deadline', kind: 'datetime' },
  extensionUntil: { label: 'Proposed deadline', kind: 'datetime', hint: 'Later than the current deadline.' },
  extensionReason: { label: 'Why do you need more time?', kind: 'text' },
}

/** Forward moves first, neutral ones next, destructive ones last. */
const order = (a: AllowedTaskAction) => {
  const tone = STEPS[a.action].tone
  return tone === 'danger' ? 2 : tone === 'primary' ? 0 : 1
}

interface TaskStepsProps {
  event: CalendarEvent
  timezone: string
  now: number
  /** A step was saved, or someone else changed the task first (409): reload. */
  onChanged: () => Promise<unknown>
}

export function TaskSteps({ event, timezone, now, onChanged }: TaskStepsProps) {
  const actions = [...event.permissions.actions].sort((a, b) => order(a) - order(b))
  const [active, setActive] = useState<AllowedTaskAction | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const current = event.effectiveStatus as TaskStatus

  async function run(action: TaskAction, input: Partial<Record<TaskField, string>> = {}) {
    setBusy(true)
    setError(null)
    try {
      await stepTask(event.id, event.version, action, input)
      setActive(null)
      await onChanged()
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 409) await onChanged()
      setError(cause instanceof ApiError && cause.status !== 500 ? cause.message : 'Couldn’t save. Try again.')
    } finally {
      setBusy(false)
    }
  }

  if (!actions.length) return null

  return (
    <section aria-label="Status" className="rounded-xl bg-surface p-3.5 shadow-lift">
      <label htmlFor="task-status" className="block text-label font-semibold text-ink-2">
        Status
      </label>
      <Select<string>
        id="task-status"
        aria-label="Status"
        className="mt-1.5"
        value={active?.action ?? ''}
        disabled={busy}
        onChange={(value) => {
          setError(null)
          setActive(actions.find((a) => a.action === value) ?? null)
        }}
        options={[
          { value: '', label: STATUS_LABEL[current], meta: 'now' },
          ...actions.map((step) => ({
            value: step.action,
            label: optionLabel(step, current),
            danger: STEPS[step.action].tone === 'danger',
          })),
        ]}
      />
      {!active && <FormError message={error} />}
      {active && (
        <StepForm
          key={active.action}
          step={active}
          event={event}
          timezone={timezone}
          now={now}
          busy={busy}
          error={error}
          onBack={() => {
            setActive(null)
            setError(null)
          }}
          onSubmit={(input) => void run(active.action, input)}
        />
      )}
    </section>
  )
}

/** "Submit → In review"; a step that keeps the status (more time) is just its name. */
function optionLabel(step: AllowedTaskAction, current: TaskStatus) {
  const meta = STEPS[step.action]
  const name = meta.heading ?? meta.label
  return step.to === current ? name : `${name} → ${STATUS_LABEL[step.to]}`
}

/** The chosen move's inputs and its Save, under the Status select. Dates and times are in the company timezone. */
function StepForm({
  step,
  event,
  timezone,
  now,
  busy,
  error,
  onBack,
  onSubmit,
}: {
  step: AllowedTaskAction
  event: CalendarEvent
  timezone: string
  now: number
  busy: boolean
  error: string | null
  onBack: () => void
  onSubmit: (input: Partial<Record<TaskField, string>>) => void
}) {
  const meta = STEPS[step.action]
  // Reopening needs a new deadline only once the old one has passed (the server checks too).
  const required = (name: TaskField) =>
    step.fields[name] === 'required' || (step.action === 'reopen' && name === 'deadline' && Date.parse(event.endsAt) <= now)
  const names = Object.keys(step.fields) as TaskField[]
  const [values, setValues] = useState<Partial<Record<TaskField, string>>>(() => {
    const start: Partial<Record<TaskField, string>> = {}
    // Approving more time starts from the date that was asked for.
    if (step.action === 'approve_extension' && event.extensionUntil) start.deadline = event.extensionUntil
    return start
  })
  const [missing, setMissing] = useState<TaskField | null>(null)
  const [past, setPast] = useState<TaskField | null>(null)

  function submit() {
    const gap = names.find((name) => required(name) && !values[name]?.trim())
    setMissing(gap ?? null)
    // Every date a step takes (hold end, new or proposed deadline) must be ahead of now.
    const late = gap
      ? undefined
      : names.find((name) => FIELDS[name].kind === 'datetime' && values[name] && Date.parse(values[name]!) <= Date.now())
    setPast(late ?? null)
    if (gap || late) return
    const input: Partial<Record<TaskField, string>> = {}
    for (const name of names) {
      const value = values[name]?.trim()
      if (value) input[name] = value
    }
    onSubmit(input)
  }

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
      className="mt-3.5 flex flex-col gap-3.5"
    >
      {meta.confirm && <p className="text-label text-ink-2">{meta.confirm}</p>}
      <FormError message={error} />
      {names.map((name) => {
        const field = FIELDS[name]
        const id = `step-${name}`
        const isMissing = missing === name
        const isPast = past === name
        return (
          <div key={name}>
            <label htmlFor={id} className="block text-label font-medium text-ink-2">
              {field.label}
              {!required(name) && <span className="font-normal text-ink-3"> (optional)</span>}
            </label>
            {field.kind === 'text' ? (
              <textarea
                id={id}
                rows={2}
                maxLength={2000}
                value={values[name] ?? ''}
                onChange={(e) => setValues((v) => ({ ...v, [name]: e.target.value }))}
                aria-invalid={isMissing}
                className="field-input mt-1.5 h-auto min-h-16 resize-y py-2 leading-6"
              />
            ) : (
              <ZonedDateTime
                id={id}
                value={values[name] ?? ''}
                timezone={timezone}
                invalid={isMissing || isPast}
                now={now}
                onChange={(iso) => setValues((v) => ({ ...v, [name]: iso }))}
              />
            )}
            {isMissing || isPast ? (
              <p className="mt-1 text-caption text-danger">
                {isMissing ? 'This is needed.' : 'Pick a time in the future.'}
              </p>
            ) : (
              field.hint && <p className="mt-1 text-caption text-ink-3">{field.hint}</p>
            )}
          </div>
        )
      })}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onBack} disabled={busy}>
          Undo
        </Button>
        <Button type="submit" variant={meta.tone === 'danger' ? 'danger' : 'primary'} loading={busy}>
          {busy ? 'Saving…' : meta.label}
        </Button>
      </div>
    </form>
  )
}

/** Date and time inputs in the company timezone, holding an ISO instant. */
function ZonedDateTime({
  id,
  value,
  timezone,
  invalid,
  now,
  onChange,
}: {
  id: string
  value: string
  timezone: string
  invalid: boolean
  /** The live clock: no date or time before it can be picked. */
  now: number
  onChange: (iso: string) => void
}) {
  const parts = value ? wallParts(Date.parse(value), timezone) : { date: '', time: '' }
  const today = wallParts(now, timezone)
  const [date, setDate] = useState(parts.date)
  const [time, setTime] = useState(parts.time || '18:00')
  const emit = (d: string, t: string) => onChange(d && t ? zonedInstant(d, t, timezone).toISOString() : '')
  return (
    <div className="mt-1.5 grid grid-cols-[1fr_7rem] gap-2">
      <input
        id={id}
        type="date"
        value={date}
        min={today.date}
        onChange={(e) => {
          setDate(e.target.value)
          emit(e.target.value, time)
        }}
        aria-invalid={invalid}
        className="field-input tabular-nums"
      />
      <input
        type="time"
        aria-label="Time"
        value={time}
        min={date === today.date ? today.time : undefined}
        onChange={(e) => {
          setTime(e.target.value)
          emit(date, e.target.value)
        }}
        aria-invalid={invalid}
        className="field-input tabular-nums"
      />
    </div>
  )
}
