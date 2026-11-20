import { useQuery } from '@tanstack/react-query'
import { History, X } from 'lucide-react'
import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { Detail, Muted, Panel } from '@/components/DetailPanel'
import { showDetailValue } from '@/lib/detail-value'
import { ApiError } from '@/lib/api'
import { crmDealQuery } from '@/lib/crm'
import type { CrmDeal, CrmStage } from '../types'

type Tab = 'details' | 'history'

interface DealDetailsDrawerProps {
  /** The deal to show (the card's copy, refreshed on open); `null` closes the drawer. */
  deal: CrmDeal | null
  pipelineName: string
  stages: CrmStage[]
  onClose: () => void
}

const dateFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

/**
 * A deal in a right-side sheet (same shape as the client drawer): where it sits
 * in the pipeline, when it was added, and the client's fields. History lists
 * what happened to it since it entered the pipeline (not recorded yet).
 */
export function DealDetailsDrawer({ deal, pipelineName, stages, onClose }: DealDetailsDrawerProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const tabsId = useId()
  const [tab, setTab] = useState<Tab>('details')

  const fresh = useQuery({ ...crmDealQuery(deal?.id ?? ''), placeholderData: deal ?? undefined })
  const gone = fresh.error instanceof ApiError && fresh.error.status === 404
  const shown = fresh.data ?? deal

  const open = !!deal
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      setTab('details')
      dialog.showModal()
      dialog.focus()
    } else if (!open && dialog.open) dialog.close()
  }, [open])

  const stageName = stages.find((stage) => stage.id === shown?.stageId)?.name
  const entries = shown ? Object.entries(shown.customDetails ?? {}) : []

  const detailsTabId = `${tabsId}-details-tab`
  const historyTabId = `${tabsId}-history-tab`
  const panelId = `${tabsId}-panel`

  function onTabKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const next: Tab =
      event.key === 'Home' ? 'details' : event.key === 'End' ? 'history' : tab === 'details' ? 'history' : 'details'
    setTab(next)
    document.getElementById(next === 'details' ? detailsTabId : historyTabId)?.focus()
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onKeyDown={(event) => event.key === 'Escape' && event.stopPropagation()}
      onClick={(event) => event.target === event.currentTarget && onClose()}
      tabIndex={-1}
      className="app-drawer w-full max-w-sheet border-0 bg-surface p-0 text-ink shadow-dialog outline-none"
    >
      {shown && (
        <div className="flex h-full flex-col">
          <div className="border-b border-line px-4 pt-3.5 pb-3">
            <div className="flex items-center gap-2">
              <h2 id={titleId} className="min-w-0 flex-1 truncate text-title font-semibold tracking-title">
                {shown.name}
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="grid size-9 shrink-0 place-items-center rounded-md text-ink-3 hover:bg-surface-hover hover:text-ink"
              >
                <X size={18} strokeWidth={1.9} />
              </button>
            </div>
            <div
              role="tablist"
              aria-label="Deal sections"
              onKeyDown={onTabKeyDown}
              className="mt-3 flex w-fit gap-1 rounded-xl bg-canvas p-1.5 shadow-well"
            >
              <TabButton id={detailsTabId} controls={panelId} selected={tab === 'details'} onSelect={() => setTab('details')}>
                Details
              </TabButton>
              <TabButton id={historyTabId} controls={panelId} selected={tab === 'history'} onSelect={() => setTab('history')}>
                History
              </TabButton>
            </div>
          </div>

          <div
            id={panelId}
            role="tabpanel"
            aria-labelledby={tab === 'details' ? detailsTabId : historyTabId}
            className="flex-1 overflow-y-auto bg-canvas px-4 py-4"
          >
            {tab === 'details' ? (
              <>
                {gone && (
                  <p role="alert" className="mb-4 rounded-lg bg-danger-soft px-3 py-2.5 text-label text-danger">
                    This deal is no longer in the pipeline.
                  </p>
                )}
                <Panel title="Deal">
                  <Detail label="Stage">
                    {stageName ? (
                      <span className="rounded-md bg-surface-hover px-2 py-0.5 text-label font-medium text-ink-2">
                        {stageName}
                      </span>
                    ) : (
                      <Muted>Unknown stage</Muted>
                    )}
                  </Detail>
                  <Detail label="Pipeline">{pipelineName}</Detail>
                  <Detail label="Added">
                    <span className="tabular-nums">{dateFormat.format(new Date(shown.addedAt))}</span>
                  </Detail>
                </Panel>
                <Panel title="Client" className="mt-4">
                  <Detail label="Name">{shown.name}</Detail>
                  <Detail label="Email">
                    {shown.email ? <span className="break-all">{shown.email}</span> : <Muted>Not provided</Muted>}
                  </Detail>
                  <Detail label="Phone">{shown.phone ? <span>{shown.phone}</span> : <Muted>Not provided</Muted>}</Detail>
                </Panel>
                <Panel title="Custom details" className="mt-4">
                  {entries.length ? (
                    entries.map(([key, value]) => (
                      <Detail key={key} label={key}>
                        {showDetailValue(value)}
                      </Detail>
                    ))
                  ) : (
                    <p className="px-3.5 py-4 text-label text-ink-3">This client has no custom details.</p>
                  )}
                </Panel>
              </>
            ) : (
              <div className="grid min-h-60 place-items-center px-6 text-center">
                <div className="max-w-[30ch]">
                  <History size={22} strokeWidth={1.8} aria-hidden className="mx-auto text-ink-3" />
                  <p className="mt-2 text-body font-medium text-ink">No history yet</p>
                  <p className="mt-1 text-label text-ink-3">
                    Moves and changes to this deal since it entered {pipelineName} will show here.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </dialog>
  )
}

interface TabButtonProps {
  id: string
  controls: string
  selected: boolean
  onSelect: () => void
  children: string
}

function TabButton({ id, controls, selected, onSelect, children }: TabButtonProps) {
  return (
    <button
      type="button"
      id={id}
      role="tab"
      aria-selected={selected}
      aria-controls={controls}
      tabIndex={selected ? 0 : -1}
      onClick={onSelect}
      className={`flex h-8 min-w-[5.5rem] items-center justify-center rounded-lg px-3 text-label transition-colors ${
        selected ? 'btn btn-primary' : 'font-medium text-ink-2 hover:bg-surface-hover hover:text-ink'
      }`}
    >
      {children}
    </button>
  )
}
