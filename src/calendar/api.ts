import { keepPreviousData, queryOptions } from '@tanstack/react-query'
import { api } from '@/lib/api'

export type CalendarEventType = 'announcement' | 'meeting'
/** Derived from the time window on every read: upcoming, live, ended, or cancelled. */
export type EffectiveStatus = 'upcoming' | 'live' | 'ended' | 'cancelled'

export interface CalendarPersonRef {
  id: string
  fullName: string
}

export interface CalendarEvent {
  id: string
  type: CalendarEventType
  title: string
  description: string | null
  status: 'scheduled' | 'cancelled'
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
  permissions: { canEdit: boolean; canCancel: boolean; canRestore: boolean; canDelete: boolean }
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

/** People who can be invited (they can open the Calendar); server-side search. */
export const calendarPeopleQuery = (query: string) =>
  queryOptions({
    queryKey: [...CALENDAR_KEY, 'people', query],
    queryFn: () =>
      api<{ items: CalendarPerson[] }>(`/calendar/people?limit=20&q=${encodeURIComponent(query)}`).then((r) => r.items),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })

export const createCalendarEvent = (body: CalendarEventInput & { type: CalendarEventType }) =>
  api<CalendarEvent>('/calendar', { method: 'POST', body: JSON.stringify(body) })

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
}

export const STATUS_LABEL: Record<EffectiveStatus, string> = {
  upcoming: 'Upcoming',
  live: 'Live now',
  ended: 'Ended',
  cancelled: 'Cancelled',
}
