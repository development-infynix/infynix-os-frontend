import { X } from 'lucide-react'
import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import type { CrmPipeline } from '../../types'
import { AccessUsersTab } from './AccessUsersTab'
import { DealAssignTab } from './DealAssignTab'

type Tab = 'access' | 'assign'

/**
 * CRM › Actions › Assign deals: who can work in the pipeline (Access users)
 * and who owns its deals (Deal assign). It can't be closed while a tool runs.
 */
export function AssignDealsDrawer({
  open,
  onOpenChange,
  pipeline,
  canManage,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  pipeline: CrmPipeline
  canManage: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const tabsId = useId()
  const [tab, setTab] = useState<Tab>('assign')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      dialog.focus()
    } else if (!open && dialog.open) dialog.close()
  }, [open])

  function close() {
    if (busy) return
    onOpenChange(false)
  }

  const accessId = `${tabsId}-access`
  const assignId = `${tabsId}-assign`
  const panelId = `${tabsId}-panel`

  function onTabKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const next: Tab = event.key === 'Home' ? 'access' : event.key === 'End' ? 'assign' : tab === 'access' ? 'assign' : 'access'
    setTab(next)
    document.getElementById(next === 'access' ? accessId : assignId)?.focus()
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => {
        // A dialog opened inside this one (a confirmation) sends its own close/cancel up through React: ignore it.
        if (event.target !== event.currentTarget) return
        event.preventDefault()
        close()
      }}
      onClose={(event) => {
        if (event.target !== event.currentTarget) return
        if (busy) ref.current?.showModal()
        else if (open) onOpenChange(false)
      }}
      onKeyDown={(event) => event.key === 'Escape' && event.stopPropagation()}
      onClick={(event) => event.target === event.currentTarget && close()}
      tabIndex={-1}
      className="app-drawer w-full max-w-sheet border-0 bg-surface p-0 text-ink shadow-dialog outline-none"
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <h2 id={titleId} className="sr-only">
            Assign deals in {pipeline.name}
          </h2>
          <div
            role="tablist"
            aria-label="Assign deals"
            onKeyDown={onTabKeyDown}
            className="flex gap-1 rounded-xl bg-canvas p-1.5 shadow-well"
          >
            <TabButton id={accessId} controls={panelId} selected={tab === 'access'} disabled={busy} onSelect={() => setTab('access')}>
              Access users
            </TabButton>
            <TabButton id={assignId} controls={panelId} selected={tab === 'assign'} disabled={busy} onSelect={() => setTab('assign')}>
              Deal assign
            </TabButton>
          </div>
          <span className="ml-auto min-w-0 truncate text-label text-ink-3" title={pipeline.name}>
            {pipeline.name}
          </span>
          <button
            type="button"
            onClick={close}
            disabled={busy}
            aria-label="Close"
            title={busy ? 'Please wait until the action completes' : 'Close'}
            className="grid size-9 shrink-0 place-items-center rounded-md text-ink-3 hover:bg-surface-hover hover:text-ink disabled:opacity-40"
          >
            <X size={18} strokeWidth={1.9} aria-hidden />
          </button>
        </div>

        <div
          id={panelId}
          role="tabpanel"
          aria-labelledby={tab === 'access' ? accessId : assignId}
          className="flex min-h-0 flex-1 flex-col bg-canvas"
        >
          {open &&
            (tab === 'access' ? (
              <AccessUsersTab pipelineId={pipeline.id} canManage={canManage} onBusyChange={setBusy} />
            ) : (
              <div className="flex-1 overflow-y-auto px-4 py-4">
                <DealAssignTab pipelineId={pipeline.id} canManage={canManage} onBusyChange={setBusy} />
              </div>
            ))}
        </div>
      </div>
    </dialog>
  )
}

function TabButton({
  id,
  controls,
  selected,
  disabled,
  onSelect,
  children,
}: {
  id: string
  controls: string
  selected: boolean
  disabled: boolean
  onSelect: () => void
  children: string
}) {
  return (
    <button
      type="button"
      id={id}
      role="tab"
      aria-selected={selected}
      aria-controls={controls}
      tabIndex={selected ? 0 : -1}
      disabled={disabled && !selected}
      onClick={onSelect}
      className={`flex h-8 items-center justify-center rounded-lg px-3 text-label whitespace-nowrap transition-colors ${
        selected ? 'btn btn-primary' : 'font-medium text-ink-2 hover:bg-surface-hover hover:text-ink disabled:opacity-50'
      }`}
    >
      {children}
    </button>
  )
}
