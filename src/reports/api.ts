import { keepPreviousData, queryOptions } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface Report {
  id: string
  /** Plain `YYYY-MM-DD`: the day the report covers. */
  reportDate: string
  reports: string[]
  /** Null when the author's account was deleted. */
  createdBy: string | null
  createdByName: string | null
  submittedAt: string
  updatedAt: string
  editedAt: string | null
  attachment: { type: 'url'; url: string } | null
  remarks: string | null
  /** Submitted after the due time on the day it covers. */
  late: boolean
}

export interface ReportsPage {
  items: Report[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

/** The company's Reports settings, plus today's status for the signed-in person. */
export interface ReportSettings {
  timezone: string
  /** `HH:MM`, or null when there's no due time. */
  dueTime: string | null
  /** 0 = Sunday … 6 = Saturday. */
  skipDays: number[]
  updatedAt: string | null
  /** Today's `YYYY-MM-DD` in the company's timezone. */
  today: string
  todayIsOffDay: boolean
  submittedToday: boolean
  editWindowMinutes: number
}

/** One day of the month view. Days with no reports are absent. */
export interface ReportDaySummary {
  date: string
  count: number
  late: number
  /** Whether the signed-in person filed that day. */
  mine: boolean
}

export interface ReportPerson {
  id: string
  fullName: string
  isActive: boolean
}

export interface ReportInput {
  reportDate: string
  reports: string[]
  attachmentMode: 'none' | 'url'
  attachmentUrl?: string
}

/** Rows per page of the reports table. */
export const REPORTS_PAGE_SIZE = 50

/** Everything under Reports (pages, single reports, settings): invalidate after any change. */
export const REPORTS_KEY = ['reports'] as const

export const reportsPageQuery = (page: number, date: string | null, userId: string | null) =>
  queryOptions({
    queryKey: [...REPORTS_KEY, 'page', page, date, userId],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: String(REPORTS_PAGE_SIZE) })
      if (date) params.set('date', date)
      if (userId) params.set('userId', userId)
      return api<ReportsPage>(`/reports?${params.toString()}`)
    },
    placeholderData: keepPreviousData,
  })

/** Per-day counts between two days (a month view's six weeks). */
export const reportCalendarQuery = (from: string, to: string, userId: string | null) =>
  queryOptions({
    queryKey: [...REPORTS_KEY, 'calendar', from, to, userId],
    queryFn: () => {
      const params = new URLSearchParams({ from, to })
      if (userId) params.set('userId', userId)
      return api<{ items: ReportDaySummary[] }>(`/reports/calendar?${params.toString()}`).then((r) => r.items)
    },
    placeholderData: keepPreviousData,
  })

/** One day's reports (everyone's, or one person's). */
export const reportsForDayQuery = (date: string, userId: string | null) =>
  queryOptions({
    queryKey: [...REPORTS_KEY, 'day', date, userId],
    queryFn: () => {
      const params = new URLSearchParams({ page: '1', limit: '100', date })
      if (userId) params.set('userId', userId)
      return api<ReportsPage>(`/reports?${params.toString()}`)
    },
  })

/** One report, fresh from the server (the drawer reads this). */
export const reportQuery = (id: string) =>
  queryOptions({
    queryKey: [...REPORTS_KEY, 'one', id],
    queryFn: () => api<Report>(`/reports/${id}`),
    retry: false,
  })

export const reportSettingsQuery = () =>
  queryOptions({
    queryKey: [...REPORTS_KEY, 'settings'],
    queryFn: () => api<ReportSettings>('/reports/settings'),
  })

/**
 * People for the person filter (owners and managers), searched on the server
 * by name or email, at most 20. `selected` always comes back first, so the
 * active filter can show its name.
 */
export const reportPeopleQuery = (query: string, selected: string | null) =>
  queryOptions({
    queryKey: [...REPORTS_KEY, 'people', query, selected],
    queryFn: () => {
      const params = new URLSearchParams({ limit: '20' })
      if (query) params.set('q', query)
      if (selected) params.set('selected', selected)
      return api<{ items: ReportPerson[] }>(`/reports/people?${params.toString()}`).then((r) => r.items)
    },
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })

export const createReport = (body: ReportInput) =>
  api<Report>('/reports', { method: 'POST', body: JSON.stringify(body) })

export const updateReport = (id: string, body: ReportInput) =>
  api<Report>(`/reports/${id}`, { method: 'PATCH', body: JSON.stringify(body) })

export const updateReportRemarks = (id: string, remarks: string | null) =>
  api<Report>(`/reports/${id}/remarks`, { method: 'PATCH', body: JSON.stringify({ remarks }) })

export const deleteReport = (id: string) => api<void>(`/reports/${id}`, { method: 'DELETE' })

export const updateReportSettings = (body: { timezone: string; dueTime: string | null; skipDays: number[] }) =>
  api<ReportSettings>('/reports/settings', { method: 'PATCH', body: JSON.stringify(body) })
