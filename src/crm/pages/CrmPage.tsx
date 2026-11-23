import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronLeft, ChevronRight, FileSpreadsheet, PenLine, Plus, Search, Upload } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react'
import { AlertDialog } from '@/components/Alert'
import { Button } from '@/components/Button'
import { Loader } from '@/components/Loader'
import { hasAccess } from '@/lib/access'
import { useSession } from '@/lib/auth'
import { ClientImportModal } from '@/clients/components/ClientImportModal'
import { ApiError } from '@/lib/api'
import {
  appendCards,
  crmBoardKey,
  crmBoardQuery,
  crmPipelinesQuery,
  CRM_KEY,
  deleteCrmDeal,
  deleteCrmDeals,
  TRANSFER_CHUNK,
  CRM_MOVE_KEY,
  CRM_PIPELINE_STORAGE_KEY,
  fetchCrmStageDeals,
  moveCrmDeal,
  type CrmBoard,
} from '@/lib/crm'
import { AddDealDialog } from '../components/AddDealDialog'
import { AddFromImportsDrawer } from '../components/AddFromImportsDrawer'
import { AssignDealsDrawer } from '../components/assign/AssignDealsDrawer'
import { DealTransferDrawer, type TransferAction } from '../components/DealTransferDrawer'
import { CrmActions } from '../components/CrmActions'
import { DealDetailsDrawer } from '../components/DealDetailsDrawer'
import { DealOptionsMenu } from '../components/DealOptionsMenu'
import { AddPipelineDrawer } from '../components/AddPipelineDrawer'
import { ManagePipelinesDrawer } from '../components/ManagePipelinesDrawer'
import { ManageStageDrawer } from '../components/ManageStageDrawer'
import {
  KanbanBoard,
  type BoardMove,
  type BoardScrollState,
  type KanbanBoardHandle,
} from '../components/KanbanBoard'
import { PipelineSelect } from '../components/PipelineSelect'
import { SearchDealsDialog } from '../components/SearchDealsDialog'
import type { BoardColumns, CrmDeal } from '../types'

type Tab = 'pipeline' | 'actions'

const TAB_STORAGE_KEY = 'infynix-crm-tab'

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
  const session = useSession()
  const { user } = session
  const canManage = user.role === 'owner' || user.role === 'manager'
  // The import-based ways to add deals read the client directory, which needs the Clients menu too.
  const canUseClients = hasAccess(session, 'clients')
  const queryClient = useQueryClient()

  const [tab, setTab] = useState<Tab>(() => (readStored(TAB_STORAGE_KEY) === 'actions' ? 'actions' : 'pipeline'))
  const [selectedPipelineId, setSelectedPipelineId] = useState(() => readStored(CRM_PIPELINE_STORAGE_KEY) ?? '')
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  /** A card's options menu: the deal and the settings button it opened from. */
  const [dealMenu, setDealMenu] = useState<{ deal: CrmDeal; anchor: HTMLElement } | null>(null)
  /** The deal whose options › Delete is being confirmed. */
  const [deletingDeal, setDeletingDeal] = useState<CrmDeal | null>(null)
  const closeDealMenu = useCallback(() => setDealMenu(null), [])
  const openDealMenu = useCallback(
    (deal: CrmDeal, anchor: HTMLElement) =>
      setDealMenu((current) => (current?.deal.id === deal.id ? null : { deal, anchor })),
    [],
  )
  const [searching, setSearching] = useState(false)
  const [adding, setAdding] = useState(false)
  const [addingFromImports, setAddingFromImports] = useState(false)
  const [assigningDeals, setAssigningDeals] = useState(false)
  const [transferringDeals, setTransferringDeals] = useState(false)
  /** Add or Move, from the Deal transfer card's menu; kept while the drawer slides shut. */
  const [transferAction, setTransferAction] = useState<TransferAction>('move')
  /** Select › Move / Add: the selected deal ids, frozen when the drawer opens. */
  const [transferIds, setTransferIds] = useState<string[] | undefined>(undefined)
  const [importingData, setImportingData] = useState(false)
  const [creatingPipeline, setCreatingPipeline] = useState(false)
  const [managingPipelines, setManagingPipelines] = useState(false)
  const [managingStages, setManagingStages] = useState(false)
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  /** The deal open in the details drawer (from a card's View or a search result). */
  const [viewing, setViewing] = useState<CrmDeal | null>(null)
  const [pendingJump, setPendingJump] = useState<string | null>(null)
  const [moveError, setMoveError] = useState<string | null>(null)
  /** A short note after Add deal used a client already in the directory. */
  const [notice, setNotice] = useState<string | null>(null)
  const [scroll, setScroll] = useState<BoardScrollState>({ canPrev: false, canNext: false })
  const board = useRef<KanbanBoardHandle>(null)

  const pipelinesQuery = useQuery(crmPipelinesQuery())
  const pipelines = pipelinesQuery.data ?? []
  const pipeline = pipelines.find((item) => item.id === selectedPipelineId) ?? pipelines[0]
  // Until the list arrives, ask for the remembered pipeline's board right away rather than after it.
  const activePipelineId = pipeline?.id ?? (pipelinesQuery.isPending ? selectedPipelineId : '')

  const boardQuery = useQuery(crmBoardQuery(activePipelineId))
  const columns = boardQuery.data?.columns ?? {}
  const stages = boardQuery.data?.stages ?? pipeline?.stages ?? []

  // Drop selected cards that are no longer on the board after a refresh (moved
  // or deleted by someone else), so Move / Add / Delete only send real cards.
  const [seenBoard, setSeenBoard] = useState(boardQuery.data)
  if (boardQuery.data !== seenBoard) {
    setSeenBoard(boardQuery.data)
    if (boardQuery.data && selected.size) {
      const onBoard = new Set(Object.values(boardQuery.data.columns).flatMap((cards) => cards.map((card) => card.id)))
      const kept = [...selected].filter((id) => onBoard.has(id))
      if (kept.length !== selected.size) setSelected(new Set(kept))
    }
  }
  const firstStage = stages[0]

  useEffect(() => writeStored(TAB_STORAGE_KEY, tab), [tab])

  // Remember the choice; an id that no longer exists falls back to the first.
  useEffect(() => {
    const list = pipelinesQuery.data
    if (!list?.length) return
    writeStored(
      CRM_PIPELINE_STORAGE_KEY,
      list.some((item) => item.id === selectedPipelineId) ? selectedPipelineId : list[0].id,
    )
  }, [pipelinesQuery.data, selectedPipelineId])

  // The note fades on its own.
  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 6000)
    return () => window.clearTimeout(timer)
  }, [notice])

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
    setManagingStages(false)
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

  /** Select › Delete: 500 per request; the dialog shows any error and stays open. */
  async function deleteSelected() {
    const ids = [...selected]
    try {
      for (let index = 0; index < ids.length; index += TRANSFER_CHUNK) {
        await deleteCrmDeals(ids.slice(index, index + TRANSFER_CHUNK))
      }
      stopSelecting()
    } finally {
      // Refresh even after a partial failure, so the board shows what's left.
      await queryClient.invalidateQueries({ queryKey: CRM_KEY })
    }
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

  /** Drag state lives in the board query: the card shows where it was dropped before the save returns. */
  function setColumns(pipelineId: string, next: BoardColumns) {
    queryClient.setQueryData<CrmBoard>(crmBoardKey(pipelineId), (current) => {
      if (!current) return current
      // Local moves change how many cards a stage holds; its total moves by the same amount. Without
      // this, a column dragged empty still says "1 more" and loads the card back from the server
      // (which hasn't saved the move yet), putting the same deal in two columns.
      const totals = { ...current.totals }
      for (const stageId of Object.keys(next)) {
        const delta = (next[stageId]?.length ?? 0) - (current.columns[stageId]?.length ?? 0)
        if (delta) totals[stageId] = Math.max(0, (totals[stageId] ?? 0) + delta)
      }
      return { ...current, columns: next, totals }
    })
  }
  const updateColumns = (next: BoardColumns) => setColumns(activePipelineId, next)

  /** A card is held: refetches wait, since one landing mid-drag would put the card back. */
  const dragging = useRef(false)
  /** A refetch was skipped during the drag; run it once the drag is over. */
  const refetchAfterDrag = useRef(false)

  /**
   * Fetches the board fresh, unless a card is held or another move is still
   * saving: an earlier move's refetch would show the later ones undone.
   * `settling` is 1 when called from a move's onSettled, which TanStack runs
   * while that move still counts as pending.
   */
  function syncBoard(pipelineId: string, settling = 0) {
    if (dragging.current) {
      refetchAfterDrag.current = true
      return
    }
    if (queryClient.isMutating({ mutationKey: CRM_MOVE_KEY }) > settling) return
    void queryClient.invalidateQueries({ queryKey: crmBoardKey(pipelineId) })
  }

  function onDraggingChange(held: boolean) {
    dragging.current = held
    if (held) {
      // A refetch already on its way would land on top of the drag.
      void queryClient.cancelQueries({ queryKey: crmBoardKey(activePipelineId) })
    } else if (refetchAfterDrag.current) {
      refetchAfterDrag.current = false
      syncBoard(activePipelineId)
    }
  }

  /** Stages with a next-page request in flight; the ref guards against double requests between renders. */
  const loadingRef = useRef(new Set<string>())
  const [loadingStages, setLoadingStages] = useState<ReadonlySet<string>>(new Set())
  const [failedStages, setFailedStages] = useState<ReadonlySet<string>>(new Set())

  /** Appends a stage's next CRM_PAGE_SIZE cards, starting after the ones already loaded. */
  const loadMore = useCallback(
    async (stageId: string) => {
      const pipelineId = activePipelineId
      if (!pipelineId || loadingRef.current.has(stageId)) return
      const loaded = queryClient.getQueryData<CrmBoard>(crmBoardKey(pipelineId))?.columns[stageId]?.length ?? 0
      loadingRef.current.add(stageId)
      setLoadingStages(new Set(loadingRef.current))
      setFailedStages((current) => {
        if (!current.has(stageId)) return current
        const next = new Set(current)
        next.delete(stageId)
        return next
      })
      try {
        const page = await fetchCrmStageDeals(stageId, loaded)
        queryClient.setQueryData<CrmBoard>(crmBoardKey(pipelineId), (current) => {
          if (!current) return current
          // Never add a card that's already on the board in another column: the server can be a
          // step behind a move that hasn't saved yet, and one deal in two columns breaks dragging.
          const elsewhere = new Set(
            Object.entries(current.columns)
              .filter(([id]) => id !== stageId)
              .flatMap(([, cards]) => cards.map((card) => card.id)),
          )
          const cards = appendCards(
            current.columns[stageId] ?? [],
            page.items.filter((card) => !elsewhere.has(card.id)),
          )
          // Nothing new (someone moved cards meanwhile): settle the count on what's loaded, or the
          // column would keep asking for the same slice. The next refetch brings the true total back.
          const total = cards.length === (current.columns[stageId]?.length ?? 0) ? cards.length : page.total
          return {
            ...current,
            columns: { ...current.columns, [stageId]: cards },
            totals: { ...current.totals, [stageId]: total },
          }
        })
      } catch {
        setFailedStages((current) => new Set(current).add(stageId))
      } finally {
        loadingRef.current.delete(stageId)
        setLoadingStages(new Set(loadingRef.current))
      }
    },
    [activePipelineId, queryClient],
  )
  const onLoadMore = useCallback((stageId: string) => void loadMore(stageId), [loadMore])

  const moveMutation = useMutation({
    mutationKey: CRM_MOVE_KEY,
    mutationFn: (move: BoardMove & { pipelineId: string }) =>
      moveCrmDeal(move.dealId, move.stageId, move.position),
    onMutate: async ({ pipelineId }) => {
      setMoveError(null)
      await queryClient.cancelQueries({ queryKey: crmBoardKey(pipelineId) })
    },
    onError: (caught, { pipelineId, before }) => {
      // Straight back to the board as it was before this drag; the refetch below confirms it.
      setColumns(pipelineId, before)
      setMoveError(
        caught instanceof ApiError && caught.status !== 500
          ? caught.message
          : 'Couldn’t move that deal. It’s back where it was.',
      )
    },
    // Only the last pending move refetches.
    onSettled: (_data, _error, { pipelineId }) => syncBoard(pipelineId, 1),
  })

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
            {tab === 'pipeline' && (
              <>
                {!selecting && (
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
                )}
                <SelectDealsButton
                  selecting={selecting}
                  count={selected.size}
                  disabled={!pipeline}
                  onToggle={() => (selecting ? stopSelecting() : setSelecting(true))}
                  onClear={stopSelecting}
                  onDelete={() => setConfirmingDelete(true)}
                  onTransfer={
                    canManage
                      ? (action) => {
                          setTransferAction(action)
                          setTransferIds([...selected])
                          setTransferringDeals(true)
                        }
                      : undefined
                  }
                />
                {!selecting &&
                  (canUseClients ? (
                    <AddDealMenu
                      disabled={!pipeline || !firstStage}
                      onForm={() => setAdding(true)}
                      onExistingImport={() => setAddingFromImports(true)}
                      onImportData={() => setImportingData(true)}
                    />
                  ) : (
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
                  ))}
              </>
            )}
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
                {notice && (
                  <div
                    role="status"
                    className="mb-3 rounded-lg bg-secondary-soft px-3 py-2.5 text-label text-secondary-text"
                  >
                    {notice}
                  </div>
                )}
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
                  onMove={(move) => moveMutation.mutate({ ...move, pipelineId: activePipelineId })}
                  onDraggingChange={onDraggingChange}
                  onView={setViewing}
                  onOptions={openDealMenu}
                  onLoadMore={onLoadMore}
                  loadingStages={loadingStages}
                  failedStages={failedStages}
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
              onManageStages={canManage && pipeline ? () => setManagingStages(true) : undefined}
              onAssignDeals={pipeline ? () => setAssigningDeals(true) : undefined}
              onTransferDeals={
                canManage && pipeline
                  ? (action) => {
                      setTransferAction(action)
                      setTransferIds(undefined)
                      setTransferringDeals(true)
                    }
                  : undefined
              }
              hasPipelines={pipelines.length > 0}
            />
          </div>
        )}

        <SearchDealsDialog
          open={searching}
          onOpenChange={setSearching}
          pipelineId={activePipelineId}
          stages={stages}
          onPick={setViewing}
        />
        <DealDetailsDrawer
          deal={viewing}
          pipelineName={pipeline?.name ?? 'this pipeline'}
          stages={stages}
          canManage={canManage}
          onClose={() => setViewing(null)}
        />
        <AddDealDialog
          open={adding}
          onOpenChange={setAdding}
          pipelineId={activePipelineId}
          pipelineName={pipeline?.name ?? 'this pipeline'}
          stageId={firstStage?.id}
          stageName={firstStage?.name ?? 'the first stage'}
          onAdded={(deal) => {
            setPendingJump(deal.id)
            setNotice(deal.existingClient ? `${deal.name} was already a client, so they were added as a deal.` : null)
          }}
        />
        <ManageStageDrawer
          open={managingStages}
          onOpenChange={setManagingStages}
          pipelineId={activePipelineId}
        />
        <DealOptionsMenu
          anchor={dealMenu?.anchor ?? null}
          dealName={dealMenu?.deal.name ?? ''}
          onClose={closeDealMenu}
          onTransfer={
            canManage && dealMenu
              ? (action) => {
                  setTransferAction(action)
                  setTransferIds([dealMenu.deal.id])
                  setTransferringDeals(true)
                }
              : undefined
          }
          onDelete={() => dealMenu && setDeletingDeal(dealMenu.deal)}
        />
        <AlertDialog
          open={deletingDeal !== null}
          onOpenChange={(next) => !next && setDeletingDeal(null)}
          tone="danger"
          icon={null}
          width="compact"
          title={`Delete ${deletingDeal?.name ?? 'this deal'}?`}
          description={`The deal will be removed from ${pipeline?.name ?? 'this pipeline'}. The client stays in your directory. This can’t be undone.`}
          confirmLabel="Delete"
          pendingLabel="Deleting…"
          onConfirm={async () => {
            if (!deletingDeal) return
            try {
              await deleteCrmDeal(deletingDeal.id)
            } finally {
              await queryClient.invalidateQueries({ queryKey: CRM_KEY })
            }
          }}
        />
        <AlertDialog
          open={confirmingDelete}
          onOpenChange={setConfirmingDelete}
          tone="danger"
          icon={null}
          width="compact"
          title={`Delete ${selected.size} deal${selected.size === 1 ? '' : 's'}?`}
          description={`${selected.size === 1 ? 'It' : 'They'}’ll be removed from ${pipeline?.name ?? 'this pipeline'}. The clients stay in your directory. This can’t be undone.`}
          confirmLabel="Delete"
          pendingLabel="Deleting…"
          onConfirm={deleteSelected}
        />
        {pipeline && canManage && (
          <DealTransferDrawer
            open={transferringDeals}
            onOpenChange={setTransferringDeals}
            action={transferAction}
            dealIds={transferIds}
            onDone={transferIds && selecting ? stopSelecting : undefined}
            pipeline={{ ...pipeline, stages }}
            pipelines={pipelines}
            totals={boardQuery.data?.totals ?? {}}
          />
        )}
        {pipeline && (
          <AssignDealsDrawer
            open={assigningDeals}
            onOpenChange={setAssigningDeals}
            pipeline={{ ...pipeline, stages }}
            canManage={canManage}
          />
        )}
        {pipeline && canUseClients && (
          <>
            <AddFromImportsDrawer
              open={addingFromImports}
              onOpenChange={setAddingFromImports}
              pipeline={{ ...pipeline, stages }}
            />
            <ClientImportModal
              open={importingData}
              onOpenChange={setImportingData}
              pipeline={{ ...pipeline, stages }}
            />
          </>
        )}
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

/**
 * Add deal for people who can also open Clients: one button with three ways in.
 * Form is the single-deal dialog; Existing import adds whole imports' clients;
 * Import data runs the Excel import and adds what it creates.
 */
function AddDealMenu({
  disabled,
  onForm,
  onExistingImport,
  onImportData,
}: {
  disabled: boolean
  onForm: () => void
  onExistingImport: () => void
  onImportData: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const firstItemRef = useRef<HTMLButtonElement>(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return
    firstItemRef.current?.focus()
    const onPointerDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      ref.current?.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]')?.focus()
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function choose(action: () => void) {
    // Back on the trigger first: the dialog returns focus to whatever had it when it opened.
    ref.current?.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]')?.focus()
    setOpen(false)
    action()
  }

  const items = [
    { label: 'Form', hint: 'Add one client as a deal', icon: PenLine, action: onForm },
    { label: 'Existing import', hint: 'Add the clients from imports', icon: FileSpreadsheet, action: onExistingImport },
    { label: 'Import data', hint: 'Import a spreadsheet into this pipeline', icon: Upload, action: onImportData },
  ]

  return (
    <div ref={ref} className="relative">
      <Button
        variant="primary"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label="Add a deal"
        title="Add a deal"
        disabled={disabled}
        className="w-9 px-0! sm:w-auto sm:px-3.5!"
      >
        <Plus size={16} strokeWidth={2.25} aria-hidden className="shrink-0" />
        <span className="hidden sm:inline">Add deal</span>
        <ChevronDown
          size={15}
          strokeWidth={2}
          aria-hidden
          className={`-mr-0.5 hidden shrink-0 transition-transform duration-press sm:block ${open ? 'rotate-180' : ''}`}
        />
      </Button>
      {open && (
        <ul
          id={menuId}
          role="menu"
          aria-label="Add a deal"
          className="absolute right-0 z-30 mt-1 w-64 rounded-lg bg-surface py-1 shadow-dialog"
        >
          {items.map(({ label, hint, icon: Icon, action }, index) => (
            <li key={label} role="none">
              <button
                ref={index === 0 ? firstItemRef : undefined}
                type="button"
                role="menuitem"
                onClick={() => choose(action)}
                className="flex w-full items-start gap-2.5 px-3 py-2 text-left hover:bg-surface-hover"
              >
                <Icon size={16} strokeWidth={2} aria-hidden className="mt-0.5 shrink-0 text-ink-3" />
                <span className="min-w-0">
                  <span className="block text-body font-medium text-ink">{label}</span>
                  <span className="block text-caption text-ink-3">{hint}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

interface SelectDealsButtonProps {
  selecting: boolean
  count: number
  disabled: boolean
  onToggle: () => void
  onClear: () => void
  onDelete: () => void
  /** Select › Move / Add to pipeline; absent for staff (Owner and managers only). */
  onTransfer?: (action: TransferAction) => void
}

function SelectDealsButton({ selecting, count, disabled, onToggle, onClear, onDelete, onTransfer }: SelectDealsButtonProps) {
  const [open, setOpen] = useState(false)
  const hasSelection = count > 0
  const [wasSplit, setWasSplit] = useState(selecting && hasSelection)
  const ref = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const split = selecting && hasSelection

  // Drop a stale menu when the split button collapses.
  if (split !== wasSplit) {
    setWasSplit(split)
    if (!split) setOpen(false)
  }

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <div
        className={`btn ${selecting ? 'btn-primary' : 'btn-secondary'} h-9 gap-0! p-0! text-body ${
          disabled ? 'opacity-60' : ''
        }`}
      >
        <button
          type="button"
          onClick={onToggle}
          disabled={disabled}
          aria-label={hasSelection ? `Select deals, ${count} selected` : 'Select deals'}
          aria-pressed={selecting}
          title="Select deals"
          className={`flex h-full items-center px-3.5! ${split ? 'rounded-l-lg' : 'rounded-lg'}`}
        >
          <span className="hidden tabular-nums sm:inline">
            Select{hasSelection ? ` (${count})` : ''}
          </span>
        </button>
        {split && (
          <>
            <span aria-hidden className={`h-5 w-px shrink-0 ${selecting ? 'bg-white/35' : 'bg-ink-3/40'}`} />
            <button
              type="button"
              onClick={() => setOpen((next) => !next)}
              aria-label="Selection actions"
              aria-haspopup="menu"
              aria-expanded={open}
              aria-controls={open ? menuId : undefined}
              className="flex h-full items-center rounded-r-lg px-2"
            >
              <ChevronDown
                size={16}
                strokeWidth={2}
                aria-hidden
                className={`transition-transform duration-press ${open ? 'rotate-180' : ''}`}
              />
            </button>
          </>
        )}
      </div>
      {split && open && (
        <ul
          id={menuId}
          role="menu"
          aria-label="Selection actions"
          className="absolute right-0 z-30 mt-1 w-44 rounded-lg bg-surface py-1 shadow-dialog"
        >
          {[
            ...(onTransfer
              ? [
                  { label: 'Move to pipeline', onSelect: () => onTransfer('move') },
                  { label: 'Add to pipeline', onSelect: () => onTransfer('copy') },
                ]
              : []),
            { label: 'Delete', onSelect: onDelete },
          ].map(({ label, onSelect }) => (
            <li key={label} role="none">
              <button
                type="button"
                role="menuitem"
                onClick={
                  onSelect &&
                  (() => {
                    setOpen(false)
                    onSelect()
                  })
                }
                className="flex w-full items-center px-3 py-2 text-left text-body text-ink-2 hover:bg-surface-hover hover:text-ink"
              >
                {label}
              </button>
            </li>
          ))}
          <li role="separator" className="my-1 border-t border-line" />
          <li role="none">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onClear()
                setOpen(false)
              }}
              className="flex w-full items-center px-3 py-2 text-left text-body font-medium text-danger hover:bg-danger-soft"
            >
              Clear selection
            </button>
          </li>
        </ul>
      )}
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
