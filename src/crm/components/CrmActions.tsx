import { useEffect, useRef, useState } from 'react'
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
  | 'assign-users'
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
    key: 'assign-users',
    title: 'Assign users',
    description: 'Manage pipeline access and choose a deal assignment method.',
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
  /** Owners and managers get the create-pipeline entry point. */
  canManage?: boolean
  onCreatePipeline?: () => void
}

/** The Actions tab: one card per pipeline setting. */
export function CrmActions({ pipelineName, canManage = false, onCreatePipeline }: CrmActionsProps) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3" aria-label="Pipeline actions">
      {ACTIONS.map((action) => (
        <li key={action.key} className="flex">
          <ActionCard
            action={action}
            pipelineName={pipelineName}
            onCreatePipeline={
              canManage && action.key === 'manage-pipeline' ? onCreatePipeline : undefined
            }
          />
        </li>
      ))}
    </ul>
  )
}

function ActionCard({
  action,
  pipelineName,
  onCreatePipeline,
}: {
  action: CrmAction
  pipelineName: string
  onCreatePipeline?: () => void
}) {
  const Icon = action.icon
  return (
    <div className="relative flex min-h-36 w-full flex-col justify-between rounded-xl bg-surface p-5 text-left shadow-lift">
      {onCreatePipeline && <PipelineMenu onCreatePipeline={onCreatePipeline} />}
      <div className="flex items-start gap-3.5">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-secondary-soft text-secondary-text">
          <Icon size={19} strokeWidth={2} aria-hidden />
        </span>
        <div className="min-w-0 pr-7">
          <h2 className="text-title font-semibold tracking-title text-ink">{action.title}</h2>
          <p className="mt-1 text-label text-ink-2">{action.description}</p>
        </div>
      </div>
      {action.scoped && (
        <span className="mt-4 self-end rounded-md bg-surface-hover px-2 py-0.5 text-caption font-medium text-ink-2">
          {pipelineName}
        </span>
      )}
    </div>
  )
}

/** The card's top-right menu: manage is still to come; create opens the wizard. */
function PipelineMenu({ onCreatePipeline }: { onCreatePipeline: () => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

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
    <div ref={ref} className="absolute top-3 right-3">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Pipeline options"
        title="Pipeline options"
        className="grid size-8 place-items-center rounded-md text-ink-3 transition-colors duration-press hover:bg-surface-hover hover:text-ink"
      >
        <MoreVertical size={17} strokeWidth={2} aria-hidden />
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Pipeline options"
          className="absolute top-full right-0 z-30 mt-1 w-48 rounded-lg bg-surface py-1 shadow-dialog"
        >
          <button
            type="button"
            role="menuitem"
            disabled
            className="flex w-full cursor-not-allowed items-center gap-2.5 px-3 py-2 text-left text-label text-ink-3 opacity-60"
          >
            <SlidersHorizontal size={15} strokeWidth={2} aria-hidden />
            <span className="flex-1">Manage pipeline</span>
            <span className="rounded bg-surface-hover px-1.5 py-0.5 text-micro font-medium">Soon</span>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              onCreatePipeline()
            }}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-label text-ink hover:bg-surface-hover"
          >
            <Plus size={15} strokeWidth={2} aria-hidden />
            Create pipeline
          </button>
        </div>
      )}
    </div>
  )
}
