import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { WEEKDAY_SHORT, addDays, formatMonth, monthGrid, monthOf } from '@/lib/calendar'

const longDay = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})
const labelOf = (day: string) => {
  const [y, m, d] = day.split('-').map(Number)
  return longDay.format(new Date(Date.UTC(y, m - 1, d)))
}

export interface MonthCalendarProps {
  /** `YYYY-MM` being shown. */
  month: string
  /** The selected `YYYY-MM-DD`. */
  selected: string
  /** Today's `YYYY-MM-DD` (the company's today, not necessarily the browser's). */
  today: string
  onSelect: (day: string) => void
  /** What a day cell shows under its number (counts, dots…). */
  renderDay?: (day: string) => ReactNode
  /** Extra screen-reader text for a day, e.g. "3 reports, 1 late". */
  describeDay?: (day: string) => string | undefined
  /** Days shown muted, e.g. off days. */
  isMuted?: (day: string) => boolean
  /** While the month's data loads. */
  busy?: boolean
  className?: string
}

/**
 * A Sunday-first month grid on a paper panel. One cell per day, six weeks
 * always, so the grid never jumps between months. The selected day takes the
 * green wash and today a solid green number tile; arrow keys move the
 * selection (roving focus), Home/End jump within the week.
 */
export function MonthCalendar({
  month,
  selected,
  today,
  onSelect,
  renderDay,
  describeDay,
  isMuted,
  busy = false,
  className = '',
}: MonthCalendarProps) {
  const days = monthGrid(month)
  const cells = useRef(new Map<string, HTMLButtonElement>())
  const keyboardMove = useRef(false)

  // After a keyboard move, focus follows the selection (also into a new month).
  useEffect(() => {
    if (!keyboardMove.current) return
    keyboardMove.current = false
    cells.current.get(selected)?.focus()
  }, [selected, month])

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, day: string) {
    const step: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }
    let next: string | null = null
    if (event.key in step) next = addDays(day, step[event.key])
    else if (event.key === 'Home') next = addDays(day, -new Date(`${day}T00:00:00Z`).getUTCDay())
    else if (event.key === 'End') next = addDays(day, 6 - new Date(`${day}T00:00:00Z`).getUTCDay())
    if (!next) return
    event.preventDefault()
    keyboardMove.current = true
    onSelect(next)
  }

  // The selected day is the one tab stop; if it isn't on screen, the 1st is.
  const tabStop = days.includes(selected) ? selected : `${month}-01`

  return (
    <div
      role="group"
      aria-label={`Days of ${formatMonth(month)}`}
      aria-busy={busy}
      className={`flex flex-col overflow-hidden rounded-xl bg-surface shadow-lift ${className}`}
    >
      {/* Each day's button already names its weekday, so the header row is visual only. */}
      <div aria-hidden className="grid grid-cols-7 border-b border-line bg-canvas/50">
        {WEEKDAY_SHORT.map((name) => (
          <div
            key={name}
            className="py-2 text-center text-caption font-medium text-ink-3"
          >
            {name}
          </div>
        ))}
      </div>
      <div className="grid flex-1 grid-cols-7 grid-rows-6">
        {days.map((day, index) => {
          const inMonth = monthOf(day) === month
          const isSelected = day === selected
          const isToday = day === today
          const muted = isMuted?.(day) ?? false
          const extra = describeDay?.(day)
          return (
            <button
              key={day}
              ref={(el) => {
                if (el) cells.current.set(day, el)
                else cells.current.delete(day)
              }}
              type="button"
              aria-pressed={isSelected}
              aria-current={isToday ? 'date' : undefined}
              aria-label={`${labelOf(day)}${isToday ? ', today' : ''}${extra ? `, ${extra}` : ''}`}
              tabIndex={day === tabStop ? 0 : -1}
              onClick={() => onSelect(day)}
              onKeyDown={(event) => onKeyDown(event, day)}
              className={`relative flex min-h-14 min-w-0 flex-col items-center gap-1 px-1 pt-1.5 pb-1 transition-colors focus-visible:z-10 sm:min-h-20 sm:pt-2.5 ${
                index % 7 !== 6 ? 'border-r border-line' : ''
              } ${index < 35 ? 'border-b border-line' : ''} ${
                isSelected
                  ? 'bg-secondary-soft'
                  : muted
                    ? 'bg-canvas/50 hover:bg-surface-hover'
                    : 'hover:bg-surface-hover'
              }`}
            >
              <span
                className={`grid size-7 place-items-center rounded-md text-label tabular-nums ${
                  isToday
                    ? 'bg-primary font-semibold text-on-primary'
                    : isSelected
                      ? 'font-semibold text-secondary-text'
                      : !inMonth || muted
                        ? 'text-ink-3'
                        : 'font-medium text-ink'
                } ${!inMonth && !isToday ? 'opacity-60' : ''}`}
              >
                {Number(day.slice(8))}
              </span>
              {renderDay?.(day)}
            </button>
          )
        })}
      </div>
    </div>
  )
}
