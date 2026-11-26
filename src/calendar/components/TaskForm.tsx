import { useQuery } from '@tanstack/react-query'
import { Check, ChevronDown, Loader2, Search } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { Button } from '@/components/Button'
import { FormError, FormField } from '@/components/FormField'
import { ApiError } from '@/lib/api'
import { initials } from '@/lib/auth'
import { useDebouncedValue } from '@/lib/use-debounced-value'
import {
  PRIORITY_LABEL,
  calendarPeopleQuery,
  type CalendarEvent,
  type CalendarPersonRef,
  type TaskInput,
  type TaskPriority,
} from '../api'
import { wallParts, zonedInstant } from '../lib/zoned'

const PRIORITIES: TaskPriority[] = ['low', 'medium', 'high', 'urgent']

export interface TaskViewer {
  id: string
  fullName: string
  role: 'owner' | 'manager' | 'staff'
}

interface TaskFormProps {
  /** The task being edited; null for a new one. */
  event: CalendarEvent | null
  /** The day picked on the calendar (a new task is due on it). */
  day: string
  timezone: string
  viewer: TaskViewer
  onCancel: () => void
  onSubmit: (input: TaskInput) => Promise<void>
}

interface FieldErrors {
  title?: string
  deadline?: string
  assignee?: string
}

/**
 * Create and edit a task (T1, T4, T7): title, who does it, the deadline in
 * the company timezone, priority and details. Staff only assign to
 * themselves, so they don't get a picker. Reassigning starts the task over.
 */
/**
 * A new task's deadline: 18:00 on the picked day, but never in the past. A
 * past day moves to today, and on today after 18:00 it's due in an hour.
 */
function newDeadline(day: string, now: { date: string; time: string }, timezone: string) {
  const date = day < now.date ? now.date : day
  if (date === now.date && now.time >= '18:00') {
    return wallParts(zonedInstant(now.date, now.time, timezone).getTime() + 60 * 60_000, timezone)
  }
  return { date, time: '18:00' }
}

export function TaskForm({ event, day, timezone, viewer, onCancel, onSubmit }: TaskFormProps) {
  // A deadline can't be in the past. Read the clock once when the form opens; Save checks again.
  const [now] = useState(() => wallParts(Date.now(), timezone))
  const due = event ? wallParts(Date.parse(event.endsAt), timezone) : newDeadline(day, now, timezone)
  const [title, setTitle] = useState(event?.title ?? '')
  const [date, setDate] = useState(due.date)
  const [time, setTime] = useState(due.time)
  const [priority, setPriority] = useState<TaskPriority>(event?.priority ?? 'medium')
  const [description, setDescription] = useState(event?.description ?? '')
  const [assignee, setAssignee] = useState<CalendarPersonRef | null>(
    event
      ? event.assigneeId
        ? { id: event.assigneeId, fullName: event.assigneeName ?? 'Deleted user' }
        : null
      : { id: viewer.id, fullName: viewer.fullName },
  )
  const [errors, setErrors] = useState<FieldErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const reassigning = !!event && !!assignee && assignee.id !== event.assigneeId

  async function submit() {
    const next: FieldErrors = {}
    if (!title.trim()) next.title = 'Give the task a title'
    if (!assignee) next.assignee = 'Choose who will do it'
    let deadline: Date | null = null
    if (!date || !time) next.deadline = 'Set a deadline'
    else {
      deadline = zonedInstant(date, time, timezone)
      const unchanged = event && deadline.getTime() === Date.parse(event.endsAt)
      if (!unchanged && deadline.getTime() <= Date.now()) {
        next.deadline = `The deadline must be in the future. It’s ${wallParts(Date.now(), timezone).time} now.`
      }
    }
    setErrors(next)
    if (Object.keys(next).length || !deadline || !assignee) return

    setSaving(true)
    setServerError(null)
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        deadline: deadline.toISOString(),
        assigneeId: assignee.id,
        priority,
      })
    } catch (cause) {
      setServerError(cause instanceof ApiError && cause.status !== 500 ? cause.message : 'Couldn’t save. Try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      noValidate
      aria-busy={saving}
      onSubmit={(formEvent) => {
        formEvent.preventDefault()
        void submit()
      }}
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto bg-canvas px-5 py-5 [&>*]:shrink-0">
        <FormError message={serverError} />

        <FormField label="Title" htmlFor="task-title" error={errors.title}>
          <input
            id="task-title"
            autoFocus={!event}
            maxLength={200}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-invalid={!!errors.title}
            placeholder="What needs doing?"
            className="field-input"
          />
        </FormField>

        <FormField
          label="Assign to"
          error={errors.assignee}
          hint={
            viewer.role === 'staff'
              ? 'You can assign tasks to yourself.'
              : reassigning
                ? 'Reassigning starts the task over for the new person.'
                : viewer.role === 'manager'
                  ? 'Staff, or yourself.'
                  : undefined
          }
        >
          {viewer.role === 'staff' ? (
            <p className="flex h-10 items-center rounded-md bg-surface px-3 text-body text-ink shadow-[inset_0_0_0_1px_var(--line-strong)]">
              {assignee?.id === viewer.id ? `${viewer.fullName} (you)` : (assignee?.fullName ?? viewer.fullName)}
            </p>
          ) : (
            <AssigneePicker value={assignee} onChange={setAssignee} viewerId={viewer.id} disabled={saving} />
          )}
        </FormField>

        <FormField label="Deadline" error={errors.deadline} hint={`Time is in ${timezone.replaceAll('_', ' ')}.`}>
          <div className="grid grid-cols-[1fr_7rem] gap-2">
            <input
              type="date"
              aria-label="Deadline date"
              value={date}
              min={now.date}
              onChange={(e) => setDate(e.target.value)}
              aria-invalid={!!errors.deadline}
              className="field-input tabular-nums"
            />
            <input
              type="time"
              aria-label="Deadline time"
              value={time}
              min={date === now.date ? now.time : undefined}
              onChange={(e) => setTime(e.target.value)}
              aria-invalid={!!errors.deadline}
              className="field-input tabular-nums"
            />
          </div>
        </FormField>

        <FormField label="Priority">
          <div className="flex w-fit flex-wrap gap-1 rounded-xl bg-canvas p-1.5 shadow-well">
            {PRIORITIES.map((value) => (
              <label
                key={value}
                className={`inline-flex h-8 min-w-[4.75rem] cursor-pointer items-center justify-center rounded-lg px-3 text-label transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--focus)] ${
                  priority === value ? 'btn btn-primary' : 'font-medium text-ink-2 hover:bg-surface-hover hover:text-ink'
                }`}
              >
                <input
                  type="radio"
                  name="task-priority"
                  value={value}
                  checked={priority === value}
                  disabled={saving}
                  onChange={() => setPriority(value)}
                  className="sr-only"
                />
                {PRIORITY_LABEL[value]}
              </label>
            ))}
          </div>
        </FormField>

        <FormField label="Details (optional)" htmlFor="task-description">
          <textarea
            id="task-description"
            rows={4}
            maxLength={5000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What does done look like?"
            className="field-input h-auto min-h-20 resize-y py-2 leading-6"
          />
        </FormField>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-line bg-canvas/60 px-5 py-3.5">
        <Button variant="secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={saving}>
          {saving ? 'Saving…' : event ? 'Save changes' : 'Create task'}
        </Button>
      </div>
    </form>
  )
}

/**
 * Who does the task: a select-style button showing the current choice, opening
 * a list of everyone the viewer may assign (`for=assign`: the owner anyone, a
 * manager staff and themselves), with a server-side search at its top.
 */
function AssigneePicker({
  value,
  onChange,
  viewerId,
  disabled,
}: {
  value: CalendarPersonRef | null
  onChange: (person: CalendarPersonRef) => void
  viewerId: string
  disabled: boolean
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const listId = useId()
  const ref = useRef<HTMLDivElement>(null)
  const needle = useDebouncedValue(query.trim(), 300)
  const { data = [], isFetching, isPending } = useQuery({ ...calendarPeopleQuery(needle, 'assign'), enabled: open })

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  const close = () => {
    setOpen(false)
    setQuery('')
  }

  return (
    <div
      ref={ref}
      className="relative"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          e.stopPropagation()
          close()
        }
      }}
    >
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => (open ? close() : setOpen(true))}
        className="field-input flex items-center gap-2 pr-2 pl-2 text-left"
      >
        {value ? (
          <>
            <span
              aria-hidden
              className="grid size-6 shrink-0 place-items-center rounded-sm bg-secondary-soft text-micro font-semibold text-secondary-text"
            >
              {initials(value.fullName)}
            </span>
            <span className="min-w-0 flex-1 truncate text-body text-ink">
              {value.fullName}
              {value.id === viewerId && <span className="text-ink-3"> (you)</span>}
            </span>
          </>
        ) : (
          <span className="flex-1 pl-1 text-body text-ink-3">Choose a person</span>
        )}
        <ChevronDown
          size={16}
          strokeWidth={2}
          aria-hidden
          className={`shrink-0 text-ink-3 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg bg-surface shadow-dialog">
          <div className="relative border-b border-line p-1.5">
            <Search
              size={15}
              strokeWidth={2}
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-3"
            />
            <input
              autoFocus
              aria-label="Search people"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or email"
              className="field-input h-9 pl-8"
            />
            {isFetching && (
              <Loader2
                size={15}
                strokeWidth={2}
                aria-hidden
                className="absolute top-1/2 right-4 -translate-y-1/2 animate-spin text-ink-3"
              />
            )}
          </div>
          <ul id={listId} role="listbox" aria-label="People" className="max-h-60 overflow-y-auto py-1">
            {data.length === 0 ? (
              <li className="px-3 py-2 text-label text-ink-3">
                {isPending || isFetching ? 'Loading…' : 'No one matches.'}
              </li>
            ) : (
              data.map((person) => {
                const selected = person.id === value?.id
                return (
                  <li key={person.id} role="option" aria-selected={selected}>
                    <button
                      type="button"
                      onClick={() => {
                        onChange({ id: person.id, fullName: person.fullName })
                        close()
                      }}
                      className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-body hover:bg-surface-hover hover:text-ink ${
                        selected ? 'text-ink' : 'text-ink-2'
                      }`}
                    >
                      <span
                        aria-hidden
                        className="grid size-6 shrink-0 place-items-center rounded-sm bg-secondary-soft text-micro font-semibold text-secondary-text"
                      >
                        {initials(person.fullName)}
                      </span>
                      <span className="min-w-0 flex-1 truncate">
                        {person.fullName}
                        {person.id === viewerId && <span className="text-ink-3"> (you)</span>}
                      </span>
                      <span className="text-caption text-ink-3 capitalize">{person.role}</span>
                      <Check
                        size={15}
                        strokeWidth={2.2}
                        aria-hidden
                        className={`shrink-0 text-secondary-text ${selected ? '' : 'invisible'}`}
                      />
                    </button>
                  </li>
                )
              })
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
