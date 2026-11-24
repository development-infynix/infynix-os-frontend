import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight, Lock, MapPin, RefreshCw, X } from 'lucide-react'
import { FaCalendarTimes } from 'react-icons/fa'
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { Button } from '@/components/Button'
import { Loader } from '@/components/Loader'
import { MonthCalendar } from '@/components/MonthCalendar'
import { useSession } from '@/lib/auth'
import { addMonths, formatMonth, monthGrid, monthOf } from '@/lib/calendar'
import {
  CALENDAR_KEY,
  TYPE_LABEL,
  calendarContextQuery,
  calendarEventQuery,
  calendarRangeQuery,
  type CalendarEvent,
  type CalendarEventType,
} from '../api'
import { CalendarEmpty } from '../components/CalendarEmpty'
import { NewEventMenu } from '../components/NewEventMenu'
import { TYPE_ICON } from '../lib/type-icon'
import { EventDrawer, type EventDrawerState } from '../components/EventDrawer'
import { StatusTag } from '../components/StatusTag'
import { statusAt, useStatusClock } from '../lib/live-status'
import { dayIn, daysCovered, formatClockIn, formatSpan } from '../lib/zoned'

const route = getRouteApi('/_authed/calendar')

const longDay = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})
/** "Monday, 24 November 2026" for a plain `YYYY-MM-DD`. */
const formatDayLong = (day: string) => {
  const [y, m, d] = day.split('-').map(Number)
  return longDay.format(new Date(Date.UTC(y, m - 1, d)))
}

/** When an event sits in a day's list: a task at its deadline, the rest at their start. */
const sortKey = (event: CalendarEvent) => Date.parse(event.type === 'task' ? event.endsAt : event.startsAt)

/**
 * Calendar: the selected day's events on the left, the month on the right
 * (the ERP layout, D11). Announcements and meetings; days follow the company
 * timezone (C5); upcoming / live / ended are derived on read (C6).
 */
export function CalendarPage() {
  const { user } = useSession()
  /** C1: owners and managers post announcements; everyone schedules meetings and creates tasks (T4). */
  const creatable: CalendarEventType[] =
    user.role === 'owner' || user.role === 'manager' ? ['announcement', 'meeting', 'task'] : ['meeting', 'task']

  const queryClient = useQueryClient()
  const contextQuery = useQuery(calendarContextQuery())
  const context = contextQuery.data
  const search = route.useSearch()
  const navigate = route.useNavigate()

  const today = context?.today
  const date = search.date ?? today ?? null
  const month = search.month ?? (date ? monthOf(date) : null)

  const setSearch = (next: { month?: string; date?: string; event?: string | null }) =>
    void navigate({
      search: {
        month: next.month ?? month ?? undefined,
        date: next.date ?? date ?? undefined,
        event: (next.event === undefined ? search.event : next.event) ?? undefined,
      },
      replace: next.event === undefined,
    })
  const selectDay = (day: string) => setSearch({ date: day, month: monthOf(day) })

  // The six weeks on screen, with a day of slack each side: the server works in
  // instants and the grid in company days, so a little extra never misses one.
  const grid = month ? monthGrid(month) : null
  const range = useMemo(() => {
    if (!grid) return null
    const [y1, m1, d1] = grid[0].split('-').map(Number)
    const [y2, m2, d2] = grid[41].split('-').map(Number)
    return {
      from: new Date(Date.UTC(y1, m1 - 1, d1 - 1)).toISOString(),
      to: new Date(Date.UTC(y2, m2 - 1, d2 + 2)).toISOString(),
    }
  }, [grid?.[0], grid?.[41]]) // eslint-disable-line react-hooks/exhaustive-deps
  const rangeQuery = useQuery({ ...calendarRangeQuery(range?.from ?? '', range?.to ?? ''), enabled: !!range })
  // Statuses flip on the second in the browser (upcoming → live → ended), no polling.
  const now = useStatusClock(rangeQuery.data?.items)
  const events = useMemo(
    () => (rangeQuery.data?.items ?? []).map((event) => ({ ...event, effectiveStatus: statusAt(event, now) })),
    [rangeQuery.data, now],
  )

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    if (!context) return map
    for (const event of events) {
      // A task sits on its deadline day only (T8).
      const days =
        event.type === 'task'
          ? [dayIn(Date.parse(event.endsAt), context.timezone)]
          : daysCovered(event.startsAt, event.endsAt, context.timezone)
      for (const day of days) {
        const list = map.get(day)
        if (list) list.push(event)
        else map.set(day, [event])
      }
    }
    return map
  }, [events, context])

  // A task's steps depend on its status, and the server lists them. When the clock
  // moves a task on (failed at its deadline, a hold ending), reload once so the
  // steps match; meetings need no reload, their buttons follow the clock here.
  const serverItems = rangeQuery.data?.items
  const clockMovedTask = useMemo(
    () => (serverItems ?? []).some((e) => e.type === 'task' && statusAt(e, now) !== e.effectiveStatus),
    [serverItems, now],
  )
  useEffect(() => {
    if (clockMovedTask) void queryClient.invalidateQueries({ queryKey: CALENDAR_KEY })
  }, [clockMovedTask]) // eslint-disable-line react-hooks/exhaustive-deps

  // The open event comes from the URL, loaded by id so it stays fresh after an edit.
  const openId = search.event ?? null
  const openQuery = useQuery({ ...calendarEventQuery(openId ?? ''), enabled: !!openId })
  const listed = openId ? events.find((event) => event.id === openId) : undefined
  const fetched = openQuery.data ? { ...openQuery.data, effectiveStatus: statusAt(openQuery.data, now) } : undefined
  const openEvent = fetched ?? listed
  const [newType, setNewType] = useState<CalendarEventType | null>(null)
  /** Below lg: the selected day's events, in a drawer opened by tapping a day. */
  const [dayOpen, setDayOpen] = useState(false)
  // Widening to desktop puts the day's events back on the page: close the drawer.
  useEffect(() => {
    const wide = window.matchMedia('(min-width: 1024px)')
    const onChange = () => wide.matches && setDayOpen(false)
    wide.addEventListener('change', onChange)
    return () => wide.removeEventListener('change', onChange)
  }, [])
  // A link to an event that's gone or hidden just closes.
  useEffect(() => {
    if (openId && openQuery.isError) setSearch({ event: null })
  }, [openId, openQuery.isError]) // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the URL complete once "today" is known.
  useEffect(() => {
    if (today && (!search.date || !search.month)) setSearch({})
  }, [today]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!context || !date || !month) {
    return (
      <div className="grid flex-1 place-items-center py-24">
        {contextQuery.isError ? (
          <div className="text-center">
            <p className="text-body text-ink-2">Couldn’t load the calendar.</p>
            <Button size="sm" variant="secondary" className="mt-3" onClick={() => void contextQuery.refetch()}>
              Try again
            </Button>
          </div>
        ) : (
          <Loader label="Loading the calendar" />
        )}
      </div>
    )
  }

  const dayEvents = [...(byDay.get(date) ?? [])].sort(
    (a, b) => sortKey(a) - sortKey(b) || a.title.localeCompare(b.title),
  )
  // The day's events (or why there are none): the desktop panel and the phone drawer share it.
  const dayBody = rangeQuery.isPending ? (
    <div className="grid flex-1 place-items-center py-10">
      <Loader label="Loading events" />
    </div>
  ) : rangeQuery.isError ? (
    <div className="grid flex-1 place-items-center px-4 py-10 text-center">
      <div>
        <p className="text-body text-ink-2">Couldn’t load events.</p>
        <Button size="sm" variant="secondary" className="mt-3" onClick={() => void rangeQuery.refetch()}>
          Try again
        </Button>
      </div>
    </div>
  ) : dayEvents.length === 0 ? (
    <CalendarEmpty
      types={creatable}
      onCreate={(type) => {
        // On phones the day drawer closes so the new-event drawer has the screen.
        setDayOpen(false)
        setNewType(type)
      }}
    />
  ) : (
    <ul className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto overscroll-contain bg-canvas/40 p-3">
      {dayEvents.map((event) => (
        <li key={event.id}>
          <EventCard
            event={event}
            timezone={context.timezone}
            viewerId={user.id}
            onOpen={() => setSearch({ event: event.id })}
          />
        </li>
      ))}
    </ul>
  )

  // Pull everyone's latest changes now (a colleague's edit) instead of waiting for the timed refresh.
  const refreshing = rangeQuery.isFetching || openQuery.isFetching
  const refreshButton = (
    <Button
      variant="secondary"
      onClick={() => void queryClient.invalidateQueries({ queryKey: CALENDAR_KEY })}
      disabled={refreshing}
      aria-label="Refresh"
      title="Refresh"
      className="w-9 px-0!"
    >
      <RefreshCw size={16} strokeWidth={2} aria-hidden className={refreshing ? 'animate-spin' : ''} />
    </Button>
  )

  const drawerState: EventDrawerState = newType
    ? { kind: 'new', type: newType }
    : openEvent
      ? { kind: 'view', event: openEvent }
      : null

  return (
    <div className="flex w-full flex-col px-5 pt-5 pb-10 sm:min-h-0 sm:flex-1 sm:px-10 sm:py-8">
      <h1 className="sr-only">Calendar</h1>
      {/*
        Desktop (lg+): the day (New event above its panel) on the left, the month on the right.
        Below lg (ERP D11): one header row (month switcher left, Today and + right), the month,
        and tapping a day opens its events in a drawer.
      */}
      <div className="grid gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(19rem,23rem)_1fr] lg:grid-rows-[auto_1fr] lg:gap-x-6">
        <div className="hidden min-h-9 items-center justify-end gap-2 lg:col-start-1 lg:row-start-1 lg:flex">
          {refreshButton}
          <NewEventMenu types={creatable} onPick={setNewType} />
        </div>

        <div className="flex min-h-9 items-center justify-between gap-2 lg:col-start-2 lg:row-start-1 lg:justify-end">
          <div className="flex items-center gap-2 lg:order-2">
            <MonthSwitcher month={month} onChange={(next) => setSearch({ month: next })} />
          </div>
          <div className="flex items-center gap-2 lg:order-1">
            {(date !== context.today || month !== monthOf(context.today)) && (
              <Button variant="secondary" onClick={() => selectDay(context.today)}>
                Today
              </Button>
            )}
            <div className="flex items-center gap-2 lg:hidden">
              {refreshButton}
              <NewEventMenu types={creatable} onPick={setNewType} iconOnly />
            </div>
          </div>
        </div>

        <MonthCalendar
          month={month}
          selected={date}
          today={context.today}
          onSelect={(day) => {
            selectDay(day)
            // Below lg the day's events aren't on the page: picking a day (even the selected one) opens them.
            if (window.matchMedia('(max-width: 1023px)').matches) setDayOpen(true)
          }}
          busy={rangeQuery.isFetching}
          describeDay={(day) => {
            const count = byDay.get(day)?.length ?? 0
            return count ? `${count} ${count === 1 ? 'event' : 'events'}` : undefined
          }}
          renderDay={(day) => <DayMarks events={byDay.get(day) ?? []} />}
          className="lg:col-start-2 lg:row-start-2 lg:min-h-[30rem]"
        />

        <section
          aria-label={`Events on ${formatDayLong(date)}`}
          className="hidden min-h-72 flex-col overflow-hidden rounded-xl bg-surface shadow-lift lg:col-start-1 lg:row-start-2 lg:flex lg:min-h-0"
        >
          {/* Fixed header: the day stays put while its events scroll. */}
          <header className="flex shrink-0 items-baseline gap-3 border-b border-line bg-canvas/50 px-4 py-3">
            <h2 className="min-w-0 flex-1 truncate text-body font-semibold text-ink">{formatDayLong(date)}</h2>
            {dayEvents.length > 0 && (
              <p className="shrink-0 text-caption text-ink-3 tabular-nums">
                {dayEvents.length} {dayEvents.length === 1 ? 'event' : 'events'}
              </p>
            )}
          </header>
          {dayBody}
        </section>
      </div>

      <DayDrawer open={dayOpen} title={formatDayLong(date)} count={dayEvents.length} onClose={() => setDayOpen(false)}>
        {dayBody}
      </DayDrawer>

      <EventDrawer
        key={drawerState?.kind === 'view' ? drawerState.event.id : (drawerState?.kind ?? 'closed')}
        state={drawerState}
        day={date}
        timezone={context.timezone}
        now={now}
        viewer={{ id: user.id, fullName: user.fullName, role: user.role }}
        onClose={() => {
          setNewType(null)
          setSearch({ event: null })
        }}
        onCreated={(created) => {
          setNewType(null)
          // Jump to the day it starts on (a task: the day it's due), in the company's timezone.
          const startDay = dayIn(Date.parse(created.type === 'task' ? created.endsAt : created.startsAt), context.timezone)
          void navigate({ search: { month: monthOf(startDay), date: startDay, event: created.id } })
        }}
      />
    </div>
  )
}

/** A day dot's colour: green while something is happening, muted red when a task failed, ink while open, muted when done. */
function dotTone(status: CalendarEvent['effectiveStatus']) {
  if (status === 'live' || status === 'progress') return 'bg-secondary'
  if (status === 'failed') return 'bg-danger/75'
  if (status === 'ended' || status === 'cancelled' || status === 'completed') return 'bg-line-strong'
  return 'bg-ink-2'
}

/**
 * In the day cell's bottom-right corner: one dot per event, at most three, then
 * a "+" when there are more (tones from `dotTone`). The day panel carries the details.
 */
function DayMarks({ events }: { events: CalendarEvent[] }) {
  if (!events.length) return null
  return (
    // Pinned to the cell's bottom-right corner (the day button is positioned).
    <span aria-hidden className="absolute right-1.5 bottom-1.5 flex items-center gap-1 sm:right-2 sm:bottom-2">
      {events.slice(0, 3).map((event) => (
        <span
          key={event.id}
          className={`size-1.5 shrink-0 rounded-full ${dotTone(event.effectiveStatus)}`}
        />
      ))}
      {events.length > 3 && <span className="text-micro leading-none font-semibold text-ink-3">+</span>}
    </span>
  )
}

/** One event in the day panel; the whole card opens it. */
function EventCard({
  event,
  timezone,
  viewerId,
  onOpen,
}: {
  event: CalendarEvent
  timezone: string
  viewerId: string
  onOpen: () => void
}) {
  if (event.type === 'task') return <TaskCard task={event} timezone={timezone} viewerId={viewerId} onOpen={onOpen} />
  const Icon = TYPE_ICON[event.type]
  const cancelled = event.effectiveStatus === 'cancelled'
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-haspopup="dialog"
      aria-label={`${TYPE_LABEL[event.type]}: ${event.title}`}
      className="card-3d flex w-full flex-col rounded-xl p-3.5 text-left"
    >
      <div className="flex w-full items-center gap-2">
        <span className="inline-flex min-w-0 flex-1 items-center gap-1.5 text-caption text-ink-3">
          <Icon size={13} strokeWidth={2} aria-hidden className="shrink-0" />
          {TYPE_LABEL[event.type]}
          {event.visibility === 'private' && (
            <Lock size={12} strokeWidth={2} aria-label="Private" className="shrink-0" />
          )}
        </span>
        <StatusTag status={event.effectiveStatus} />
      </div>
      <p
        className={`mt-1.5 line-clamp-2 w-full text-body font-semibold break-words ${cancelled ? 'text-ink-3 line-through' : 'text-ink'}`}
      >
        {event.title}
      </p>
      <p className="mt-1 text-label text-ink-2 tabular-nums">{formatSpan(event.startsAt, event.endsAt, timezone)}</p>
      {event.location && (
        <p className="mt-0.5 flex w-full min-w-0 items-center gap-1.5 text-label text-ink-3">
          <MapPin size={13} strokeWidth={1.9} aria-hidden className="shrink-0" />
          <span className="truncate">{event.location}</span>
        </p>
      )}
      <p className="mt-2 w-full truncate text-caption text-ink-3">
        {event.type === 'meeting' ? 'Host' : 'Posted by'}: {event.createdByName ?? 'Deleted user'}
        {event.visibility === 'private' && event.members.length > 0 && ` · ${event.members.length} invited`}
      </p>
    </button>
  )
}

/**
 * A task in the day panel: due time and the other person: who it's for, or who it's from when it's yours to do.
 */
function TaskCard({
  task,
  timezone,
  viewerId,
  onOpen,
}: {
  task: CalendarEvent
  timezone: string
  viewerId: string
  onOpen: () => void
}) {
  const Icon = TYPE_ICON.task
  const status = task.effectiveStatus
  const finished = status === 'cancelled' || status === 'completed'
  const mine = task.assigneeId === viewerId
  const self = task.assigneeId !== null && task.assigneeId === task.createdBy
  const who = self
    ? mine
      ? 'For you'
      : `For ${task.assigneeName}`
    : mine
      ? `From ${task.createdByName ?? 'Deleted user'}`
      : `For ${task.assigneeName ?? 'Deleted user'}`
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-haspopup="dialog"
      aria-label={`Task: ${task.title}`}
      className="card-3d flex w-full flex-col rounded-xl p-3.5 text-left"
    >
      <div className="flex w-full items-center gap-2">
        <span className="inline-flex min-w-0 flex-1 items-center gap-1.5 text-caption text-ink-3">
          <Icon size={13} strokeWidth={2} aria-hidden className="shrink-0" />
          Task
        </span>
        <StatusTag status={status} rejectCount={task.rejectCount} />
      </div>
      <p
        className={`mt-1.5 line-clamp-2 w-full text-body font-semibold break-words ${finished ? 'text-ink-3' : 'text-ink'} ${status === 'cancelled' ? 'line-through' : ''}`}
      >
        {task.title}
      </p>
      <p
        className={`mt-1 flex items-center gap-1.5 text-label tabular-nums ${status === 'failed' ? 'text-danger/75' : 'text-ink-2'}`}
      >
        <FaCalendarTimes size={12} aria-hidden className="shrink-0" />
        Due {formatClockIn(task.endsAt, timezone)}
      </p>
      <p className="mt-2 w-full truncate text-caption text-ink-3">
        {who}
        {task.extensionUntil && ' · more time asked'}
      </p>
    </button>
  )
}

/** ‹ November 2026 › as one segmented chip, like the pagination control. */
function MonthSwitcher({ month, onChange }: { month: string; onChange: (month: string) => void }) {
  const step =
    'flex h-full w-9 items-center justify-center text-ink-2 transition-colors hover:bg-surface-hover hover:text-ink'
  return (
    <div className="btn btn-secondary h-9 gap-0 overflow-hidden p-0 hover:filter-none">
      <button type="button" onClick={() => onChange(addMonths(month, -1))} aria-label="Previous month" className={step}>
        <ChevronLeft size={16} strokeWidth={2} aria-hidden />
      </button>
      <span aria-hidden className="h-4 w-px shrink-0 bg-line-strong" />
      <span aria-live="polite" className="min-w-[8.5rem] px-3 text-center text-body font-semibold text-ink tabular-nums">
        {formatMonth(month)}
      </span>
      <span aria-hidden className="h-4 w-px shrink-0 bg-line-strong" />
      <button type="button" onClick={() => onChange(addMonths(month, 1))} aria-label="Next month" className={step}>
        <ChevronRight size={16} strokeWidth={2} aria-hidden />
      </button>
    </div>
  )
}

/**
 * Below lg (ERP D11): the selected day's events as a right-side drawer, opened
 * by tapping a day. Its header names it "Events" with the date under it; an
 * event opened from here slides in over it and closing that comes back here.
 */
function DayDrawer({
  open,
  title,
  count,
  onClose,
  children,
}: {
  open: boolean
  title: string
  count: number
  onClose: () => void
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    else if (!open && dialog.open) dialog.close()
  }, [open])

  return (
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
      className="app-drawer w-full max-w-sheet border-0 bg-surface p-0 text-ink shadow-dialog outline-none"
    >
      {open && (
        <div className="flex h-full flex-col">
          <div className="flex items-center gap-2 border-b border-line px-4 py-3">
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="text-body leading-5 font-semibold text-ink">
                Events
              </h2>
              <p className="truncate text-caption leading-4 text-ink-3 tabular-nums">
                {title}
                {count > 0 && ` · ${count} ${count === 1 ? 'event' : 'events'}`}
              </p>
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
          <div className="flex min-h-0 flex-1 flex-col bg-canvas">{children}</div>
        </div>
      )}
    </dialog>
  )
}
