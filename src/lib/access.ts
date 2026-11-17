import { queryOptions } from '@tanstack/react-query'
import { redirect } from '@tanstack/react-router'
import { api } from './api'
import type { Session } from './auth'

export type AccessKind = 'menu' | 'action'

/** One grantable thing: a sidebar menu now, an action later. */
export interface AccessItem {
  id: string
  key: string
  label: string
  kind: AccessKind
  sortOrder: number
  isActive: boolean
}

export interface MemberAccess {
  items: AccessItem[]
  accessKeys: string[]
}

/** One person's menus, fresh from the server. */
export const memberAccessQuery = (id: string) =>
  queryOptions({
    queryKey: ['access', 'member', id],
    queryFn: () => api<MemberAccess>(`/members/${id}/access`),
    enabled: !!id,
  })

/** Replaces someone's menus with exactly `accessKeys`. */
export const setMemberAccess = (id: string, accessKeys: string[]) =>
  api<MemberAccess>(`/members/${id}/access`, {
    method: 'PUT',
    body: JSON.stringify({ accessKeys }),
  })

/** Owners hold every menu; everyone else holds only what they were granted. */
export function hasAccess(session: Session | null | undefined, key: string): boolean {
  if (!session) return false
  return session.user.role === 'owner' || (session.access?.includes(key) ?? false)
}

/** Route guard: send a person home when the menu wasn't granted. */
export function requireAccess(session: Session, key: string): void {
  if (!hasAccess(session, key)) throw redirect({ to: '/' })
}
