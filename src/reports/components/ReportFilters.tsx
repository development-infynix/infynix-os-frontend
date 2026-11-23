import { useQuery } from '@tanstack/react-query'
import { CalendarDays, Check, ChevronDown, Loader2, Search, UserRound, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/Button'
import { useDebouncedValue } from '@/lib/use-debounced-value'
import { reportPeopleQuery } from '../api'
import { formatDay } from '../lib/format'

/** Closes a popover on an outside click or Escape. */
function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) close()
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, close])
  return ref
}

/** Owner and manager: show everyone's reports, or one person's. */
export function PersonFilter({ value, onChange }: { value: string | null; onChange: (id: string | null) => void }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useDismiss(open, () => setOpen(false))
  // Searched on the server once typing pauses. Loaded up front when a filter
  // is active, so the button can show the name (the server always returns it).
  const needle = useDebouncedValue(query.trim(), 300)
  const { data: people = [], isFetching } = useQuery({
    ...reportPeopleQuery(open ? needle : '', value),
    enabled: open || !!value,
  })
  const active = people.find((person) => person.id === value)
  const searching = isFetching || needle !== query.trim()

  function pick(id: string | null) {
    onChange(id)
    setOpen(false)
    setQuery('')
  }

  return (
    <div ref={ref} className="relative">
      <Button
        variant="secondary"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={active ? `Showing reports by ${active.fullName}` : 'Filter reports by person'}
        title={active ? `Filed by ${active.fullName}` : 'Filter by person'}
        className="relative w-9 px-0! sm:w-auto sm:max-w-[13rem] sm:px-3!"
      >
        <UserRound size={16} strokeWidth={2} className="shrink-0" aria-hidden />
        <span className="hidden truncate sm:inline">{value ? (active?.fullName ?? '…') : 'All users'}</span>
        <ChevronDown size={14} strokeWidth={2} className="hidden shrink-0 text-ink-3 sm:block" aria-hidden />
        {value && <ActiveDot className="sm:hidden" />}
      </Button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 w-64 overflow-hidden rounded-lg bg-surface shadow-dialog">
          <div className="relative border-b border-line p-1.5">
            <Search
              size={15}
              strokeWidth={2}
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-3"
            />
            <input
              autoFocus
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name or email…"
              aria-label="Search people"
              className="field-input h-9 pr-8 pl-8"
            />
            {searching && (
              <Loader2
                size={14}
                strokeWidth={2}
                aria-hidden
                className="absolute top-1/2 right-4 -translate-y-1/2 animate-spin text-ink-3"
              />
            )}
          </div>
          <ul
            role="listbox"
            aria-label="People"
            aria-busy={searching}
            className="max-h-72 overflow-y-auto py-1"
          >
            {!needle && <Option label="All users" selected={!value} onSelect={() => pick(null)} />}
            {people.map((person) => (
              <Option
                key={person.id}
                label={person.fullName}
                note={person.isActive ? undefined : 'Deactivated'}
                selected={person.id === value}
                onSelect={() => pick(person.id)}
              />
            ))}
            {needle && !searching && people.length === 0 && (
              <li className="px-3 py-2 text-label text-ink-3">No one matches</li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}

function Option({
  label,
  note,
  selected,
  onSelect,
}: {
  label: string
  note?: string
  selected: boolean
  onSelect: () => void
}) {
  return (
    <li role="presentation">
      <button
        type="button"
        role="option"
        aria-selected={selected}
        onClick={onSelect}
        className={`flex w-full items-center gap-2 px-3 py-2 text-left text-body ${
          selected ? 'bg-secondary-soft font-medium text-secondary-text' : 'text-ink-2 hover:bg-surface-hover hover:text-ink'
        }`}
      >
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {note && <span className="shrink-0 text-caption text-ink-3">{note}</span>}
        {selected && <Check size={14} strokeWidth={2} aria-hidden className="shrink-0" />}
      </button>
    </li>
  )
}

/** Show one day's reports: the native date field, Today and Clear in a small popover. */
export function DateFilter({
  value,
  max,
  onChange,
}: {
  value: string | null
  max: string | undefined
  onChange: (date: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useDismiss(open, () => setOpen(false))

  function pick(date: string | null) {
    onChange(date)
    setOpen(false)
  }

  return (
    <div ref={ref} className="relative">
      <Button
        variant="secondary"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={value ? `Showing reports for ${formatDay(value)}` : 'Filter reports by date'}
        title={value ? formatDay(value) : 'Filter by date'}
        className="relative w-9 px-0! sm:w-auto sm:px-3!"
      >
        <CalendarDays size={16} strokeWidth={2} className="shrink-0" aria-hidden />
        <span className="hidden tabular-nums sm:inline">{value ? formatDay(value) : 'All dates'}</span>
        <ChevronDown size={14} strokeWidth={2} className="hidden shrink-0 text-ink-3 sm:block" aria-hidden />
        {value && <ActiveDot className="sm:hidden" />}
      </Button>
      {open && (
        <div
          role="dialog"
          aria-label="Filter by date"
          className="absolute right-0 z-30 mt-1 w-60 rounded-lg bg-surface p-3 shadow-dialog"
        >
          <input
            type="date"
            autoFocus
            value={value ?? ''}
            max={max}
            onChange={(event) => event.target.value && pick(event.target.value)}
            aria-label="Date"
            className="field-input tabular-nums"
          />
          <div className="mt-2.5 flex items-center gap-2">
            {max && (
              <Button size="sm" variant="secondary" onClick={() => pick(max)} className="flex-1">
                Today
              </Button>
            )}
            <Button size="sm" variant="secondary" onClick={() => pick(null)} disabled={!value} className="flex-1">
              <X size={14} strokeWidth={2} aria-hidden />
              All dates
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

/** Marks an icon-only filter button (phones) whose filter is on. */
function ActiveDot({ className = '' }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-secondary ring-2 ring-canvas ${className}`}
    />
  )
}
