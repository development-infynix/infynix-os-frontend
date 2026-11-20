import { infiniteQueryOptions, keepPreviousData, queryOptions } from '@tanstack/react-query'
import { api } from './api'

export interface Client {
  id: string
  name: string
  email: string | null
  phone: string | null
  customDetails: Record<string, string | number | boolean | null>
  importId: string | null
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
export const clientsPageQuery = (page: number, q = '', importId: string | null = null) =>
  queryOptions({
    queryKey: [...CLIENTS_KEY, 'page', page, q, importId],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), pageSize: String(CLIENTS_PAGE_SIZE) })
      if (q) params.set('q', q)
      if (importId) params.set('importId', importId)
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

export interface ClientImport {
  id: string
  name: string
  fileName: string
  rowCount: number
  createdCount: number
  skippedCount: number
  createdAt: string
}

export interface ClientImportInput {
  name: string
  fileName: string
  rowCount: number
}

/** Every client import: invalidate this after creating an import. */
export const CLIENT_IMPORTS_KEY = ['client-imports'] as const

/** The import history shown on the Imports tab. */
export const clientImportsQuery = () =>
  queryOptions({
    queryKey: [...CLIENT_IMPORTS_KEY, 'list'],
    queryFn: () => api<ClientImport[]>('/client-imports'),
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

/** Starts an import so its chunks can be filed against it. */
export const createClientImport = (input: ClientImportInput) =>
  api<ClientImport>('/client-imports', { method: 'POST', body: JSON.stringify(input) })

/** Most rows one import request takes (the endpoint's maximum, and the whole-file cap). */
export const IMPORT_CHUNK_ROWS = 500
/**
 * Most JSON one import request carries. The server refuses bodies over 1 MB
 * (Fastify's default); half that leaves room for the wrapper and any
 * underestimate. Custom details have no size cap, so wide spreadsheets hit this
 * before the row limit.
 */
export const IMPORT_CHUNK_BYTES = 512 * 1024

/**
 * Splits import rows into requests by size: up to IMPORT_CHUNK_ROWS rows, but a
 * new chunk starts once the next row would take it past IMPORT_CHUNK_BYTES. A
 * narrow 500-row file goes in one request; a wide one in a few. Order is kept.
 */
export function chunkImportRows(rows: ClientInput[]): ClientInput[][] {
  const encoder = new TextEncoder()
  const chunks: ClientInput[][] = []
  let current: ClientInput[] = []
  let bytes = 0
  for (const row of rows) {
    const size = encoder.encode(JSON.stringify(row)).length + 1 // + the comma between rows
    if (current.length && (current.length >= IMPORT_CHUNK_ROWS || bytes + size > IMPORT_CHUNK_BYTES)) {
      chunks.push(current)
      current = []
      bytes = 0
    }
    current.push(row)
    bytes += size
  }
  if (current.length) chunks.push(current)
  return chunks
}

/** One chunk of an import: build chunks with chunkImportRows. */
export const importClientsChunk = (importId: string, clients: ClientInput[]) =>
  api<{ created: number; skipped: number }>('/clients/import', {
    method: 'POST',
    body: JSON.stringify({ importId, clients }),
  })

export const renameClientImport = (id: string, name: string) =>
  api<ClientImport>(`/client-imports/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  })

/** Clients removed per request when deleting a large import (the endpoint's maximum). */
export const IMPORT_DELETE_CHUNK = 500

export const deleteImportClientChunk = (id: string, limit = IMPORT_DELETE_CHUNK) =>
  api<{ deleted: number; remaining: number }>(`/client-imports/${id}/clients?limit=${limit}`, {
    method: 'DELETE',
  })

export const deleteClientImport = (id: string) =>
  api<void>(`/client-imports/${id}`, { method: 'DELETE' })

export const removeClient = (id: string) => api<void>(`/clients/${id}`, { method: 'DELETE' })

export const removeClients = (ids: string[]) =>
  api<{ deleted: number }>('/clients', { method: 'DELETE', body: JSON.stringify({ ids }) })

/** The bulk-delete endpoint takes at most 500 ids, so larger selections go in chunks. */
const DELETE_CHUNK = 500

/** Deletes any number of clients, one request per 500, one after another. */
export async function removeClientsInChunks(ids: string[]): Promise<number> {
  let deleted = 0
  for (let index = 0; index < ids.length; index += DELETE_CHUNK) {
    deleted += (await removeClients(ids.slice(index, index + DELETE_CHUNK))).deleted
  }
  return deleted
}

/** Every client id from one import, for "Select imports" (cached briefly; imports rarely change). */
export const clientImportIdsQuery = (importId: string) =>
  queryOptions({
    queryKey: [...CLIENTS_KEY, 'import-ids', importId],
    queryFn: () =>
      api<{ ids: string[] }>(`/clients/ids?${new URLSearchParams({ importId }).toString()}`).then(
        (result) => result.ids,
      ),
    staleTime: 30_000,
  })

export interface ClientImportsSearchPage {
  items: ClientImport[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

export const IMPORTS_SEARCH_PAGE_SIZE = 20

/**
 * Imports that still have clients, searched and paged on the server ("Load
 * more"). `session` is part of the key so each opening of the list starts a
 * fresh fetch from page 1; nothing is kept once it closes (gcTime 0).
 */
export const clientImportsSearchQuery = (q: string, session: number) =>
  infiniteQueryOptions({
    queryKey: [...CLIENT_IMPORTS_KEY, 'search', q, session],
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({
        page: String(pageParam),
        pageSize: String(IMPORTS_SEARCH_PAGE_SIZE),
        withClients: 'true',
      })
      if (q) params.set('q', q)
      return api<ClientImportsSearchPage>(`/client-imports/search?${params.toString()}`)
    },
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    staleTime: 0,
    gcTime: 0,
    placeholderData: keepPreviousData,
  })
