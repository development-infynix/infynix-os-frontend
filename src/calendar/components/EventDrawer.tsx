import { useQueryClient } from '@tanstack/react-query'
import { ArrowUpRight, Ban, Check, Copy, Lock, Pencil, Trash2, X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { AlertDialog } from '@/components/Alert'
import { Button } from '@/components/Button'
import { Detail, Muted, Panel } from '@/components/DetailPanel'
import { ApiError } from '@/lib/api'
import {
  CALENDAR_KEY,
  PRIORITY_LABEL,
  TYPE_LABEL,
  cancelCalendarEvent,
  createCalendarEvent,
  deleteCalendarEvent,
  restoreCalendarEvent,
  updateCalendarEvent,
  updateTask,
  type CalendarEvent,
  type CalendarEventInput,
  type CalendarEventType,
  type TaskInput,
} from '../api'
import { formatStampIn } from '../lib/zoned'
import { EventForm, type StatusStep } from './EventForm'
import { StatusTag } from './StatusTag'
import { TaskForm, type TaskViewer } from './TaskForm'
import { TaskSteps } from './TaskSteps'

/** What the drawer shows: a new event of a type, or one event (view, then edit). */
export type EventDrawerState = { kind: 'new'; type: CalendarEventType } | { kind: 'view'; event: CalendarEvent } | null

interface EventDrawerProps {
  state: EventDrawerState
  day: string
  timezone: string
  /** The page's live clock (lib/live-status), so the buttons change on time. */
  now: number
  /** Who is looking: task forms narrow the assignee to what they may pick. */
  viewer: TaskViewer
  onClose: () => void
  /** A new event was saved: show it. */
  onCreated: (event: CalendarEvent) => void
}

/** Only what changed goes to the server, so the log records real edits. */
function diff(event: CalendarEvent, input: CalendarEventInput): Partial<CalendarEventInput> {
  const changes: Partial<CalendarEventInput> = {}
  if (input.title !== event.title) changes.title = input.title
  if ((input.description ?? '') !== (event.description ?? '')) changes.description = input.description
  const minutes = Math.round((Date.parse(event.endsAt) - Date.parse(event.startsAt)) / 60_000)
  if (Date.parse(input.startsAt) !== Date.parse(event.startsAt) || input.durationMinutes !== minutes) {
    changes.startsAt = input.startsAt
    changes.durationMinutes = input.durationMinutes
  }
  if (event.type === 'meeting') {
    if (input.location !== event.location) changes.location = input.location
    if (input.visibility !== event.visibility) changes.visibility = input.visibility
    const before = event.members.map((m) => m.id).sort().join()
    const after = [...(input.memberIds ?? [])].sort().join()
    if (before !== after) changes.memberIds = input.memberIds
  }
  return changes
}

/** A task edit sends only what changed (reassigning or moving the deadline has effects). */
function taskDiff(event: CalendarEvent, input: TaskInput): Partial<TaskInput> {
  const changes: Partial<TaskInput> = {}
  if (input.title !== event.title) changes.title = input.title
  if ((input.description ?? '') !== (event.description ?? '')) changes.description = input.description
  if (Date.parse(input.deadline) !== Date.parse(event.endsAt)) changes.deadline = input.deadline
  if (input.assigneeId !== event.assigneeId) changes.assigneeId = input.assigneeId
  if (input.priority !== event.priority) changes.priority = input.priority
  return changes
}

export function EventDrawer({ state, day, timezone, now, viewer, onClose, onCreated }: EventDrawerProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const queryClient = useQueryClient()
  const event = state?.kind === 'view' ? state.event : null
  const [editing, setEditing] = useState(state?.kind === 'new')
  const [confirm, setConfirm] = useState<'delete' | 'cancel' | null>(null)
  const [cancelReason, setCancelReason] = useState('')

  const open = state !== null
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      dialog.focus()
    } else if (!open && dialog.open) dialog.close()
  }, [open])

  const refresh = () => queryClient.invalidateQueries({ queryKey: CALENDAR_KEY })
  // The live status (lib/live-status) moves on while the drawer is open, so the
  // buttons follow it without waiting for the server (which checks again):
  // upcoming → edit + delete; live → nothing; ended → delete;
  // cancelled → delete, plus edit (and restore) until its start time.
  const status = event?.effectiveStatus
  const beforeStart = !!event && now < Date.parse(event.startsAt)
  const isTask = event?.type === 'task'
  // Tasks: the server's permissions (the page reloads them when the clock moves a task on).
  const canEdit = isTask
    ? !!event?.permissions.canEdit
    : !!event?.permissions.canEdit && (status === 'upcoming' || (status === 'cancelled' && beforeStart))
  const canDelete = isTask ? !!event?.permissions.canDelete : !!event?.permissions.canDelete && status !== 'live'
  // A live event can only be cancelled, and that's final (its start has passed).
  const canCancelLive = !!event?.permissions.canCancel && status === 'live'
  const type = state?.kind === 'new' ? state.type : (event?.type ?? 'meeting')
  const title = state?.kind === 'new' ? `New ${TYPE_LABEL[type].toLowerCase()}` : (event?.title ?? '')

  async function submitTask(input: TaskInput) {
    if (event) {
      const changes = taskDiff(event, input)
      if (Object.keys(changes).length) {
        try {
          await updateTask(event.id, { version: event.version, ...changes })
        } catch (cause) {
          if (cause instanceof ApiError && cause.status === 409) await refresh()
          throw cause
        }
      }
      await refresh()
      setEditing(false)
    } else {
      const created = await createCalendarEvent({ type: 'task', ...input })
      await refresh()
      onCreated(created)
    }
  }

  async function submit(input: CalendarEventInput, step: StatusStep | null) {
    if (event) {
      const changes = diff(event, input)
      let version = event.version
      try {
        // Edits first, then the status step, each against the version the last step left.
        if (Object.keys(changes).length) {
          version = (await updateCalendarEvent(event.id, { version, ...changes })).version
        }
        if (step?.action === 'cancel') await cancelCalendarEvent(event.id, version, step.reason)
        if (step?.action === 'restore') await restoreCalendarEvent(event.id, version)
      } catch (cause) {
        // Someone else saved first: load their version so the next save starts from it.
        if (cause instanceof ApiError && cause.status === 409) await refresh()
        throw cause
      }
      await refresh()
      setEditing(false)
    } else {
      const created = await createCalendarEvent({ type: type === 'announcement' ? 'announcement' : 'meeting', ...input })
      await refresh()
      onCreated(created)
    }
  }

  return (
    <>
      <dialog
        ref={ref}
        aria-labelledby={titleId}
        onCancel={(e) => {
          if (e.target !== e.currentTarget) return
          e.preventDefault()
          onClose()
        }}
        onKeyDown={(e) => e.key === 'Escape' && e.stopPropagation()}
        onClick={(e) => e.target === e.currentTarget && onClose()}
        tabIndex={-1}
        className="app-drawer w-full max-w-sheet border-0 bg-surface p-0 text-ink shadow-dialog outline-none"
      >
        {state && (
          <div className="flex h-full flex-col">
            <div className="flex items-center gap-2 border-b border-line px-4 py-3.5">
              <div className="min-w-0 flex-1">
                <p className="text-caption text-ink-3">
                  {editing && event ? `Edit ${TYPE_LABEL[type].toLowerCase()}` : TYPE_LABEL[type]}
                </p>
                <h2 id={titleId} className="truncate text-title font-semibold tracking-title">
                  {title}
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="grid size-9 shrink-0 place-items-center rounded-md text-ink-3 hover:bg-surface-hover hover:text-ink"
              >
                <X size={18} strokeWidth={1.9} />
              </button>
            </div>

            {editing && type === 'task' ? (
              <TaskForm
                event={event}
                day={day}
                timezone={timezone}
                viewer={viewer}
                onCancel={() => (event ? setEditing(false) : onClose())}
                onSubmit={submitTask}
              />
            ) : editing ? (
              <EventForm
                type={type}
                event={event}
                day={day}
                timezone={timezone}
                // Whoever may edit (the creator or the owner) may also change who sees it.
                canChangeVisibility={!event || event.permissions.canEdit}
                onCancel={() => (event ? setEditing(false) : onClose())}
                onSubmit={submit}
              />
            ) : event ? (
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto bg-canvas px-4 py-4 [&>*]:shrink-0">
                  {isTask ? (
                    <>
                      <TaskSteps event={event} timezone={timezone} now={now} onChanged={refresh} />
                      <TaskDetails event={event} timezone={timezone} viewerId={viewer.id} />
                    </>
                  ) : (
                  <Panel title="Details">
                    <Detail label="Status">
                      <StatusTag status={event.effectiveStatus} />
                    </Detail>
                    <Detail label="From">
                      <span className="tabular-nums">{formatStampIn(event.startsAt, timezone)}</span>
                    </Detail>
                    <Detail label="Till">
                      <span className="tabular-nums">{formatStampIn(event.endsAt, timezone)}</span>
                    </Detail>
                    {event.type === 'meeting' && (
                      <>
                        <Detail label="Where">
                          {/^https?:\/\//i.test(event.location ?? '') ? (
                            <LocationLink url={event.location ?? ''} />
                          ) : (
                            <span className="break-words">{event.location}</span>
                          )}
                        </Detail>
                        <Detail label="Visibility">
                          {event.visibility === 'private' ? (
                            <span className="inline-flex items-center gap-1.5">
                              <Lock size={13} strokeWidth={2} aria-hidden className="text-ink-3" />
                              Private
                            </span>
                          ) : (
                            'Open to everyone'
                          )}
                        </Detail>
                      </>
                    )}
                    <Detail label={event.type === 'meeting' ? 'Host' : 'Posted by'}>
                      {event.createdByName ?? <Muted>Deleted user</Muted>}
                    </Detail>
                    {event.type === 'meeting' && event.visibility === 'private' && (
                      <Detail label="Invited">
                        {event.members.length ? (
                          event.members.map((member) => member.fullName).join(', ')
                        ) : (
                          <Muted>No one else</Muted>
                        )}
                      </Detail>
                    )}
                    {event.cancelReason && <Detail label="Why cancelled">{event.cancelReason}</Detail>}
                  </Panel>
                  )}

                  {event.description && (
                    <Panel
                      title={event.type === 'meeting' ? 'Agenda' : event.type === 'task' ? 'Details' : 'Announcement'}
                      plain
                    >
                      <p className="px-3.5 py-3 text-body leading-6 break-words whitespace-pre-wrap text-ink">
                        {event.description}
                      </p>
                    </Panel>
                  )}
                </div>

                {(canEdit || canDelete || canCancelLive) && (
                  <div className="flex items-center justify-end gap-2 border-t border-line bg-canvas/60 px-5 py-3.5">
                    {canCancelLive && (
                      <Button variant="secondary" onClick={() => setConfirm('cancel')} className="text-danger">
                        <Ban size={15} strokeWidth={2} aria-hidden />
                        Cancel {TYPE_LABEL[event.type].toLowerCase()}
                      </Button>
                    )}
                    {canEdit && (
                      <Button variant="primary" onClick={() => setEditing(true)}>
                        <Pencil size={15} strokeWidth={2} aria-hidden />
                        Edit
                      </Button>
                    )}
                    {/* Delete sits at the far right. */}
                    {canDelete && (
                      <Button variant="secondary" onClick={() => setConfirm('delete')} className="text-danger">
                        <Trash2 size={15} strokeWidth={2} aria-hidden />
                        Delete
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}
      </dialog>

      <AlertDialog
        open={confirm === 'cancel'}
        onOpenChange={(next) => {
          if (!next) {
            setConfirm(null)
            setCancelReason('')
          }
        }}
        tone="danger"
        icon={null}
        title={`Cancel this ${event ? TYPE_LABEL[event.type].toLowerCase() : 'event'} now?`}
        description={
          <div>
            <p>
              It’s already live, so this is final: it can’t be brought back afterwards. It stays on the calendar, marked
              cancelled, and can then only be deleted.
            </p>
            <label className="mt-3 block text-label font-medium text-ink-2" htmlFor="live-cancel-reason">
              Reason (optional)
            </label>
            <input
              id="live-cancel-reason"
              maxLength={1000}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="field-input mt-1.5"
            />
          </div>
        }
        confirmLabel={`Cancel ${event ? TYPE_LABEL[event.type].toLowerCase() : 'event'}`}
        cancelLabel="Keep it"
        pendingLabel="Cancelling…"
        onConfirm={async () => {
          if (!event) return
          await cancelCalendarEvent(event.id, event.version, cancelReason.trim())
          await refresh()
          setCancelReason('')
        }}
      />
      <AlertDialog
        open={confirm === 'delete'}
        onOpenChange={(next) => !next && setConfirm(null)}
        tone="danger"
        icon={null}
        width="compact"
        title={`Delete this ${event ? TYPE_LABEL[event.type].toLowerCase() : 'event'}?`}
        description={
          isTask
            ? 'It disappears for its creator and the person doing it. This can’t be undone.'
            : 'It disappears from everyone’s calendar. This can’t be undone.'
        }
        confirmLabel="Delete"
        pendingLabel="Deleting…"
        onConfirm={async () => {
          if (!event) return
          await deleteCalendarEvent(event.id)
          await refresh()
          onClose()
        }}
      />
    </>
  )
}


/** A task's facts: who, when it's due, and whatever its workflow is holding (a hold, a request, notes). */
function TaskDetails({ event, timezone, viewerId }: { event: CalendarEvent; timezone: string; viewerId: string }) {
  const status = event.effectiveStatus
  const person = (id: string | null, name: string | null) =>
    name ? (id === viewerId ? `${name} (you)` : name) : <Muted>Deleted user</Muted>
  return (
    <Panel title="Details">
      <Detail label="Status">
        <StatusTag status={status} rejectCount={event.rejectCount} />
      </Detail>
      <Detail label="Due">
        <span className={`tabular-nums ${status === 'failed' ? 'font-medium text-danger/75' : ''}`}>
          {formatStampIn(event.endsAt, timezone)}
        </span>
      </Detail>
      <Detail label="Priority">
        <span className={event.priority === 'urgent' ? 'font-medium text-danger/75' : ''}>
          {PRIORITY_LABEL[event.priority ?? 'medium']}
        </span>
      </Detail>
      <Detail label="Assigned to">{person(event.assigneeId, event.assigneeName)}</Detail>
      <Detail label="Created by">{person(event.createdBy, event.createdByName)}</Detail>
      {status === 'on_hold' && event.holdUntil && (
        <Detail label="On hold until">
          <span className="tabular-nums">{formatStampIn(event.holdUntil, timezone)}</span>
          {event.holdReason && <span className="mt-0.5 block text-ink-2">{event.holdReason}</span>}
        </Detail>
      )}
      {event.extensionUntil && (
        <Detail label="More time asked">
          <span className="tabular-nums">Until {formatStampIn(event.extensionUntil, timezone)}</span>
          {event.extensionReason && <span className="mt-0.5 block text-ink-2">{event.extensionReason}</span>}
        </Detail>
      )}
      {event.cancelReason && (status === 'request_cancelation' || status === 'cancelled') && (
        <Detail label={status === 'cancelled' ? 'Why cancelled' : 'Why cancel'}>{event.cancelReason}</Detail>
      )}
      {event.rejectCount > 0 && status !== 'completed' && (
        <Detail label="Sent back">
          <span className="tabular-nums">
            {event.rejectCount} {event.rejectCount === 1 ? 'time' : 'times'}
          </span>
        </Detail>
      )}
      {event.completionRemarks && <Detail label="Completion notes">{event.completionRemarks}</Detail>}
    </Panel>
  )
}

/** A meeting link with Copy (✓ once copied) and Open (new tab) beside it. */
function LocationLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 1500)
    return () => clearTimeout(timer)
  }, [copied])
  const iconButton =
    'grid size-7 shrink-0 place-items-center rounded-md text-ink-3 transition-colors hover:bg-surface-hover hover:text-ink'

  return (
    <span className="flex items-start gap-1.5">
      <a
        href={url}
        target="_blank"
        rel="noreferrer noopener"
        className="min-w-0 flex-1 pt-0.5 font-medium break-all text-secondary-text underline-offset-2 hover:underline"
      >
        {url}
      </a>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard?.writeText(url).then(() => setCopied(true))
        }}
        aria-label={copied ? 'Link copied' : 'Copy link'}
        title={copied ? 'Copied' : 'Copy link'}
        className={iconButton}
      >
        {copied ? (
          <Check size={14} strokeWidth={2.2} aria-hidden className="text-secondary-text" />
        ) : (
          <Copy size={14} strokeWidth={2} aria-hidden />
        )}
      </button>
      <a
        href={url}
        target="_blank"
        rel="noreferrer noopener"
        aria-label="Open link in a new tab"
        title="Open link"
        className={iconButton}
      >
        <ArrowUpRight size={15} strokeWidth={2} aria-hidden />
      </a>
      <span role="status" className="sr-only">
        {copied ? 'Link copied' : ''}
      </span>
    </span>
  )
}
