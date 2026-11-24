import { useEffect, useState } from 'react'
import type { CalendarEvent, EffectiveStatus } from '../api'

/** setTimeout can't wait longer than this (about 24.8 days); re-arm after it. */
const MAX_DELAY = 2_147_483_647

/**
 * Upcoming → live → ended from the event's own times, the same rule the
 * server uses (decision C6). Cancelled always wins.
 */
export function statusAt(event: Pick<CalendarEvent, 'status' | 'startsAt' | 'endsAt'>, now: number): EffectiveStatus {
  if (event.status === 'cancelled') return 'cancelled'
  if (now < Date.parse(event.startsAt)) return 'upcoming'
  if (now < Date.parse(event.endsAt)) return 'live'
  return 'ended'
}

/**
 * The current time, re-rendering exactly when one of `events` starts or ends,
 * so statuses flip on the second without polling the server. One timer, armed
 * for the nearest upcoming boundary; nothing runs while nothing is due.
 */
export function useStatusClock(events: readonly Pick<CalendarEvent, 'status' | 'startsAt' | 'endsAt'>[] | undefined) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const current = Date.now()
    let next = Infinity
    for (const event of events ?? []) {
      // A cancelled event only matters at its start: after that it can't be restored.
      const edges =
        event.status === 'cancelled'
          ? [Date.parse(event.startsAt)]
          : [Date.parse(event.startsAt), Date.parse(event.endsAt)]
      for (const edge of edges) {
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
