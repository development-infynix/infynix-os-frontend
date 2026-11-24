import { useState } from 'react'
import { Button } from '@/components/Button'
import { FormError, FormField } from '@/components/FormField'
import { Select } from '@/components/Select'
import { ApiError } from '@/lib/api'
import {
  TYPE_LABEL,
  type CalendarEvent,
  type CalendarEventInput,
  type CalendarEventType,
  type CalendarPersonRef,
  type EffectiveStatus,
} from '../api'
import { wallParts, zonedInstant } from '../lib/zoned'
import { PeoplePicker } from './PeoplePicker'

const MAX_MINUTES = 62 * 24 * 60

interface EventFormProps {
  type: CalendarEventType
  /** The event being edited; null for a new one. */
  event: CalendarEvent | null
  /** The day picked on the calendar (new events start on it). */
  day: string
  timezone: string
  /** Whether the viewer may change who sees the meeting (its creator or the owner). */
  canChangeVisibility: boolean
  onCancel: () => void
  /** A status change picked in the Status field (editing only): cancel, or restore to upcoming. */
  onSubmit: (input: CalendarEventInput, step: StatusStep | null) => Promise<void>
}

export type StatusStep = { action: 'cancel'; reason: string } | { action: 'restore' }

/** The four statuses, in the order the Status field shows them. */
const STATUSES: { id: EffectiveStatus; label: string }[] = [
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'live', label: 'Live' },
  { id: 'ended', label: 'Ended' },
  { id: 'cancelled', label: 'Cancelled' },
]

interface FieldErrors {
  title?: string
  when?: string
  description?: string
  location?: string
}

/** Create and edit share this form; announcements and meetings differ only in their fields. */
export function EventForm({ type, event, day, timezone, canChangeVisibility, onCancel, onSubmit }: EventFormProps) {
  const isMeeting = type === 'meeting'
  const start = event ? wallParts(Date.parse(event.startsAt), timezone) : { date: day, time: isMeeting ? '10:00' : '09:00' }
  const end = event
    ? wallParts(Date.parse(event.endsAt), timezone)
    : { date: day, time: isMeeting ? '10:30' : '18:00' }

  const [title, setTitle] = useState(event?.title ?? '')
  const [startDate, setStartDate] = useState(start.date)
  const [startTime, setStartTime] = useState(start.time)
  const [endDate, setEndDate] = useState(end.date)
  const [endTime, setEndTime] = useState(end.time)
  const [description, setDescription] = useState(event?.description ?? '')
  const [location, setLocation] = useState(event?.location ?? '')
  const [visibility, setVisibility] = useState<'open' | 'private'>(event?.visibility ?? 'open')
  const [members, setMembers] = useState<CalendarPersonRef[]>(event?.members ?? [])
  const [errors, setErrors] = useState<FieldErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  // Editing only: the time decides upcoming / live / ended. An upcoming event can be
  // cancelled; a cancelled one whose start is still ahead can come back to upcoming.
  const currentStatus = event?.effectiveStatus ?? 'upcoming'
  const [targetStatus, setTargetStatus] = useState<EffectiveStatus>(currentStatus)
  const [cancelReason, setCancelReason] = useState('')
  const cancelling = currentStatus === 'upcoming' && targetStatus === 'cancelled'
  const restoring = currentStatus === 'cancelled' && targetStatus === 'upcoming'

  /** Moving the start keeps the length the same. */
  function moveStart(date: string, time: string) {
    const before = zonedInstant(startDate, startTime, timezone).getTime()
    const length = zonedInstant(endDate, endTime, timezone).getTime() - before
    setStartDate(date)
    setStartTime(time)
    if (date && time && length > 0) {
      const next = wallParts(zonedInstant(date, time, timezone).getTime() + length, timezone)
      setEndDate(next.date)
      setEndTime(next.time)
    }
  }

  async function submit() {
    const next: FieldErrors = {}
    if (!title.trim()) next.title = 'Give it a title'
    let startsAt: Date | null = null
    let minutes = 0
    if (!startDate || !startTime || !endDate || !endTime) next.when = 'Choose when it starts and ends'
    else {
      startsAt = zonedInstant(startDate, startTime, timezone)
      minutes = Math.round((zonedInstant(endDate, endTime, timezone).getTime() - startsAt.getTime()) / 60_000)
      if (minutes <= 0) next.when = 'It has to end after it starts'
      else if (minutes > MAX_MINUTES) next.when = 'An event can last at most 62 days'
    }
    if (!isMeeting && !description.trim()) next.description = 'Write the announcement'
    if (isMeeting && !location.trim()) next.location = 'Add a room, an address or a link'
    setErrors(next)
    if (Object.keys(next).length || !startsAt) return

    setSaving(true)
    setServerError(null)
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        startsAt: startsAt.toISOString(),
        durationMinutes: minutes,
        ...(isMeeting
          ? {
              location: location.trim(),
              visibility,
              // An open meeting has no invitee list; a private one keeps who was picked.
              memberIds: visibility === 'private' ? members.map((member) => member.id) : [],
            }
          : {}),
      }, cancelling ? { action: 'cancel', reason: cancelReason.trim() } : restoring ? { action: 'restore' } : null)
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

        {event && (
          <FormField
            label="Status"
            htmlFor="event-status"
            hint={
              cancelling
                ? `It stays on the calendar, marked cancelled. You can bring it back until its start time.`
                : restoring
                  ? `It goes back on the calendar as upcoming.`
                  : currentStatus === 'cancelled'
                    ? 'Cancelled. Pick Upcoming to bring it back; that works until its start time.'
                    : 'Upcoming, live and ended follow the time. You can cancel it.'
            }
          >
            <Select<EffectiveStatus>
              id="event-status"
              aria-label="Status"
              className="sm:max-w-64"
              value={targetStatus}
              disabled={saving}
              onChange={setTargetStatus}
              // The current status (to undo a change), and the one move from it:
              // upcoming ↔ cancelled. Live and ended follow the clock, so they're listed but disabled.
              options={STATUSES.map(({ id, label }) => ({
                value: id,
                label,
                meta: id === currentStatus ? 'now' : undefined,
                danger: id === 'cancelled' && currentStatus !== 'cancelled',
                disabled: !(
                  id === currentStatus ||
                  (currentStatus === 'upcoming' && id === 'cancelled') ||
                  (currentStatus === 'cancelled' && id === 'upcoming')
                ),
              }))}
            />
            {cancelling && (
              <input
                aria-label="Reason for cancelling (optional)"
                maxLength={1000}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Reason (optional)"
                className="field-input mt-2.5"
              />
            )}
          </FormField>
        )}

        <FormField label="Title" htmlFor="event-title" error={errors.title}>
          <input
            id="event-title"
            autoFocus={!event}
            maxLength={200}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-invalid={!!errors.title}
            placeholder={isMeeting ? 'Weekly design review' : 'Office closed for Diwali'}
            className="field-input"
          />
        </FormField>

        <FormField label="When" error={errors.when} hint={`Times are in ${timezone.replaceAll('_', ' ')}.`}>
          <div className="grid grid-cols-[2.75rem_1fr_7rem] items-center gap-x-2 gap-y-2">
            <span className="text-label text-ink-3">Starts</span>
            <input
              type="date"
              aria-label="Start date"
              value={startDate}
              onChange={(e) => moveStart(e.target.value, startTime)}
              className="field-input tabular-nums"
            />
            <input
              type="time"
              aria-label="Start time"
              value={startTime}
              onChange={(e) => moveStart(startDate, e.target.value)}
              className="field-input tabular-nums"
            />
            <span className="text-label text-ink-3">Ends</span>
            <input
              type="date"
              aria-label="End date"
              value={endDate}
              min={startDate}
              onChange={(e) => setEndDate(e.target.value)}
              aria-invalid={!!errors.when}
              className="field-input tabular-nums"
            />
            <input
              type="time"
              aria-label="End time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              aria-invalid={!!errors.when}
              className="field-input tabular-nums"
            />
          </div>
        </FormField>

        {isMeeting && (
          <>
            <FormField label="Where" htmlFor="event-location" error={errors.location}>
              <input
                id="event-location"
                maxLength={500}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                aria-invalid={!!errors.location}
                placeholder="Room, address or meeting link"
                className="field-input"
              />
            </FormField>

            <FormField
              label="Who can see it"
              hint={
                !canChangeVisibility
                  ? 'Only the person who created the meeting, or the owner, can change this.'
                  : visibility === 'open'
                    ? 'Everyone in the company can see it.'
                    : 'Only you and the people you invite can see it.'
              }
            >
              <div className="flex w-fit gap-1 rounded-xl bg-canvas p-1.5 shadow-well">
                {(['open', 'private'] as const).map((value) => (
                  <label
                    key={value}
                    className={`inline-flex h-8 min-w-[6.5rem] items-center justify-center rounded-lg px-5 text-label transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--focus)] ${
                      visibility === value ? 'btn btn-primary' : 'font-medium text-ink-2 hover:bg-surface-hover hover:text-ink'
                    } ${canChangeVisibility ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}
                  >
                    <input
                      type="radio"
                      name="event-visibility"
                      value={value}
                      checked={visibility === value}
                      disabled={!canChangeVisibility}
                      onChange={() => setVisibility(value)}
                      className="sr-only"
                    />
                    {value === 'open' ? 'Open' : 'Private'}
                  </label>
                ))}
              </div>
            </FormField>

            {/* Invitees only matter for a private meeting: an open one is visible to everyone. */}
            {visibility === 'private' && (
              <FormField
                label={`Invite${members.length ? ` (${members.length})` : ''}`}
                hint="Only people who can open the Calendar are listed. You're always included."
              >
                <PeoplePicker
                  selected={members}
                  onChange={setMembers}
                  excludeId={event?.createdBy ?? null}
                  disabled={saving}
                />
              </FormField>
            )}
          </>
        )}

        <FormField
          label={isMeeting ? 'Agenda (optional)' : 'Announcement'}
          htmlFor="event-description"
          error={errors.description}
        >
          <textarea
            id="event-description"
            rows={isMeeting ? 3 : 5}
            maxLength={5000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            aria-invalid={!!errors.description}
            placeholder={isMeeting ? 'What will you cover?' : 'What does everyone need to know?'}
            className="field-input h-auto min-h-20 resize-y py-2 leading-6"
          />
        </FormField>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-line bg-canvas/60 px-5 py-3.5">
        <Button variant="secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" variant={cancelling ? 'danger' : 'primary'} loading={saving}>
          {saving
            ? 'Saving…'
            : cancelling
              ? `Save and cancel ${TYPE_LABEL[type].toLowerCase()}`
              : restoring
                ? `Save and restore ${TYPE_LABEL[type].toLowerCase()}`
                : event
                ? 'Save changes'
                : isMeeting
                  ? 'Schedule meeting'
                  : 'Post announcement'}
        </Button>
      </div>
    </form>
  )
}
