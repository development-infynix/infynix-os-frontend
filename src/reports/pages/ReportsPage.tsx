import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { Clock3, FilePlus2, Link2, MessageSquareText, SlidersHorizontal } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/Button'
import { Loader } from '@/components/Loader'
import { Pagination } from '@/components/Pagination'
import { useSession } from '@/lib/auth'
import { reportQuery, reportSettingsQuery, reportsPageQuery, type Report } from '../api'
import { ReportDrawer, type ReportDrawerState } from '../components/ReportDrawer'
import { DateFilter, PersonFilter } from '../components/ReportFilters'
import { ReportSettingsModal } from '../components/ReportSettingsModal'
import { ReportsEmpty } from '../components/ReportsEmpty'
import { formatDay, formatStamp, formatWeekday } from '../lib/format'

const route = getRouteApi('/_authed/reports')

const worksLabel = (n: number) => `${n} ${n === 1 ? 'work' : 'works'}`

/**
 * Daily work reports as a grid of cards, newest first. Everyone files their
 * own; owners and managers see the whole company's, filterable by person; the
 * owner adds remarks and sets the timezone, due time and off days.
 */
export function ReportsPage() {
  const { user } = useSession()
  const me = { id: user.id, role: user.role }
  const seesAll = user.role === 'owner' || user.role === 'manager'
  const isOwner = user.role === 'owner'

  const page = route.useSearch({ select: (s) => s.page ?? 1 })
  const date = route.useSearch({ select: (s) => s.date ?? null })
  const userId = route.useSearch({ select: (s) => (seesAll ? (s.userId ?? null) : null) })
  const navigate = route.useNavigate()

  // Both start at once: no waterfall.
  const settingsQuery = useQuery(reportSettingsQuery())
  const settings = settingsQuery.data
  const { data, isPending, isFetching, isError, isPlaceholderData, refetch } = useQuery(
    reportsPageQuery(page, date, userId),
  )
  const busy = isFetching && isPlaceholderData
  const filtered = Boolean(date || userId)

  const setSearch = (next: { page?: number; date?: string | null; userId?: string | null }) =>
    void navigate({
      search: {
        page: next.page ?? 1,
        date: (next.date === undefined ? date : next.date) ?? undefined,
        userId: (next.userId === undefined ? userId : next.userId) ?? undefined,
      },
    })

  // A page that no longer exists (its last report was deleted, or an old link): go to the last one.
  useEffect(() => {
    if (data && page > data.totalPages) {
      void navigate({
        search: { page: data.totalPages, date: date ?? undefined, userId: userId ?? undefined },
        replace: true,
      })
    }
  }, [data, page, date, userId, navigate])

  // The drawer: a new report, or one report loaded by id so it stays fresh after
  // an edit (the card's snapshot shows instantly meanwhile; a deleted one closes it).
  const [drawer, setDrawer] = useState<ReportDrawerState>(null)
  const viewingId = drawer?.kind === 'view' ? drawer.report.id : ''
  const viewingQuery = useQuery({ ...reportQuery(viewingId), enabled: !!viewingId })
  if (drawer?.kind === 'view' && viewingQuery.isError) setDrawer(null)
  const shown: ReportDrawerState =
    drawer?.kind === 'view' ? { kind: 'view', report: viewingQuery.data ?? drawer.report } : drawer
  const [settingsOpen, setSettingsOpen] = useState(false)

  const newReport = () => setDrawer({ kind: 'new' })

  return (
    <div className="flex w-full flex-col px-5 pb-32 sm:min-h-0 sm:flex-1 sm:px-10 sm:py-10">
      <h1 className="sr-only">Reports</h1>
      <div className="sticky top-header z-20 -mx-5 flex h-header items-center justify-end gap-2 border-b border-line bg-canvas/90 px-5 backdrop-blur-sm sm:static sm:mx-0 sm:h-auto sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        {seesAll && <PersonFilter value={userId} onChange={(id) => setSearch({ userId: id })} />}
        <DateFilter value={date} max={settings?.today} onChange={(d) => setSearch({ date: d })} />
        <Button
          variant="primary"
          onClick={newReport}
          disabled={!settings}
          aria-haspopup="dialog"
          aria-label="New report"
          title="New report"
          className="w-9 px-0! sm:w-auto sm:px-3.5!"
        >
          <FilePlus2 size={16} strokeWidth={2} className="shrink-0" aria-hidden />
          <span className="hidden sm:inline">New report</span>
        </Button>
        {isOwner && settings && (
          <Button
            variant="secondary"
            onClick={() => setSettingsOpen(true)}
            aria-haspopup="dialog"
            aria-label="Report settings"
            title="Report settings"
            className="w-9 px-0!"
          >
            <SlidersHorizontal size={16} strokeWidth={2} aria-hidden />
          </Button>
        )}
      </div>

      <div className="mt-5 flex min-h-[60vh] flex-col sm:flex-1">
        {isPending || busy ? (
          <div className="grid flex-1 place-items-center">
            <Loader label="Loading reports" />
          </div>
        ) : isError ? (
          <div className="grid flex-1 place-items-center px-4 text-center">
            <div>
              <p className="text-body text-ink-2">Couldn’t load reports.</p>
              <Button size="sm" variant="secondary" className="mt-3" onClick={() => void refetch()}>
                Try again
              </Button>
            </div>
          </div>
        ) : data.total === 0 ? (
          filtered ? (
            <ReportsEmpty
              title="No matching reports"
              description="Nothing was filed for this filter. Try another day or person."
              extra={
                <Button size="sm" variant="secondary" onClick={() => setSearch({ date: null, userId: null })}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <ReportsEmpty
              title="No reports yet"
              description={
                seesAll
                  ? 'Daily reports from your team will appear here as they’re filed.'
                  : 'File a report at the end of each day: what you worked on, one work at a time.'
              }
              onNew={settings ? newReport : undefined}
              newLabel="New report"
            />
          )
        ) : (
          <>
            <ul aria-busy={busy} className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {data.items.map((report) => (
                <li key={report.id} className="min-w-0">
                  <ReportCard report={report} seesAll={seesAll} onView={() => setDrawer({ kind: 'view', report })} />
                </li>
              ))}
            </ul>

            {data.totalPages > 1 && (
              <Pagination
                page={data.page}
                totalPages={data.totalPages}
                total={data.total}
                pageSize={data.pageSize}
                onPageChange={(next) => setSearch({ page: next })}
                busy={busy}
                noun={data.total === 1 ? 'report' : 'reports'}
                className="fixed inset-x-0 bottom-0 z-20 border-t border-line-strong bg-surface/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-sm sm:static sm:z-auto sm:mt-auto sm:border-0 sm:bg-transparent sm:px-0 sm:pt-6 sm:pb-0 sm:backdrop-blur-none"
              />
            )}
          </>
        )}
      </div>

      {settings && (
        <ReportDrawer
          key={drawer?.kind === 'view' ? drawer.report.id : (drawer?.kind ?? 'closed')}
          state={shown}
          settings={settings}
          me={me}
          onClose={() => setDrawer(null)}
          onCreated={(report) => setDrawer({ kind: 'view', report })}
        />
      )}
      {isOwner && settings && (
        <ReportSettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} settings={settings} />
      )}
    </div>
  )
}

/**
 * One report as a card, in the order a reviewer reads it: the day and who
 * filed it, when it was submitted (and whether that was late), then what the
 * report says. The whole card opens the report.
 */
function ReportCard({ report, seesAll, onView }: { report: Report; seesAll: boolean; onView: () => void }) {
  const author = report.createdByName ?? 'Deleted user'
  return (
    <button
      type="button"
      onClick={onView}
      aria-haspopup="dialog"
      aria-label={`View report for ${formatDay(report.reportDate)}${seesAll ? ` by ${author}` : ''}`}
      className="card-3d flex h-full w-full flex-col rounded-xl p-5 text-left"
    >
      <div className="flex w-full items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-body-lg font-semibold tracking-title text-ink tabular-nums">
            {formatDay(report.reportDate)}
          </p>
          <p className={`mt-0.5 truncate text-label font-normal text-ink-3 ${report.createdByName ? '' : 'italic'}`}>
            {seesAll ? `Created by ${author}` : formatWeekday(report.reportDate)}
          </p>
        </div>
        <span className="shrink-0 rounded-md bg-surface-hover px-2 py-1 text-micro font-semibold text-ink-2">
          {worksLabel(report.reports.length)}
        </span>
      </div>

      <div className="mt-4 w-full">
        <p className="text-body font-semibold text-ink">Submitted</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-label font-normal text-ink-3 tabular-nums">
          <span>{formatStamp(report.submittedAt)}</span>
          {report.late && (
            <span className="inline-flex items-center gap-1 font-medium text-danger/75">
              <Clock3 size={12} strokeWidth={2.2} aria-hidden />
              Late
            </span>
          )}
          {report.editedAt && (
            <span className="italic" title={`Edited ${formatStamp(report.editedAt)}`}>
              Edited
            </span>
          )}
        </p>
        <p className="mt-1.5 truncate text-label font-normal text-ink-2">{report.reports[0]}</p>
      </div>

      {(report.attachment || report.remarks) && (
        <div className="mt-auto flex w-full flex-col gap-1 pt-3 text-label font-normal text-ink-3">
          {report.attachment && (
            <span className="flex min-w-0 items-center gap-1.5">
              <Link2 size={14} strokeWidth={1.9} aria-hidden className="shrink-0" />
              <span className="truncate">{report.attachment.url.replace(/^https?:\/\//, '')}</span>
            </span>
          )}
          {report.remarks && (
            <span className="flex min-w-0 items-center gap-1.5">
              <MessageSquareText size={14} strokeWidth={1.9} aria-hidden className="shrink-0" />
              <span className="truncate">Remarks added</span>
            </span>
          )}
        </div>
      )}
    </button>
  )
}
