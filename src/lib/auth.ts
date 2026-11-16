import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import { api, ApiError } from './api'

export type MemberRole = 'owner' | 'manager' | 'staff'

export interface User {
  id: string
  email: string
  fullName: string
  tenantId: string
  role: MemberRole
  isPlatformAdmin: boolean
  isActive: boolean
  emailVerified: boolean
  lastLoginAt: string | null
  createdAt: string
  updatedAt: string
}

export interface Tenant {
  id: string
  name: string
  status: 'active' | 'suspended'
  plan: string
  createdAt: string
}

/** The signed-in person and their company. */
export interface Session {
  user: User
  tenant: Tenant
}

export const ROLE_LABEL: Record<MemberRole, string> = {
  owner: 'Owner',
  manager: 'Manager',
  staff: 'Staff',
}

/** The current session, or `null` when there is no valid session. */
export const sessionQuery = queryOptions({
  queryKey: ['auth', 'session'],
  queryFn: async (): Promise<Session | null> => {
    try {
      return await api<Session>('/auth/me')
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return null
      throw error
    }
  },
  staleTime: 60_000,
})

/** The session inside signed-in routes (the route guard guarantees it). */
export function useSession(): Session {
  const { data } = useSuspenseQuery(sessionQuery)
  if (!data) throw new Error('useSession is only available on signed-in routes')
  return data
}

/** Only owners see and use the Admin area. */
export const canAdminister = (role: MemberRole) => role === 'owner'

export function signIn(email: string, password: string): Promise<Session> {
  return api<Session>('/auth/sign-in', { method: 'POST', body: JSON.stringify({ email, password }) })
}

export interface SignUpInput {
  companyName: string
  fullName: string
  email: string
  password: string
}

export function signUp(input: SignUpInput): Promise<Session> {
  return api<Session>('/auth/sign-up', { method: 'POST', body: JSON.stringify(input) })
}

export function signOut(): Promise<void> {
  return api<void>('/auth/sign-out', { method: 'POST' })
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts.at(-1)![0] : '')).toUpperCase()
}

/** Changes the signed-in person's own name. */
export function updateMyName(fullName: string): Promise<{ user: User }> {
  return api<{ user: User }>('/auth/me', { method: 'PATCH', body: JSON.stringify({ fullName }) })
}

/**
 * Changes the signed-in person's own password. The server checks the current
 * one, signs out their other devices and keeps this browser signed in.
 */
export function changeMyPassword(currentPassword: string, newPassword: string): Promise<void> {
  return api<void>('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  })
}
