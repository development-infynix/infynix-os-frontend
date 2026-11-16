const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
const dateOnly = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

/** "just now", "5 minutes ago", "yesterday", then a date after a week. */
export function timeAgo(iso: string | null): string {
  if (!iso) return 'Never'
  const seconds = Math.round((new Date(iso).getTime() - Date.now()) / 1000)
  const abs = Math.abs(seconds)
  if (abs < 45) return 'Just now'
  if (abs < 3600) return relative.format(Math.round(seconds / 60), 'minute')
  if (abs < 86_400) return relative.format(Math.round(seconds / 3600), 'hour')
  if (abs < 7 * 86_400) return relative.format(Math.round(seconds / 86_400), 'day')
  return dateOnly.format(new Date(iso))
}
