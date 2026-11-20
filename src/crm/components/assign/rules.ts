import type { AssignmentRule } from '../../types'

export const RULE_LABEL: Record<AssignmentRule, string> = {
  round_robin: 'Round robin',
  single_user: 'Single user',
  creator: 'Creator',
  manual: 'Manual',
}

/** The Deal assign tab's cards, in order, with what each rule does for new deals. */
export const RULES: { key: AssignmentRule; description: string }[] = [
  { key: 'round_robin', description: 'New deals go to the next person in turn.' },
  { key: 'single_user', description: 'Every new deal goes to one person.' },
  { key: 'creator', description: 'Whoever adds a deal owns it. Deals the Owner adds stay unassigned.' },
  { key: 'manual', description: 'New deals stay unassigned; pick owners in the deal drawer.' },
]
