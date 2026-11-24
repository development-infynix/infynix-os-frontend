import { useQuery } from '@tanstack/react-query'
import { Loader2, Search, X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { initials } from '@/lib/auth'
import { useDebouncedValue } from '@/lib/use-debounced-value'
import { calendarPeopleQuery, type CalendarPersonRef } from '../api'

interface PeoplePickerProps {
  selected: CalendarPersonRef[]
  onChange: (people: CalendarPersonRef[]) => void
  /** The meeting's creator: always included, never offered. */
  excludeId: string | null
  disabled?: boolean
}

/**
 * Invitees: a search field (server-side, debounced) with a suggestion list,
 * and the chosen people as removable chips. Only people who can open the
 * Calendar are offered; the server checks again.
 */
export function PeoplePicker({ selected, onChange, excludeId, disabled = false }: PeoplePickerProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const listId = useId()
  const ref = useRef<HTMLDivElement>(null)
  const needle = useDebouncedValue(query.trim(), 300)
  const { data = [], isFetching } = useQuery({ ...calendarPeopleQuery(needle), enabled: open })
  const chosen = new Set(selected.map((person) => person.id))
  const options = data.filter((person) => person.id !== excludeId && !chosen.has(person.id))

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  const add = (person: CalendarPersonRef) => {
    onChange([...selected, { id: person.id, fullName: person.fullName }])
    setQuery('')
  }

  return (
    <div ref={ref} className="relative">
      {selected.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-1.5" aria-label="Invited">
          {selected.map((person) => (
            <li
              key={person.id}
              className="inline-flex items-center gap-1.5 rounded-md bg-surface py-1 pr-1 pl-1.5 text-label text-ink shadow-[inset_0_0_0_1px_var(--line-strong)]"
            >
              <span
                aria-hidden
                className="grid size-5 place-items-center rounded-sm bg-secondary-soft text-micro font-semibold text-secondary-text"
              >
                {initials(person.fullName)}
              </span>
              <span className="max-w-[10rem] truncate">{person.fullName}</span>
              <button
                type="button"
                onClick={() => onChange(selected.filter((other) => other.id !== person.id))}
                disabled={disabled}
                aria-label={`Remove ${person.fullName}`}
                className="grid size-5 place-items-center rounded-sm text-ink-3 hover:bg-surface-hover hover:text-ink"
              >
                <X size={12} strokeWidth={2.2} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="relative">
        <Search
          size={15}
          strokeWidth={2}
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-3"
        />
        <input
          type="search"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-label="Invite people"
          value={query}
          disabled={disabled}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.stopPropagation()
              setOpen(false)
            } else if (event.key === 'Enter') {
              event.preventDefault()
              if (options[0]) add(options[0])
            }
          }}
          placeholder="Search people to invite…"
          className="field-input pr-8 pl-9"
        />
        {open && isFetching && (
          <Loader2
            size={14}
            strokeWidth={2}
            aria-hidden
            className="absolute top-1/2 right-3 -translate-y-1/2 animate-spin text-ink-3"
          />
        )}
      </div>
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label="People"
          className="absolute inset-x-0 z-30 mt-1 max-h-60 overflow-y-auto rounded-lg bg-surface py-1 shadow-dialog"
        >
          {options.map((person) => (
            <li key={person.id} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={false}
                onClick={() => add(person)}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-body text-ink-2 hover:bg-surface-hover hover:text-ink"
              >
                <span
                  aria-hidden
                  className="grid size-6 shrink-0 place-items-center rounded-md bg-secondary-soft text-micro font-semibold text-secondary-text"
                >
                  {initials(person.fullName)}
                </span>
                <span className="min-w-0 flex-1 truncate">{person.fullName}</span>
                <span className="shrink-0 text-caption text-ink-3 capitalize">{person.role}</span>
              </button>
            </li>
          ))}
          {!isFetching && options.length === 0 && (
            <li className="px-3 py-2 text-label text-ink-3">
              {needle ? 'No one matches' : 'No one else to invite'}
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
