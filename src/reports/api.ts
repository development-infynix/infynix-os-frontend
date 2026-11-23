import { api } from '@/lib/api'

export interface ReportAttachment {
  type: 'url'
  url: string
}

export interface Report {
  id: string
  reportDate: string
  reports: string[]
  createdBy: string | null
  createdByUsername: string | null
  submittedAt: string
  updatedAt: string
  editedAt: string | null
  attachment: ReportAttachment | null
  remarks: string | null
}

export interface ReportSettings {
  dueTime: string | null
  skipDays: number[]
  timezone: string
  updatedAt: string | null
}

export interface ReportListResponse {
  items: Report[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  date: string | null
  userId: string | null
}

export async function listReports(page = 1, date?: string, userId?: string): Promise<ReportListResponse> {
  const params = new URLSearchParams({ page: String(page), limit: '100' })
  if (date) params.set('date', date)
  if (userId) params.set('userId', userId)
  return api<ReportListResponse>(`/reports?${params.toString()}`)
}

export async function getReport(id: string): Promise<Report> {
  return api<Report>(`/reports/${id}`)
}

export async function createReport(body: {
  reportDate: string
  reports: string[]
  attachmentMode: 'none' | 'url'
  attachmentUrl?: string
}): Promise<Report> {
  return api<Report>('/reports', { method: 'POST', body: JSON.stringify(body) })
}

export async function updateReport(id: string, body: {
  reportDate: string
  reports: string[]
  attachmentMode: 'keep' | 'none' | 'url'
  attachmentUrl?: string
}): Promise<Report> {
  return api<Report>(`/reports/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
}

export async function updateReportRemarks(id: string, remarks: string | null): Promise<Report> {
  return api<Report>(`/reports/${id}/remarks`, { method: 'PATCH', body: JSON.stringify({ remarks }) })
}

export async function deleteReport(id: string): Promise<void> {
  await api<void>(`/reports/${id}`, { method: 'DELETE' })
}

export async function getReportSettings(): Promise<ReportSettings> {
  return api<ReportSettings>('/reports/settings')
}

export async function updateReportSettings(settings: { dueTime: string | null; skipDays: number[] }): Promise<ReportSettings> {
  return api<ReportSettings>('/reports/settings', { method: 'PATCH', body: JSON.stringify(settings) })
}
