/**
 * Wall-clock helpers for the company timezone (decision C5). Events are stored
 * as instants; the grid, the day panel and the form all read and write them
 * as dates and times in the company's zone, whatever the browser's zone is.
 */

const partsCache = new Map<string, Intl.DateTimeFormat>()
function partsFormat(timeZone: string) {
  let format = partsCache.get(timeZone)
  if (!format) {
    format = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
    partsCache.set(timeZone, format)
  }
  return format
}

/** The wall-clock parts of an instant in `timeZone`. */
export function wallParts(instant: Date | number, timeZone: string) {
  const parts = Object.fromEntries(
    partsFormat(timeZone)
      .formatToParts(instant)
      .map((part) => [part.type, part.value]),
  )
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
    seconds: Number(parts.second),
  }
}

/** `YYYY-MM-DD` of an instant in `timeZone`. */
export const dayIn = (instant: Date | number, timeZone: string) => wallParts(instant, timeZone).date

/** How far `timeZone` is ahead of UTC at `instant`, in ms. */
function offsetAt(instant: number, timeZone: string): number {
  const { date, time, seconds } = wallParts(instant, timeZone)
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  return Date.UTC(y, m - 1, d, hh, mm, seconds) - Math.floor(instant / 1000) * 1000
}

/** The instant a wall-clock `date` + `time` (HH:MM) happens in `timeZone`. */
export function zonedInstant(date: string, time: string, timeZone: string): Date {
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  const guess = Date.UTC(y, m - 1, d, hh, mm)
  // Two passes settle daylight-saving edges.
  let instant = guess - offsetAt(guess, timeZone)
  instant = guess - offsetAt(instant, timeZone)
  return new Date(instant)
}

/**
 * Every day (in `timeZone`) an event covers. An event ending exactly at
 * midnight doesn't spill into the next day.
 */
export function daysCovered(startsAt: string, endsAt: string, timeZone: string): string[] {
  const first = dayIn(Date.parse(startsAt), timeZone)
  const last = dayIn(Math.max(Date.parse(startsAt), Date.parse(endsAt) - 1), timeZone)
  const days: string[] = []
  for (let day = first; day <= last && days.length < 70; day = nextDay(day)) days.push(day)
  return days
}

function nextDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10)
}

const clockCache = new Map<string, Intl.DateTimeFormat>()
/** "10:30 am" in `timeZone`. */
export function formatClockIn(instant: string | Date, timeZone: string): string {
  let format = clockCache.get(timeZone)
  if (!format) {
    format = new Intl.DateTimeFormat(undefined, { timeZone, hour: 'numeric', minute: '2-digit' })
    clockCache.set(timeZone, format)
  }
  return format.format(new Date(instant))
}

const stampCache = new Map<string, Intl.DateTimeFormat>()
/** "Tue, 25 Nov, 10:30 am" in `timeZone`. */
export function formatStampIn(instant: string | Date, timeZone: string): string {
  let format = stampCache.get(timeZone)
  if (!format) {
    format = new Intl.DateTimeFormat(undefined, {
      timeZone,
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
    })
    stampCache.set(timeZone, format)
  }
  return format.format(new Date(instant))
}

/** "10:30 am – 11:15 am", or with dates when it spans days. */
export function formatSpan(startsAt: string, endsAt: string, timeZone: string): string {
  const sameDay = dayIn(Date.parse(startsAt), timeZone) === dayIn(Date.parse(endsAt) - 1, timeZone)
  return sameDay
    ? `${formatClockIn(startsAt, timeZone)} – ${formatClockIn(endsAt, timeZone)}`
    : `${formatStampIn(startsAt, timeZone)} – ${formatStampIn(endsAt, timeZone)}`
}
