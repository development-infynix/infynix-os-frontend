import type { BoardColumns, CrmDeal, CrmPipeline } from './types'

/*
 * Dummy pipelines and deals so the CRM UI can be tried before the backend
 * exists. Deterministic: the same cards appear on every reload. Delete this
 * file once the board reads from /api/v1/crm.
 */

const FIRST = [
  'Gokul', 'Keerthi', 'Anjali', 'Rahul', 'Meera', 'Arjun', 'Divya', 'Nikhil', 'Sneha', 'Vishnu',
  'Lakshmi', 'Aditya', 'Fathima', 'Joel', 'Priya', 'Sanjay', 'Aisha', 'Rohan', 'Nandana', 'Kiran',
]
const LAST = ['Nair', 'Kurup', 'Mathew', 'Menon', 'Pillai', 'Varghese', 'Thomas', 'Iyer', 'Rao', 'Joseph', 'Das', 'Khan']

const DAY = 24 * 60 * 60 * 1000
const BASE = Date.UTC(2026, 10, 18)

function makeDeal(seed: number, prefix: string): CrmDeal {
  const first = FIRST[seed % FIRST.length]
  const last = LAST[(seed * 7) % LAST.length]
  const digits = String(9_000_000_000 + ((seed * 7_919_317) % 999_999_999)).padStart(10, '0')
  return {
    id: `${prefix}-deal-${seed}`,
    name: `${first} ${last}`,
    // Every third deal has no phone, every fifth no email: both card layouts show up.
    phone: seed % 3 === 2 ? null : `+91${digits}`,
    email: seed % 5 === 4 ? null : `${first}.${last}${(seed * 37) % 900}@gmail.com`.toLowerCase(),
    addedAt: new Date(BASE - (seed % 21) * DAY).toISOString(),
  }
}

function makeColumns(pipeline: CrmPipeline, counts: number[]): BoardColumns {
  let seed = pipeline.id.length * 11
  return Object.fromEntries(
    pipeline.stages.map((stage, index) => [
      stage.id,
      Array.from({ length: counts[index] ?? 0 }, () => makeDeal(seed++, pipeline.id)),
    ]),
  )
}

export const DUMMY_PIPELINES: CrmPipeline[] = [
  {
    id: 'sales',
    name: 'Sales',
    stages: [
      { id: 'sales-lead-in', name: 'Lead In' },
      { id: 'sales-qualified', name: 'Qualified' },
      { id: 'sales-proposal', name: 'Proposal' },
      { id: 'sales-negotiation', name: 'Negotiation' },
      { id: 'sales-won', name: 'Won' },
      { id: 'sales-lost', name: 'Lost' },
    ],
  },
  {
    id: 'partners',
    name: 'Partnerships',
    stages: [
      { id: 'partners-intro', name: 'Intro call' },
      { id: 'partners-review', name: 'Review' },
      { id: 'partners-signed', name: 'Signed' },
    ],
  },
  {
    id: 'renewals',
    name: 'Renewals',
    stages: [
      { id: 'renewals-due', name: 'Due' },
      { id: 'renewals-contacted', name: 'Contacted' },
      { id: 'renewals-renewed', name: 'Renewed' },
      { id: 'renewals-churned', name: 'Churned' },
    ],
  },
]

/** Initial cards per pipeline id. Some stages are empty on purpose. */
export const DUMMY_BOARDS: Record<string, BoardColumns> = {
  sales: makeColumns(DUMMY_PIPELINES[0], [14, 6, 4, 0, 2, 0]),
  partners: makeColumns(DUMMY_PIPELINES[1], [3, 2, 0]),
  renewals: makeColumns(DUMMY_PIPELINES[2], [0, 0, 0, 0]),
}
