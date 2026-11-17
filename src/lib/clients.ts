import { keepPreviousData, queryOptions } from '@tanstack/react-query'
import { api } from './api'

export interface Client {
  id: string
  name: string
  email: string | null
  phone: string | null
  customDetails: Record<string, string | number | boolean | null>
  createdAt: string
  updatedAt: string
}

/** Rows per page of the clients table (the server caps it at 100). */
export const CLIENTS_PAGE_SIZE = 100

/** Every page of the client list: invalidate this after any change. */
export const CLIENTS_KEY = ['clients'] as const

export interface ClientsPage {
  items: Client[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

/** One page of the client directory. The next page stays on screen while it loads. */
export const clientsPageQuery = (page: number, q = '') =>
  queryOptions({
    queryKey: [...CLIENTS_KEY, 'page', page, q],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), pageSize: String(CLIENTS_PAGE_SIZE) })
      if (q) params.set('q', q)
      return api<ClientsPage>(`/clients?${params.toString()}`)
    },
    placeholderData: keepPreviousData,
  })

/** One client, fresh from the server (the details drawer reads this). */
export const clientQuery = (id: string) =>
  queryOptions({
    queryKey: [...CLIENTS_KEY, 'one', id],
    queryFn: () => api<Client>(`/clients/${id}`),
    retry: false,
  })

export interface ClientInput {
  name: string
  email?: string | null
  phone?: string | null
  customDetails?: Client['customDetails']
}

export interface CustomDetailRow {
  key: string
  value: string
}

const blankDetailRow = (): CustomDetailRow => ({ key: '', value: '' })

export const withBlankDetailRow = (rows: CustomDetailRow[]) =>
  rows.some((row) => !row.key.trim()) ? rows : [...rows, blankDetailRow()]

export const emptyDetailRows = (): CustomDetailRow[] => [blankDetailRow()]

export function detailsToRows(details: Client['customDetails']): CustomDetailRow[] {
  return withBlankDetailRow(
    Object.entries(details).map(([key, value]) => ({ key, value: value == null ? '' : String(value) })),
  )
}

export function rowsToDetails(rows: CustomDetailRow[]): Client['customDetails'] {
  const details: Client['customDetails'] = {}
  for (const row of rows) {
    const key = row.key.trim()
    if (key) details[key] = row.value.trim()
  }
  return details
}

/** Whether a client has an email or phone on file. */
export const hasContact = (client: Client) => Boolean(client.email?.trim() || client.phone?.trim())

export const addClient = (input: ClientInput) =>
  api<Client>('/clients', { method: 'POST', body: JSON.stringify(input) })

export const updateClient = (id: string, patch: Partial<ClientInput>) =>
  api<Client>(`/clients/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })

/** One chunk of an import, at most 100 rows. */
export const importClientsChunk = (clients: ClientInput[]) =>
  api<{ created: number; skipped: number }>('/clients/import', {
    method: 'POST',
    body: JSON.stringify({ clients }),
  })

export const removeClient = (id: string) => api<void>(`/clients/${id}`, { method: 'DELETE' })
