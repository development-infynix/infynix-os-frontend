import {
  ArrowLeftRight,
  CreditCard,
  Layers,
  ListChecks,
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
  onSelect?: (key: CrmActionKey) => void
}

/** The Actions tab: one card per pipeline setting. */
export function CrmActions({ pipelineName, onSelect }: CrmActionsProps) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3" aria-label="Pipeline actions">
      {ACTIONS.map((action) => (
        <li key={action.key} className="flex">
          <ActionCard action={action} pipelineName={pipelineName} onSelect={onSelect} />
        </li>
      ))}
    </ul>
  )
}

function ActionCard({
  action,
  pipelineName,
  onSelect,
}: {
  action: CrmAction
  pipelineName: string
  onSelect?: (key: CrmActionKey) => void
}) {
  const Icon = action.icon
  const body = (
    <>
      <div className="flex items-start gap-3.5">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-secondary-soft text-secondary-text">
          <Icon size={19} strokeWidth={2} aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="text-title font-semibold tracking-title text-ink">{action.title}</h2>
          <p className="mt-1 text-label text-ink-2">{action.description}</p>
        </div>
      </div>
      {action.scoped && (
        <span className="mt-4 self-end rounded-md bg-surface-hover px-2 py-0.5 text-caption font-medium text-ink-2">
          {pipelineName}
        </span>
      )}
    </>
  )
  const card = 'flex min-h-36 w-full flex-col justify-between rounded-xl bg-surface p-5 text-left shadow-lift'

  // Not wired yet: plain cards until each action has its drawer.
  if (!onSelect) return <div className={card}>{body}</div>
  return (
    <button
      type="button"
      onClick={() => onSelect(action.key)}
      className={`${card} transition-colors duration-press hover:bg-surface-hover/50`}
    >
      {body}
    </button>
  )
}
