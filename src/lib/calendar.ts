/**
 * Plain-day maths for month views. Days are `YYYY-MM-DD` strings and months
 * `YYYY-MM`, with no time or zone, so nothing shifts across timezones.
 */

export const toIsoDay = (year: number, monthIndex: number, day: number) =>
  `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

function parts(day: string) {
  const [year, month, date] = day.split('-').map(Number)
  return { year, monthIndex: month - 1, date }
}

/** `day` moved by `n` days. */
export function addDays(day: string, n: number): string {
  const { year, monthIndex, date } = parts(day)
  const d = new Date(Date.UTC(year, monthIndex, date + n))
  return toIsoDay(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

/** `YYYY-MM` of a day. */
export const monthOf = (day: string) => day.slice(0, 7)

/**
 * `day`'s date in `month`: the same day number, clamped to that month's last
 * day, so 31 Jan → 28 Feb. Switching months carries the selected day along.
 */
export function dateInMonth(day: string, month: string): string {
  const { date } = parts(day)
  const [year, m] = month.split('-').map(Number)
  const lastDay = new Date(Date.UTC(year, m, 0)).getUTCDate()
  return toIsoDay(year, m - 1, Math.min(date, lastDay))
}

/** `month` moved by `n` months. */
export function addMonths(month: string, n: number): string {
  const [year, m] = month.split('-').map(Number)
  const d = new Date(Date.UTC(year, m - 1 + n, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

/** 0 = Sunday … 6 = Saturday. */
export const weekdayOfDay = (day: string) => {
  const { year, monthIndex, date } = parts(day)
  return new Date(Date.UTC(year, monthIndex, date)).getUTCDay()
}

/** The 42 days (six Sunday-first weeks) a month view shows. */
export function monthGrid(month: string): string[] {
  const first = `${month}-01`
  const start = addDays(first, -weekdayOfDay(first))
  return Array.from({ length: 42 }, (_, i) => addDays(start, i))
}

const monthLabelFormat = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' })
/** "November 2026" */
export function formatMonth(month: string): string {
  const [year, m] = month.split('-').map(Number)
  return monthLabelFormat.format(new Date(Date.UTC(year, m - 1, 1)))
}

const weekdayFormat = new Intl.DateTimeFormat(undefined, { weekday: 'short', timeZone: 'UTC' })
/** Sun … Sat in the viewer's language, Sunday first. */
export const WEEKDAY_SHORT = Array.from({ length: 7 }, (_, i) =>
  weekdayFormat.format(new Date(Date.UTC(2026, 10, 1 + i))),
)
