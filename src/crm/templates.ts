export type PipelineTemplateKey = 'sales' | 'clients'

export interface PipelineTemplate {
  key: PipelineTemplateKey
  name: string
  description: string
  stages: string[]
}

/**
 * Starting boards for the create-pipeline wizard. Sales mirrors the backend's
 * default board; Clients follows the client lifecycle instead of a sale.
 */
export const PIPELINE_TEMPLATES: PipelineTemplate[] = [
  {
    key: 'sales',
    name: 'Sales',
    description: 'Track a lead from first contact through negotiation to won or lost.',
    stages: ['Lead In', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost'],
  },
  {
    key: 'clients',
    name: 'Clients',
    description: 'Follow a client from onboarding to an active, healthy relationship.',
    stages: ['New', 'Onboarding', 'Active', 'At Risk', 'Churned'],
  },
]

export function templateFor(key: PipelineTemplateKey): PipelineTemplate {
  return PIPELINE_TEMPLATES.find((template) => template.key === key) ?? PIPELINE_TEMPLATES[0]
}
