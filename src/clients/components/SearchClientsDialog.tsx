import { useQuery } from '@tanstack/react-query'
import { Contact, Search, X } from 'lucide-react'
import { useId, useRef, useState, type KeyboardEvent } from 'react'
import { Button } from '@/components/Button'
import { Loader } from '@/components/Loader'
import { Modal } from '@/components/Modal'
import { clientsPageQuery, hasContact, type Client } from '@/lib/clients'
import { useDebouncedValue } from '@/lib/use-debounced-value'

interface SearchClientsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called with the chosen client; the page opens their details drawer. */
  onSelect: (client: Client) => void
}

/** Find a client by name, email or phone. ↑/↓ move through results; Enter or a click opens their details. */
export function SearchClientsDialog({ open, onOpenChange, onSelect }: SearchClientsDialogProps) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Search clients">
      {/* Mounted only while open, so every search starts empty. */}
      {open && (
        <SearchPanel
          onSelect={(client) => {
            onOpenChange(false)
            onSelect(client)
          }}
        />
      )}
    </Modal>
  )
}

function SearchPanel({ onSelect }: { onSelect: (client: Client) => void }) {
  const [text, setText] = useState('')
  const query = useDebouncedValue(text.trim(), 300)
  const { data, isFetching, isError, refetch } = useQuery({
    ...clientsPageQuery(1, query),
    enabled: !!query,
  })
  const listId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const typing = text.trim() !== query

  const [highlight, setHighlight] = useState<{ items: Client[] | undefined; index: number }>({
    items: undefined,
    index: 0,
  })
  const active = highlight.items === data?.items ? highlight.index : 0
  const setActive = (next: number | ((i: number) => number)) =>
    setHighlight({ items: data?.items, index: typeof next === 'function' ? next(active) : next })

  const items = query ? (data?.items ?? []) : []
  const pending = query.length > 0 && (typing || (isFetching && !data))

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!items.length) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((index) => (index + 1) % items.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((index) => (index - 1 + items.length) % items.length)
    } else if (event.key === 'Enter') {
      event.preventDefault()
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
          aria-label="Search by name, email or phone"
          placeholder="Name, email or phone"
          value={text}
          onChange={(event) => setText(event.target.value)}
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
          <p className="grid h-full place-items-center text-label text-ink-3">Type a name, email or phone to find someone.</p>
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
            <Loader label="Searching clients" />
          </div>
        ) : !items.length ? (
          <p className="grid h-full place-items-center text-center text-label text-ink-3">No clients match “{query}”.</p>
        ) : (
          <ul
            id={listId}
            role="listbox"
            aria-label="Matching clients"
            className={`flex flex-col gap-0.5 transition-opacity ${pending ? 'opacity-60' : ''}`}
          >
            {items.map((client, index) => (
              <li
                key={client.id}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === active}
                onMouseEnter={() => setActive(index)}
                onClick={() => onSelect(client)}
                className={`flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 ${
                  index === active ? 'bg-surface-hover' : ''
                }`}
              >
                <span
                  aria-hidden
                  className="grid size-8 shrink-0 place-items-center rounded-md bg-secondary-soft text-secondary-text"
                >
                  <Contact size={16} strokeWidth={1.9} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-ink">{client.name}</span>
                  <span className="block truncate text-caption text-ink-3">
                    {hasContact(client) ? (client.email ?? client.phone) : 'No contact details'}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {items.length > 0 && <p className="mt-2 text-caption text-ink-3">↑ ↓ to move · Enter to open</p>}
    </div>
  )
}
