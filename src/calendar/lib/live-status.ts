import { useEffect, useState } from 'react'
import type { CalendarEvent, EffectiveStatus, TaskStatus } from '../api'

/** setTimeout can't wait longer than this (about 24.8 days); re-arm after it. */
const MAX_DELAY = 2_147_483_647

type Clocked = Pick<CalendarEvent, 'type' | 'status' | 'startsAt' | 'endsAt' | 'previousStatus' | 'holdUntil'>

/** Only these fail when the deadline passes (backend FAILABLE_TASK_STATUSES). */
const FAILABLE: readonly TaskStatus[] = ['assigned', 'progress']

/**
 * A task's status now (decision T8), the same rule as the backend's
 * `taskStatusAt`: a hold past its end is back to its previous status; an
 * assigned or in-progress task past its deadline is failed.
 */
export function taskStatusAt(task: Clocked, now: number): TaskStatus {
  let status = task.status as TaskStatus
  if (status === 'on_hold' && task.holdUntil && Date.parse(task.holdUntil) <= now) {
    status = task.previousStatus ?? 'assigned'
  }
  if (FAILABLE.includes(status) && Date.parse(task.endsAt) <= now) return 'failed'
  return status
}

/**
 * The status right now, the same rule the server uses: tasks by their
 * workflow and deadline (T8); announcements and meetings upcoming → live →
 * ended from their own times (C6), cancelled always winning.
 */
export function statusAt(event: Clocked, now: number): EffectiveStatus {
  if (event.type === 'task') return taskStatusAt(event, now)
  if (event.status === 'cancelled') return 'cancelled'
  if (now < Date.parse(event.startsAt)) return 'upcoming'
  if (now < Date.parse(event.endsAt)) return 'live'
  return 'ended'
}

/** The instants at which an event's status can change by itself. */
function edgesOf(event: Clocked): number[] {
  if (event.type === 'task') {
    const edges = [Date.parse(event.endsAt)]
    if (event.status === 'on_hold' && event.holdUntil) edges.push(Date.parse(event.holdUntil))
    return edges
  }
  // A cancelled event only matters at its start: after that it can't be restored.
  return event.status === 'cancelled'
    ? [Date.parse(event.startsAt)]
    : [Date.parse(event.startsAt), Date.parse(event.endsAt)]
}

/**
 * The current time, re-rendering exactly when one of `events` changes status
 * by the clock (a start, an end, a deadline, a hold ending), so statuses flip
 * on the second without polling the server. One timer, armed for the nearest
 * boundary; nothing runs while nothing is due.
 */
export function useStatusClock(events: readonly Clocked[] | undefined) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const current = Date.now()
    let next = Infinity
    for (const event of events ?? []) {
      for (const edge of edgesOf(event)) {
        if (edge > current && edge < next) next = edge
      }
    }
    if (next === Infinity) return
    // A few ms past the boundary, so the comparison has clearly flipped.
    const timer = setTimeout(() => setNow(Date.now()), Math.min(next - current + 25, MAX_DELAY))
    return () => clearTimeout(timer)
  }, [events, now])

  // A device that slept (laptop lid) may have missed a boundary: re-check on return.
  useEffect(() => {
    const onVisible = () => document.visibilityState === 'visible' && setNow(Date.now())
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  return now
}
