import { keepPreviousData, queryOptions } from '@tanstack/react-query'
import { api } from '@/lib/api'

export type CalendarEventType = 'announcement' | 'meeting' | 'task'
/** Announcements and meetings: derived from the time window on every read. */
export type TimeStatus = 'upcoming' | 'live' | 'ended' | 'cancelled'
/** Tasks: the workflow status (T1); failed and an ended hold follow the clock (T8). */
export type TaskStatus =
  | 'assigned'
  | 'progress'
  | 'on_review'
  | 'on_hold'
  | 'request_cancelation'
  | 'cancelled'
  | 'failed'
  | 'completed'
export type EffectiveStatus = TimeStatus | TaskStatus
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'

/** The workflow steps (backend `task-workflow.ts`). */
export type TaskAction =
  | 'start'
  | 'submit'
  | 'complete'
  | 'hold'
  | 'resume'
  | 'approve'
  | 'reject'
  | 'request_cancel'
  | 'approve_cancel'
  | 'decline_cancel'
  | 'withdraw_cancel'
  | 'cancel'
  | 'extend'
  | 'reopen'
  | 'request_extension'
  | 'approve_extension'
  | 'decline_extension'
  | 'withdraw_extension'
export type TaskField =
  | 'holdReason'
  | 'holdUntil'
  | 'cancelReason'
  | 'completionRemarks'
  | 'note'
  | 'deadline'
  | 'extensionUntil'
  | 'extensionReason'

/** A step the viewer may take now, with its inputs (the server decides). */
export interface AllowedTaskAction {
  action: TaskAction
  to: TaskStatus
  fields: Partial<Record<TaskField, 'required' | 'optional'>>
}

export interface CalendarPersonRef {
  id: string
  fullName: string
}

export interface CalendarEvent {
  id: string
  type: CalendarEventType
  title: string
  description: string | null
  /** Stored: scheduled | cancelled, or a task's TaskStatus. */
  status: 'scheduled' | 'cancelled' | TaskStatus
  effectiveStatus: EffectiveStatus
  startsAt: string
  endsAt: string
  /** Meeting only. */
  location: string | null
  visibility: 'open' | 'private' | null
  members: CalendarPersonRef[]
  isMember: boolean
  cancelReason: string | null
  version: number
  /** Null when the person who created it was deleted. */
  createdBy: string | null
  createdByName: string | null
  createdAt: string
  updatedAt: string
  permissions: {
    canEdit: boolean
    canCancel: boolean
    canRestore: boolean
    canDelete: boolean
    /** Task only: the steps the viewer may take. */
    actions: AllowedTaskAction[]
  }
  /* ---- Task only (endsAt is the deadline) ---- */
  assigneeId: string | null
  assigneeName: string | null
  priority: TaskPriority | null
  previousStatus: TaskStatus | null
  holdReason: string | null
  holdUntil: string | null
  completionRemarks: string | null
  rejectCount: number
  extensionUntil: string | null
  extensionReason: string | null
}

export interface CalendarContext {
  /** The company timezone days are grouped by. */
  timezone: string
  /** Today's `YYYY-MM-DD` in that zone. */
  today: string
}

export interface CalendarPerson {
  id: string
  fullName: string
  role: 'owner' | 'manager' | 'staff'
}

export interface CalendarEventInput {
  title: string
  description?: string
  startsAt: string
  durationMinutes: number
  location?: string
  visibility?: 'open' | 'private'
  memberIds?: string[]
}

export interface TaskInput {
  title: string
  description?: string
  deadline: string
  assigneeId: string
  priority: TaskPriority
}

/** Everything under Calendar: invalidate after any change. */
export const CALENDAR_KEY = ['calendar'] as const

export const calendarContextQuery = () =>
  queryOptions({
    queryKey: [...CALENDAR_KEY, 'context'],
    queryFn: () => api<CalendarContext>('/calendar/context'),
    staleTime: 5 * 60_000,
  })

/** Events overlapping [from, to) (ISO instants, at most 62 days apart). */
export const calendarRangeQuery = (from: string, to: string) =>
  queryOptions({
    queryKey: [...CALENDAR_KEY, 'range', from, to],
    queryFn: () =>
      api<{ items: CalendarEvent[]; truncated: boolean }>(
        `/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      ),
    placeholderData: keepPreviousData,
    // Statuses flip in the browser (lib/live-status); this only picks up other people's
    // changes. Kept rare so the free-tier database can sleep; returning to the tab refreshes too.
    refetchInterval: 5 * 60_000,
  })

export const calendarEventQuery = (id: string) =>
  queryOptions({
    queryKey: [...CALENDAR_KEY, 'one', id],
    queryFn: () => api<CalendarEvent>(`/calendar/${id}`),
    retry: false,
  })

/**
 * People who can open the Calendar; server-side search. `assign` narrows it to
 * whom the viewer may give a task (owner: anyone; manager: staff and self).
 */
export const calendarPeopleQuery = (query: string, purpose: 'invite' | 'assign' = 'invite') =>
  queryOptions({
    queryKey: [...CALENDAR_KEY, 'people', purpose, query],
    queryFn: () =>
      api<{ items: CalendarPerson[] }>(
        `/calendar/people?limit=20&for=${purpose}&q=${encodeURIComponent(query)}`,
      ).then((r) => r.items),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })

export const createCalendarEvent = (
  body: (CalendarEventInput & { type: 'announcement' | 'meeting' }) | (TaskInput & { type: 'task' }),
) => api<CalendarEvent>('/calendar', { method: 'POST', body: JSON.stringify(body) })

export const updateTask = (id: string, body: Partial<TaskInput> & { version: number }) =>
  api<CalendarEvent>(`/calendar/${id}`, { method: 'PATCH', body: JSON.stringify(body) })

/** One workflow step with its inputs. */
export const stepTask = (id: string, version: number, action: TaskAction, input: Partial<Record<TaskField, string>>) =>
  api<CalendarEvent>(`/calendar/${id}`, { method: 'PATCH', body: JSON.stringify({ version, action, ...input }) })

export const updateCalendarEvent = (id: string, body: Partial<CalendarEventInput> & { version: number }) =>
  api<CalendarEvent>(`/calendar/${id}`, { method: 'PATCH', body: JSON.stringify(body) })

export const cancelCalendarEvent = (id: string, version: number, reason?: string) =>
  api<CalendarEvent>(`/calendar/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ version, action: 'cancel', reason: reason || undefined }),
  })

/** Brings a cancelled event back to upcoming (only while its start is still ahead). */
export const restoreCalendarEvent = (id: string, version: number) =>
  api<CalendarEvent>(`/calendar/${id}`, { method: 'PATCH', body: JSON.stringify({ version, action: 'restore' }) })

export const deleteCalendarEvent = (id: string) => api<void>(`/calendar/${id}`, { method: 'DELETE' })

export const TYPE_LABEL: Record<CalendarEventType, string> = {
  announcement: 'Announcement',
  meeting: 'Meeting',
  task: 'Task',
}

export const STATUS_LABEL: Record<EffectiveStatus, string> = {
  upcoming: 'Upcoming',
  live: 'Live now',
  ended: 'Ended',
  cancelled: 'Cancelled',
  assigned: 'Assigned',
  progress: 'In progress',
  on_review: 'In review',
  on_hold: 'On hold',
  request_cancelation: 'Cancel requested',
  failed: 'Failed',
  completed: 'Completed',
}

export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
}
