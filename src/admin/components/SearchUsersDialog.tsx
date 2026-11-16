import { useQuery } from '@tanstack/react-query'
import { Search, X } from 'lucide-react'
import { useId, useRef, useState, type KeyboardEvent } from 'react'
import { Button } from '@/components/Button'
import { Loader } from '@/components/Loader'
import { Modal } from '@/components/Modal'
import { initials, ROLE_LABEL } from '@/lib/auth'
import { searchMembersQuery, type Member } from '@/lib/members'
import { useDebouncedValue } from '@/lib/use-debounced-value'

interface SearchUsersDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called with the chosen user; the page opens their details drawer. */
  onSelect: (member: Member) => void
}

/**
 * Search the company's users by name or email. The query goes to the server
 * 300 ms after typing stops; ↑/↓ move through results, Enter or a click opens
 * the user's details.
 */
export function SearchUsersDialog({ open, onOpenChange, onSelect }: SearchUsersDialogProps) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Search users">
      {/* Mounted only while open, so every search starts empty. */}
      {open && (
        <SearchPanel
          onSelect={(member) => {
            onOpenChange(false)
            onSelect(member)
          }}
        />
      )}
    </Modal>
  )
}

function SearchPanel({ onSelect }: { onSelect: (member: Member) => void }) {
  const [text, setText] = useState('')
  const query = useDebouncedValue(text.trim(), 300)
  const { data: results, isFetching, isError, refetch } = useQuery(searchMembersQuery(query))
  const listId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const typing = text.trim() !== query

  // The highlighted row belongs to one set of results: a new set starts at the top.
  const [highlight, setHighlight] = useState<{ results: Member[] | undefined; index: number }>({
    results: undefined,
    index: 0,
  })
  const active = highlight.results === results ? highlight.index : 0
  const setActive = (next: number | ((i: number) => number)) =>
    setHighlight({ results, index: typeof next === 'function' ? next(active) : next })

  const items = query ? (results ?? []) : []
  const pending = query.length > 0 && (typing || (isFetching && !results))

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!items.length) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => (i + 1) % items.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => (i - 1 + items.length) % items.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      onSelect(items[active])
    }
  }

  return (
    <div className="px-5 pt-4 pb-5">
      <div className="relative">
        <Search
          size={16}
          strokeWidth={2}
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-3"
        />
        <input
          ref={inputRef}
          autoFocus
          type="search"
          role="combobox"
          aria-expanded={items.length > 0}
          aria-controls={listId}
          aria-activedescendant={items.length ? `${listId}-${active}` : undefined}
          aria-autocomplete="list"
          aria-label="Search by name or email"
          placeholder="Name or email"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          className="field-input pr-10 pl-9 [&::-webkit-search-cancel-button]:hidden"
        />
        {text && (
          <button
            type="button"
            onClick={() => {
              setText('')
              inputRef.current?.focus()
            }}
            aria-label="Clear search"
            className="absolute inset-y-0 right-0 grid w-10 place-items-center rounded-r-lg text-ink-3 hover:text-ink"
          >
            <X size={15} strokeWidth={2} />
          </button>
        )}
      </div>

      <div className="mt-3 h-72 overflow-y-auto overscroll-contain" aria-live="polite">
        {!query ? (
          <p className="grid h-full place-items-center text-label text-ink-3">Type a name or email to find someone.</p>
        ) : isError ? (
          <div className="grid h-full place-items-center text-center">
            <div>
              <p className="text-body text-ink-2">Search isn’t working right now.</p>
              <Button size="sm" variant="secondary" className="mt-3" onClick={() => void refetch()}>
                Try again
              </Button>
            </div>
          </div>
        ) : pending && !items.length ? (
          <div className="grid h-full place-items-center">
            <Loader label="Searching users" />
          </div>
        ) : !items.length ? (
          <p className="grid h-full place-items-center text-center text-label text-ink-3">
            No one matches “{query}”.
          </p>
        ) : (
          <ul
            id={listId}
            role="listbox"
            aria-label="Matching users"
            className={`flex flex-col gap-0.5 transition-opacity ${pending ? 'opacity-60' : ''}`}
          >
            {items.map((m, i) => (
              <li
                key={m.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => onSelect(m)}
                className={`flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 ${
                  i === active ? 'bg-surface-hover' : ''
                }`}
              >
                <span
                  aria-hidden
                  className={`grid size-8 shrink-0 place-items-center rounded-md text-caption font-semibold ${
                    m.isActive ? 'bg-secondary text-on-secondary' : 'bg-surface-hover text-ink-3'
                  }`}
                >
                  {initials(m.fullName)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-ink">{m.fullName}</span>
                  <span className="block truncate text-caption text-ink-3">{m.email}</span>
                </span>
                <span
                  className={`shrink-0 rounded-md px-1.5 py-0.5 text-micro font-semibold ${
                    m.role === 'staff' ? 'bg-surface-hover text-ink-2' : 'bg-secondary-soft text-secondary-text'
                  }`}
                >
                  {ROLE_LABEL[m.role]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {items.length > 0 && (
        <p className="mt-2 text-caption text-ink-3">↑ ↓ to move · Enter to open</p>
      )}
    </div>
  )
}
