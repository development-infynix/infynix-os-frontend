import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, ListChecks, Plus, Search } from 'lucide-react'
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react'
import { Button } from '@/components/Button'
import { Loader } from '@/components/Loader'
import { useSession } from '@/lib/auth'
import { ApiError } from '@/lib/api'
import { crmBoardQuery, crmPipelinesQuery, CRM_KEY, moveCrmDeal, type CrmBoard } from '@/lib/crm'
import { AddDealDialog } from '../components/AddDealDialog'
import { CrmActions } from '../components/CrmActions'
import { AddPipelineDrawer } from '../components/AddPipelineDrawer'
import { ManagePipelinesDrawer } from '../components/ManagePipelinesDrawer'
import { KanbanBoard, type BoardScrollState, type KanbanBoardHandle } from '../components/KanbanBoard'
import { PipelineSelect } from '../components/PipelineSelect'
import { SearchDealsDialog } from '../components/SearchDealsDialog'
import type { BoardColumns } from '../types'

type Tab = 'pipeline' | 'actions'

const TAB_STORAGE_KEY = 'infynix-crm-tab'
const PIPELINE_STORAGE_KEY = 'infynix-crm-pipeline'

function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStored(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Storage blocked (private mode): the choice just isn't remembered.
  }
}

/**
 * CRM: a kanban board per pipeline (Pipeline tab) and the pipeline's settings
 * (Actions tab). Pipelines, stages and deals come from the API.
 */
export function CrmPage() {
  const { user } = useSession()
  const canManage = user.role === 'owner' || user.role === 'manager'
  const queryClient = useQueryClient()

  const [tab, setTab] = useState<Tab>(() => (readStored(TAB_STORAGE_KEY) === 'actions' ? 'actions' : 'pipeline'))
  const [selectedPipelineId, setSelectedPipelineId] = useState(() => readStored(PIPELINE_STORAGE_KEY) ?? '')
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [searching, setSearching] = useState(false)
  const [adding, setAdding] = useState(false)
  const [creatingPipeline, setCreatingPipeline] = useState(false)
  const [managingPipelines, setManagingPipelines] = useState(false)
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const [pendingJump, setPendingJump] = useState<string | null>(null)
  const [moveError, setMoveError] = useState<string | null>(null)
  const [scroll, setScroll] = useState<BoardScrollState>({ canPrev: false, canNext: false })
  const board = useRef<KanbanBoardHandle>(null)

  const pipelinesQuery = useQuery(crmPipelinesQuery())
  const pipelines = pipelinesQuery.data ?? []
  const pipeline = pipelines.find((item) => item.id === selectedPipelineId) ?? pipelines[0]
  const activePipelineId = pipeline?.id ?? ''

  const boardQuery = useQuery(crmBoardQuery(activePipelineId))
  const columns = boardQuery.data?.columns ?? {}
  const stages = boardQuery.data?.stages ?? pipeline?.stages ?? []
  const firstStage = stages[0]

  useEffect(() => writeStored(TAB_STORAGE_KEY, tab), [tab])

  // Remember the choice; an id that no longer exists falls back to the first.
  useEffect(() => {
    const list = pipelinesQuery.data
    if (!list?.length) return
    writeStored(
      PIPELINE_STORAGE_KEY,
      list.some((item) => item.id === selectedPipelineId) ? selectedPipelineId : list[0].id,
    )
  }, [pipelinesQuery.data, selectedPipelineId])

  // A search result's highlight fades after a moment.
  useEffect(() => {
    if (!highlightedId) return
    const timer = window.setTimeout(() => setHighlightedId(null), 2000)
    return () => window.clearTimeout(timer)
  }, [highlightedId])

  const tabsId = useId()
  const pipelineTabId = `${tabsId}-pipeline-tab`
  const actionsTabId = `${tabsId}-actions-tab`
  const pipelinePanelId = `${tabsId}-pipeline-panel`
  const actionsPanelId = `${tabsId}-actions-panel`

  function onTabKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const next: Tab =
      event.key === 'Home' ? 'pipeline' : event.key === 'End' ? 'actions' : tab === 'pipeline' ? 'actions' : 'pipeline'
    setTab(next)
    document.getElementById(next === 'pipeline' ? pipelineTabId : actionsTabId)?.focus()
  }

  function changePipeline(id: string) {
    setSelectedPipelineId(id)
    setSelecting(false)
    setSelected(new Set())
    setMoveError(null)
  }

  function toggleSelected(id: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function stopSelecting() {
    setSelecting(false)
    setSelected(new Set())
  }

  /** Scrolls the card into view and flashes it. */
  function jumpTo(id: string) {
    setHighlightedId(id)
    requestAnimationFrame(() => {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      document
        .getElementById(`deal-${id}`)
        ?.scrollIntoView({ block: 'center', inline: 'center', behavior: reduce ? 'auto' : 'smooth' })
    })
  }

  // A new card's scroll waits for the invalidated board to arrive.
  useEffect(() => {
    if (!pendingJump || !boardQuery.data) return
    const id = pendingJump
    const timer = window.setTimeout(() => {
      jumpTo(id)
      setPendingJump(null)
    }, 80)
    return () => window.clearTimeout(timer)
  }, [pendingJump, boardQuery.data])

  /** Drag state lives in the board query, so a refetch or failure restores it. */
  function updateColumns(next: BoardColumns) {
    queryClient.setQueryData<CrmBoard>(
      [...CRM_KEY, 'board', activePipelineId],
      (current) => (current ? { ...current, columns: next } : current),
    )
  }

  async function moveDeal(dealId: string, stageId: string, position: number) {
    setMoveError(null)
    try {
      await moveCrmDeal(dealId, stageId, position)
      await queryClient.invalidateQueries({ queryKey: [...CRM_KEY, 'board', activePipelineId] })
    } catch (caught) {
      setMoveError(
        caught instanceof ApiError && caught.status !== 500
          ? caught.message
          : 'Couldn’t move that deal. It’s back where it was.',
      )
      await queryClient.invalidateQueries({ queryKey: [...CRM_KEY, 'board', activePipelineId] })
    }
  }

  const retryPipelines = () => void queryClient.invalidateQueries({ queryKey: [...CRM_KEY, 'pipelines'] })
  const retryBoard = () =>
    void queryClient.invalidateQueries({ queryKey: [...CRM_KEY, 'board', activePipelineId] })

  return (
    <>
      <div className="grid min-h-[70dvh] w-full place-items-center px-6 pt-8 text-center sm:hidden">
        <div className="max-w-sm">
          <ComputerIllustration />
          <h2 className="mt-4 text-title font-semibold tracking-title text-ink">CRM isn’t available on mobile</h2>
          <p className="mx-auto mt-1.5 max-w-[28ch] text-body text-ink-2">
            Switch to a desktop screen to manage your pipeline, deals and actions.
          </p>
        </div>
      </div>

      <div className="hidden w-full flex-col px-5 pb-24 sm:flex sm:min-h-0 sm:flex-1 sm:px-10 sm:py-10">
        <h1 className="sr-only">CRM</h1>

        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-3 pt-4 sm:pt-0">
          <div
            role="tablist"
            aria-label="CRM sections"
            onKeyDown={onTabKeyDown}
            className="flex shrink-0 gap-1 rounded-xl bg-canvas p-1.5 shadow-well"
          >
            <TabButton
              id={pipelineTabId}
              controls={pipelinePanelId}
              selected={tab === 'pipeline'}
              onSelect={() => setTab('pipeline')}
            >
              Pipeline
            </TabButton>
            <TabButton
              id={actionsTabId}
              controls={actionsPanelId}
              selected={tab === 'actions'}
              onSelect={() => setTab('actions')}
            >
              Actions
            </TabButton>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {tab === 'pipeline' &&
              (selecting ? (
                <>
                  <p className="text-label text-ink-2 tabular-nums" aria-live="polite">
                    {selected.size} selected
                  </p>
                  <Button variant="secondary" onClick={stopSelecting}>
                    Done
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="secondary"
                    onClick={() => setSearching(true)}
                    disabled={!pipeline}
                    aria-haspopup="dialog"
                    aria-label="Search deals"
                    title="Search deals"
                    className="w-9 px-0!"
                  >
                    <Search size={16} strokeWidth={2} aria-hidden />
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setSelecting(true)}
                    disabled={!pipeline}
                    aria-label="Select deals"
                    title="Select deals"
                    className="w-9 px-0! sm:w-auto sm:px-3.5!"
                  >
                    <ListChecks size={16} strokeWidth={2} aria-hidden className="shrink-0" />
                    <span className="hidden sm:inline">Select</span>
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => setAdding(true)}
                    aria-haspopup="dialog"
                    aria-label="Add a deal"
                    title="Add a deal"
                    disabled={!pipeline || !firstStage}
                    className="w-9 px-0! sm:w-auto sm:px-3.5!"
                  >
                    <Plus size={16} strokeWidth={2.25} aria-hidden className="shrink-0" />
                    <span className="hidden sm:inline">Add deal</span>
                  </Button>
                </>
              ))}
            <PipelineSelect
              pipelines={pipelines}
              value={pipeline?.id ?? ''}
              onChange={changePipeline}
            />
            {tab === 'pipeline' && (
              <div className="hidden items-center gap-1.5 sm:flex">
                <Button
                  variant="secondary"
                  onClick={() => board.current?.scrollByColumn(-1)}
                  disabled={!scroll.canPrev}
                  aria-label="Previous stages"
                  title="Previous stages"
                  className="w-9 px-0!"
                >
                  <ChevronLeft size={16} strokeWidth={2} aria-hidden />
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => board.current?.scrollByColumn(1)}
                  disabled={!scroll.canNext}
                  aria-label="Next stages"
                  title="Next stages"
                  className="w-9 px-0!"
                >
                  <ChevronRight size={16} strokeWidth={2} aria-hidden />
                </Button>
              </div>
            )}
          </div>
        </div>

        {tab === 'pipeline' ? (
          <div
            id={pipelinePanelId}
            role="tabpanel"
            aria-labelledby={pipelineTabId}
            className="mt-5 flex flex-col sm:min-h-0 sm:flex-1"
          >
            {pipelinesQuery.isPending ? (
              <div className="grid min-h-72 flex-1 place-items-center">
                <Loader label="Loading pipelines" />
              </div>
            ) : pipelinesQuery.isError ? (
              <LoadFailure
                message="Couldn’t load your pipelines. Check your connection and try again."
                onRetry={retryPipelines}
              />
            ) : !pipeline ? (
              <div className="grid min-h-72 flex-1 place-items-center px-6 text-center">
                <div className="max-w-sm">
                  {canManage ? (
                    <>
                      <h2 className="text-title font-semibold tracking-title text-ink">No pipelines yet</h2>
                      <p className="mt-1.5 text-body text-ink-2">
                        Create one to start tracking deals and clients.
                      </p>
                    </>
                  ) : (
                    <>
                      <h2 className="text-title font-semibold tracking-title text-ink">
                        You haven’t been added to a pipeline yet
                      </h2>
                      <p className="mt-1.5 text-body text-ink-2">
                        Ask an owner or manager to give you access to one.
                      </p>
                    </>
                  )}
                  {canManage && (
                    <Button variant="primary" className="mt-4" onClick={() => setCreatingPipeline(true)}>
                      Create pipeline
                    </Button>
                  )}
                </div>
              </div>
            ) : boardQuery.isPending ? (
              <div className="grid min-h-72 flex-1 place-items-center">
                <Loader label="Loading the board" />
              </div>
            ) : boardQuery.isError ? (
              <LoadFailure
                message="Couldn’t load this pipeline’s board. Check your connection and try again."
                onRetry={retryBoard}
              />
            ) : (
              <>
                {moveError && (
                  <div
                    role="alert"
                    className="mb-3 rounded-lg bg-danger-soft px-3 py-2.5 text-label text-danger"
                  >
                    {moveError}
                  </div>
                )}
                {/* The board slot: takes the height left and gives the board a fixed box to fill. */}
                <div className="relative sm:min-h-0 sm:flex-1">
                <KanbanBoard
                  ref={board}
                  stages={stages}
                  columns={columns}
                  onColumnsChange={updateColumns}
                  totals={boardQuery.data?.totals}
                  onMove={(dealId, stageId, position) => void moveDeal(dealId, stageId, position)}
                  selectable={selecting}
                  selectedIds={selected}
                  onToggleSelect={toggleSelected}
                  dragDisabled={selecting}
                  highlightedId={highlightedId}
                  onScrollStateChange={setScroll}
                />
                </div>
              </>
            )}
          </div>
        ) : (
          <div id={actionsPanelId} role="tabpanel" aria-labelledby={actionsTabId} className="mt-5">
            <CrmActions
              pipelineName={pipeline?.name ?? 'No pipeline'}
              canManage={canManage}
              onManagePipelines={() => setManagingPipelines(true)}
              onCreatePipeline={() => setCreatingPipeline(true)}
              hasPipelines={pipelines.length > 0}
            />
          </div>
        )}

        <SearchDealsDialog
          open={searching}
          onOpenChange={setSearching}
          pipelineId={activePipelineId}
          stages={stages}
          onPick={(deal) => jumpTo(deal.id)}
        />
        <AddDealDialog
          open={adding}
          onOpenChange={setAdding}
          pipelineId={activePipelineId}
          pipelineName={pipeline?.name ?? 'this pipeline'}
          stageId={firstStage?.id}
          stageName={firstStage?.name ?? 'the first stage'}
          onAdded={(deal) => setPendingJump(deal.id)}
        />
        {/* Always mounted so it can slide out; it resets itself each time it opens. */}
        <ManagePipelinesDrawer open={managingPipelines} onOpenChange={setManagingPipelines} />
        <AddPipelineDrawer
          open={creatingPipeline}
          onOpenChange={setCreatingPipeline}
          onCreated={(created, visible) => {
            setTab('pipeline')
            // A manager who left themselves off the access list can't open it.
            if (visible) setSelectedPipelineId(created.id)
            setSelecting(false)
            setSelected(new Set())
            setMoveError(null)
          }}
        />
      </div>
    </>
  )
}

function LoadFailure({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="grid min-h-72 place-items-center px-6 text-center">
      <div className="max-w-sm">
        <p className="text-body text-ink-2">{message}</p>
        <Button variant="secondary" className="mt-3" onClick={onRetry}>
          Try again
        </Button>
      </div>
    </div>
  )
}

interface TabButtonProps {
  id: string
  controls: string
  selected: boolean
  onSelect: () => void
  children: ReactNode
}

function ComputerIllustration() {
  return (
    <svg viewBox="0 0 240 120" aria-hidden className="mx-auto block h-auto w-full max-w-[220px]" fill="none">
      <defs>
        <linearGradient id="crm-wallpaper" x1="44" y1="22" x2="196" y2="82" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--canvas)" />
          <stop offset="1" stopColor="var(--secondary-soft)" stopOpacity="0.55" />
        </linearGradient>
        <clipPath id="crm-screen">
          <rect x="44" y="22" width="152" height="60" rx="4" />
        </clipPath>
      </defs>
      <rect
        x="34"
        y="12"
        width="172"
        height="84"
        rx="10"
        fill="var(--surface)"
        stroke="var(--line-strong)"
        strokeWidth="1.5"
      />
      <rect
        x="44"
        y="22"
        width="152"
        height="60"
        rx="4"
        fill="url(#crm-wallpaper)"
        stroke="var(--line)"
        strokeWidth="1.5"
      />
      <g clipPath="url(#crm-screen)">
        <path
          d="M44 70c26-18 48-22 72-8s44 12 80-6v26H44z"
          fill="var(--secondary-soft)"
          opacity="0.55"
        />
        <path
          d="M44 76c26-14 50-16 76-4s42 10 76-4"
          stroke="var(--line)"
          strokeWidth="1.5"
          opacity="0.8"
        />
      </g>
      <rect
        x="104"
        y="96"
        width="32"
        height="8"
        fill="var(--surface)"
        stroke="var(--line-strong)"
        strokeWidth="1.5"
      />
      <path
        d="M72 104h96l8 10H64z"
        fill="var(--surface)"
        stroke="var(--line-strong)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  )
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
      className={`flex h-8 min-w-[6rem] items-center justify-center rounded-lg px-3 text-label transition-colors ${
        selected ? 'btn btn-primary' : 'font-medium text-ink-2 hover:bg-surface-hover hover:text-ink'
      }`}
    >
      {children}
    </button>
  )
}
