import { useEffect, useId, useRef, useState } from 'react'
import {
  ArrowLeftRight,
  CreditCard,
  Layers,
  ListChecks,
  MoreVertical,
  Plus,
  SlidersHorizontal,
  Users,
  type LucideIcon,
} from 'lucide-react'

export type CrmActionKey =
  | 'manage-pipeline'
  | 'manage-stages'
  | 'assign-deals'
  | 'deal-transfer'
  | 'payment-actions'
  | 'qualification-actions'

interface CrmAction {
  key: CrmActionKey
  title: string
  description: string
  icon: LucideIcon
  /** Works on the selected pipeline, so the card names it. */
  scoped: boolean
}

const ACTIONS: CrmAction[] = [
  {
    key: 'manage-pipeline',
    title: 'Manage pipeline',
    description: 'Create, edit, or delete pipelines.',
    icon: SlidersHorizontal,
    scoped: false,
  },
  {
    key: 'manage-stages',
    title: 'Manage stages',
    description: 'Create, edit, or delete stages in the current pipeline.',
    icon: Layers,
    scoped: true,
  },
  {
    key: 'assign-deals',
    title: 'Assign deals',
    description: 'Choose how deals in this pipeline are assigned.',
    icon: Users,
    scoped: true,
  },
  {
    key: 'deal-transfer',
    title: 'Deal transfer',
    description: 'Move or copy deals between pipelines.',
    icon: ArrowLeftRight,
    scoped: true,
  },
  {
    key: 'payment-actions',
    title: 'Payment actions',
    description: 'Enable payment-related actions in the current pipeline.',
    icon: CreditCard,
    scoped: true,
  },
  {
    key: 'qualification-actions',
    title: 'Qualification actions',
    description: 'Set up how deals are qualified in the current pipeline.',
    icon: ListChecks,
    scoped: true,
  },
]

interface CrmActionsProps {
  /** The selected pipeline's name, tagged on the cards that act on it. */
  pipelineName: string
  /** Owners and managers get the Manage / Create menu on the Manage pipeline card. */
  canManage?: boolean
  onManagePipelines?: () => void
  onCreatePipeline?: () => void
  /** Opens the stage drawer for the selected pipeline; absent when unavailable. */
  onManageStages?: () => void
  /** False when there are no pipelines yet: Manage has nothing to manage. */
  hasPipelines?: boolean
}

/** The Manage pipeline card's menu actions. */
interface PipelineMenuActions {
  onManage: () => void
  onCreate: () => void
  /** Manage is disabled until a pipeline exists. */
  canManageExisting: boolean
}

/** The Actions tab: one card per pipeline setting. */
export function CrmActions({
  pipelineName,
  canManage = false,
  onManagePipelines,
  onCreatePipeline,
  onManageStages,
  hasPipelines = false,
}: CrmActionsProps) {
  const pipelineMenu =
    canManage && onManagePipelines && onCreatePipeline
      ? { onManage: onManagePipelines, onCreate: onCreatePipeline, canManageExisting: hasPipelines }
      : undefined
  return (
    <ul className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3" aria-label="Pipeline actions">
      {ACTIONS.map((action) => (
        <li key={action.key} className="flex">
          <ActionCard
            action={action}
            pipelineName={pipelineName}
            pipelineMenu={action.key === 'manage-pipeline' ? pipelineMenu : undefined}
            onClick={action.key === 'manage-stages' ? onManageStages : undefined}
          />
        </li>
      ))}
    </ul>
  )
}

function ActionCard({
  action,
  pipelineName,
  pipelineMenu,
  onClick,
}: {
  action: CrmAction
  pipelineName: string
  pipelineMenu?: PipelineMenuActions
  onClick?: () => void
}) {
  if (pipelineMenu) {
    return <PipelineMenuCard action={action} pipelineName={pipelineName} menu={pipelineMenu} />
  }
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="card-3d relative flex min-h-36 w-full flex-col justify-between rounded-xl p-5 text-left"
      >
        <ActionCardBody action={action} pipelineName={pipelineName} />
      </button>
    )
  }
  return (
    <div className="card-3d relative flex min-h-36 w-full flex-col justify-between rounded-xl p-5 text-left">
      <ActionCardBody action={action} pipelineName={pipelineName} />
    </div>
  )
}

function ActionCardBody({
  action,
  pipelineName,
  reserveCorner = false,
}: {
  action: CrmAction
  pipelineName: string
  /** Inside the menu button: leaves room for the kebab icon and uses spans only. */
  reserveCorner?: boolean
}) {
  const Icon = action.icon
  // Inside the menu button only phrasing content is valid, so the same layout is built from spans.
  const Row = reserveCorner ? 'span' : 'div'
  const Title = reserveCorner ? 'span' : 'h2'
  const Text = reserveCorner ? 'span' : 'p'
  return (
    <>
      <Row className="flex items-start gap-3.5">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-secondary-soft text-secondary-text">
          <Icon size={19} strokeWidth={2} aria-hidden />
        </span>
        <Row className={`block min-w-0 ${reserveCorner ? 'pr-7' : ''}`}>
          <Title className="block text-title font-semibold tracking-title text-ink">{action.title}</Title>
          <Text className="mt-1 block text-label text-ink-2">{action.description}</Text>
        </Row>
      </Row>
      {action.scoped && (
        <span className="mt-4 self-end rounded-md bg-surface-hover px-2 py-0.5 text-caption font-medium text-ink-2">
          {pipelineName}
        </span>
      )}
    </>
  )
}

/**
 * The Manage pipeline card for owners and managers: the whole card is the
 * menu button (the kebab is only a hint), and the menu opens from its corner.
 * Manage is still to come; Create opens the add-pipeline drawer.
 */
function PipelineMenuCard({
  action,
  pipelineName,
  menu,
}: {
  action: CrmAction
  pipelineName: string
  menu: PipelineMenuActions
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const manageRef = useRef<HTMLButtonElement>(null)
  const createRef = useRef<HTMLButtonElement>(null)
  const menuId = useId()
  const canManageExisting = menu.canManageExisting

  useEffect(() => {
    if (!open) return
    // Focus the first item you can use, as a menu should.
    ;(canManageExisting ? manageRef : createRef).current?.focus()
    const onPointerDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      triggerRef.current?.focus()
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, canManageExisting])

  return (
    <div ref={ref} className="relative flex w-full">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        className="card-3d group relative flex min-h-36 w-full flex-col justify-between rounded-xl p-5 text-left"
      >
        <span
          aria-hidden
          className={`absolute top-3 right-3 grid size-8 place-items-center rounded-md transition-colors duration-press group-hover:text-ink ${
            open ? 'bg-surface-hover text-ink' : 'text-ink-3'
          }`}
        >
          <MoreVertical size={17} strokeWidth={2} />
        </span>
        <ActionCardBody action={action} pipelineName={pipelineName} reserveCorner />
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="Pipeline options"
          className="absolute top-12 right-3 z-30 w-48 rounded-lg bg-surface py-1 shadow-dialog"
        >
          <button
            ref={manageRef}
            type="button"
            role="menuitem"
            disabled={!menu.canManageExisting}
            title={menu.canManageExisting ? undefined : 'No pipelines to manage yet'}
            onClick={() => {
              // Focus the card first: this item is about to unmount, and the drawer
              // returns focus to whatever had it when it opened.
              triggerRef.current?.focus()
              setOpen(false)
              menu.onManage()
            }}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-label text-ink hover:bg-surface-hover disabled:cursor-not-allowed disabled:text-ink-3 disabled:opacity-60 disabled:hover:bg-transparent"
          >
            <SlidersHorizontal size={15} strokeWidth={2} aria-hidden />
            Manage
          </button>
          <button
            ref={createRef}
            type="button"
            role="menuitem"
            onClick={() => {
              triggerRef.current?.focus()
              setOpen(false)
              menu.onCreate()
            }}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-label text-ink hover:bg-surface-hover"
          >
            <Plus size={15} strokeWidth={2} aria-hidden />
            Create
          </button>
        </div>
      )}
    </div>
  )
}
