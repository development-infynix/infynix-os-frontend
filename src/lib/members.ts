import { keepPreviousData, queryOptions } from '@tanstack/react-query'
import { api } from './api'
import type { MemberRole } from './auth'

export interface Member {
  id: string
  email: string
  fullName: string
  role: MemberRole
  isActive: boolean
  lastLoginAt: string | null
  createdAt: string
}

/** Rows per page of the users table (the server caps it at 100). */
export const MEMBERS_PAGE_SIZE = 50

/** Every page of the users list: invalidate this after any change. */
export const MEMBERS_KEY = ['members'] as const

export interface MembersPage {
  items: Member[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

/**
 * One page of the company's users, fetched from the server. While the next
 * page loads, the current one stays on screen instead of flashing empty.
 */
export const membersPageQuery = (page: number) =>
  queryOptions({
    queryKey: [...MEMBERS_KEY, page],
    queryFn: () => api<MembersPage>(`/members?page=${page}&pageSize=${MEMBERS_PAGE_SIZE}`),
    placeholderData: keepPreviousData,
  })

/**
 * Users whose name or email contains `query` (server-side, at most 20). Kept
 * under MEMBERS_KEY so edits elsewhere refresh open results too.
 */
export const searchMembersQuery = (query: string) =>
  queryOptions({
    queryKey: [...MEMBERS_KEY, 'search', query],
    queryFn: () =>
      api<{ items: Member[] }>(`/members/search?q=${encodeURIComponent(query)}&limit=20`).then((r) => r.items),
    enabled: query.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 10_000,
  })

/** One user, fresh from the server (the details drawer reads this). */
export const memberQuery = (id: string) =>
  queryOptions({
    queryKey: [...MEMBERS_KEY, 'one', id],
    queryFn: () => api<Member>(`/members/${id}`),
    retry: false,
  })

export interface NewMember {
  fullName: string
  email: string
  password: string
  role: MemberRole
}

export const addMember = (input: NewMember) =>
  api<Member>('/members', { method: 'POST', body: JSON.stringify(input) })

export const updateMember = (
  id: string,
  patch: { fullName?: string; email?: string; role?: MemberRole; isActive?: boolean },
) => api<Member>(`/members/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })

export const setMemberPassword = (id: string, password: string) =>
  api<void>(`/members/${id}/password`, { method: 'PUT', body: JSON.stringify({ password }) })

export const removeMember = (id: string) => api<void>(`/members/${id}`, { method: 'DELETE' })

/**
 * Roles the signed-in person may give: owners give manager or staff. The
 * owner role belongs to whoever signed the company up; there is one.
 */
export function assignableRoles(myRole: MemberRole): MemberRole[] {
  return myRole === 'owner' ? ['manager', 'staff'] : []
}

/** Whether the signed-in person may edit someone (owners only). */
export function canManage(myRole: MemberRole, _targetRole: MemberRole): boolean {
  return myRole === 'owner'
}
