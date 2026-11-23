import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createReport, listReports } from '../api'
import { Button } from '@/components/Button'
import { Loader } from '@/components/Loader'

export function ReportsPage() {
  const queryClient = useQueryClient()
  const { data, isPending, isError } = useQuery({
    queryKey: ['reports', 1],
    queryFn: () => listReports(1),
  })

  const [open, setOpen] = useState(false)
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [items, setItems] = useState('')
  const [url, setUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setError(null)
    setSaving(true)
    try {
      await createReport({
        reportDate: date,
        reports: items.split('\n').map((s) => s.trim()).filter(Boolean),
        attachmentMode: url.trim() ? 'url' : 'none',
        attachmentUrl: url.trim() || undefined,
      })
      await queryClient.invalidateQueries({ queryKey: ['reports'] })
      setOpen(false)
      setItems('')
      setUrl('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create report')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex w-full flex-col px-5 pt-8 pb-24 sm:min-h-0 sm:flex-1 sm:px-10 sm:py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-[26px] font-semibold tracking-tight text-ink">Reports</h1>
        <Button onClick={() => setOpen((v) => !v)}>New report</Button>
      </div>

      {open && (
        <div className="mt-6 rounded-xl bg-paper p-4 space-y-3">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-10 w-full rounded-lg bg-paper px-3 text-sm text-ink ring-1 ring-hairline-strong"
          />
          <textarea
            value={items}
            onChange={(e) => setItems(e.target.value)}
            placeholder="One report point per line"
            rows={5}
            className="w-full rounded-lg bg-paper px-3 py-2 text-sm text-ink ring-1 ring-hairline-strong"
          />
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Attachment URL (optional)"
            className="h-10 w-full rounded-lg bg-paper px-3 text-sm text-ink ring-1 ring-hairline-strong"
          />
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex gap-2">
            <Button onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Submit'}</Button>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {isPending ? (
        <div className="mt-6"><Loader /></div>
      ) : isError ? (
        <p className="mt-6 text-sm text-danger">Unable to load reports.</p>
      ) : data && data.items.length === 0 ? (
        <p className="mt-6 text-sm text-ink-3">No reports yet.</p>
      ) : (
        <ul className="mt-6 divide-y divide-hairline rounded-xl bg-paper">
          {data?.items.map((r) => (
            <li key={r.id} className="px-4 py-3 text-sm text-ink">
              <span className="font-medium">{r.reportDate}</span>
              <span className="ml-2 text-ink-3">{r.createdByUsername ?? ''}</span>
              <ul className="mt-1 list-disc pl-5 text-ink-2">
                {r.reports.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
