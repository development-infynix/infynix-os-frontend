/**
 * Report dates are plain `YYYY-MM-DD` days with no time or zone. Parse them as
 * local midnight, never with `new Date(value)`, which reads them as UTC and can
 * show the previous day.
 */
export function parseDay(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

const short = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
const long = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const stamp = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
})
const dayWithWeekday = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})
const weekday = new Intl.DateTimeFormat(undefined, { weekday: 'long' })
const clock = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })

/** "23 Nov 2026" */
export const formatDay = (value: string) => short.format(parseDay(value))
/** "Monday, 23 November 2026" */
export const formatDayLong = (value: string) => long.format(parseDay(value))
/** "Mon, 23 Nov 2026" */
export const formatDayWithWeekday = (value: string) => dayWithWeekday.format(parseDay(value))
/** The viewer's local `YYYY-MM-DD` for a timestamp. */
export function localDay(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
/** "Monday" */
export const formatWeekday = (value: string) => weekday.format(parseDay(value))
/** "23 Nov, 6:42 pm" in the viewer's time. */
export const formatStamp = (iso: string) => stamp.format(new Date(iso))
/** "6:42 pm" */
export const formatClock = (date: Date) => clock.format(date)

export const WEEKDAYS = [
  { value: 1, short: 'Mon', long: 'Monday' },
  { value: 2, short: 'Tue', long: 'Tuesday' },
  { value: 3, short: 'Wed', long: 'Wednesday' },
  { value: 4, short: 'Thu', long: 'Thursday' },
  { value: 5, short: 'Fri', long: 'Friday' },
  { value: 6, short: 'Sat', long: 'Saturday' },
  { value: 0, short: 'Sun', long: 'Sunday' },
] as const

export const weekdayOf = (value: string) => parseDay(value).getDay()

/** Until when the author may still edit or delete a report (the server has the final say). */
export const editableUntil = (submittedAt: string, windowMinutes: number) =>
  new Date(new Date(submittedAt).getTime() + windowMinutes * 60_000)
