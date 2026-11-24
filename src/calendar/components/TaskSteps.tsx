import { useState } from 'react'
import { AlertDialog } from '@/components/Alert'
import { Button } from '@/components/Button'
import { FormError } from '@/components/FormField'
import { ApiError } from '@/lib/api'
import { stepTask, type AllowedTaskAction, type CalendarEvent, type TaskAction, type TaskField } from '../api'
import { wallParts, zonedInstant } from '../lib/zoned'

/*
 * The next-step panel (decision T7). The server decides which steps this
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

/** Requests for more time come first when pending; destructive steps always last. */
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
  const [confirming, setConfirming] = useState<AllowedTaskAction | null>(null)
  const [busy, setBusy] = useState<TaskAction | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function run(action: TaskAction, input: Partial<Record<TaskField, string>> = {}) {
    setBusy(action)
    setError(null)
    try {
      await stepTask(event.id, event.version, action, input)
      setActive(null)
      await onChanged()
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 409) await onChanged()
      setError(cause instanceof ApiError && cause.status !== 500 ? cause.message : 'Couldn’t save. Try again.')
      throw cause
    } finally {
      setBusy(null)
    }
  }

  if (!actions.length) return null

  return (
    <section aria-label="Next step" className="rounded-xl bg-surface p-3.5 shadow-lift">
      {active ? (
        <StepForm
          key={active.action}
          step={active}
          event={event}
          timezone={timezone}
          now={now}
          busy={busy === active.action}
          error={error}
          onBack={() => {
            setActive(null)
            setError(null)
          }}
          onSubmit={(input) => run(active.action, input).catch(() => undefined)}
        />
      ) : (
        <>
          <h3 className="text-label font-semibold text-ink-2">Next step</h3>
          <FormError message={error} />
          <div className="mt-2.5 flex flex-wrap gap-2">
            {actions.map((step) => {
              const meta = STEPS[step.action]
              return (
                <Button
                  key={step.action}
                  variant={meta.tone === 'primary' ? 'primary' : 'secondary'}
                  className={meta.tone === 'danger' ? 'text-danger' : ''}
                  loading={busy === step.action}
                  disabled={busy !== null}
                  onClick={() => {
                    setError(null)
                    if (Object.keys(step.fields).length) setActive(step)
                    else if (meta.confirm) setConfirming(step)
                    else void run(step.action).catch(() => undefined)
                  }}
                >
                  {meta.label}
                </Button>
              )
            })}
          </div>
        </>
      )}

      <AlertDialog
        open={confirming !== null}
        onOpenChange={(next) => !next && setConfirming(null)}
        tone="danger"
        icon={null}
        width="compact"
        title={confirming ? STEPS[confirming.action].label : ''}
        description={confirming ? STEPS[confirming.action].confirm : ''}
        confirmLabel={confirming ? STEPS[confirming.action].label : ''}
        cancelLabel="Keep it"
        pendingLabel="Saving…"
        onConfirm={async () => {
          if (confirming) await run(confirming.action)
        }}
      />
    </section>
  )
}

/** A step's inputs, in place of the buttons. Dates and times are in the company timezone. */
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

  function submit() {
    const gap = names.find((name) => required(name) && !values[name]?.trim())
    setMissing(gap ?? null)
    if (gap) return
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
      className="flex flex-col gap-3.5"
    >
      <h3 className="text-body font-semibold text-ink">{meta.heading ?? meta.label}</h3>
      <FormError message={error} />
      {names.map((name) => {
        const field = FIELDS[name]
        const id = `step-${name}`
        const isMissing = missing === name
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
                invalid={isMissing}
                onChange={(iso) => setValues((v) => ({ ...v, [name]: iso }))}
              />
            )}
            {isMissing ? (
              <p className="mt-1 text-caption text-danger">This is needed.</p>
            ) : (
              field.hint && <p className="mt-1 text-caption text-ink-3">{field.hint}</p>
            )}
          </div>
        )
      })}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onBack} disabled={busy}>
          Back
        </Button>
        <Button type="submit" variant={meta.tone === 'danger' ? 'danger' : 'primary'} loading={busy}>
          {meta.label}
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
  onChange,
}: {
  id: string
  value: string
  timezone: string
  invalid: boolean
  onChange: (iso: string) => void
}) {
  const parts = value ? wallParts(Date.parse(value), timezone) : { date: '', time: '' }
  const [date, setDate] = useState(parts.date)
  const [time, setTime] = useState(parts.time || '18:00')
  const emit = (d: string, t: string) => onChange(d && t ? zonedInstant(d, t, timezone).toISOString() : '')
  return (
    <div className="mt-1.5 grid grid-cols-[1fr_7rem] gap-2">
      <input
        id={id}
        type="date"
        value={date}
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
