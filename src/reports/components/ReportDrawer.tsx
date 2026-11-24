import { useQueryClient } from '@tanstack/react-query'
import { Clock3, Download, ExternalLink, Pencil, Trash2, X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { AlertDialog } from '@/components/Alert'
import { Button } from '@/components/Button'
import { Detail, Muted, Panel } from '@/components/DetailPanel'
import { ApiError } from '@/lib/api'
import {
  REPORTS_KEY,
  createReport,
  deleteReport,
  updateReport,
  updateReportRemarks,
  type Report,
  type ReportSettings,
} from '../api'
import { editableUntil, formatBytes, formatClock, formatDay, formatDayLong, formatStamp } from '../lib/format'
import { ReportForm } from './ReportForm'

/** What the drawer shows: a new report's form, or one report (view, then edit). */
export type ReportDrawerState = { kind: 'new'; date?: string } | { kind: 'view'; report: Report } | null

interface ReportDrawerProps {
  state: ReportDrawerState
  settings: ReportSettings
  me: { id: string; role: 'owner' | 'manager' | 'staff' }
  onClose: () => void
  /** A new report was filed: show it. */
  onCreated: (report: Report) => void
}

/** Whether `me` may still edit or delete `report` (the server re-checks). */
function canChange(report: Report, me: ReportDrawerProps['me'], windowMinutes: number, now = Date.now()) {
  if (me.role === 'owner') return true
  return report.createdBy === me.id && now <= editableUntil(report.submittedAt, windowMinutes).getTime()
}

export function ReportDrawer({ state, settings, me, onClose, onCreated }: ReportDrawerProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const queryClient = useQueryClient()
  const report = state?.kind === 'view' ? state.report : null
  const [editing, setEditing] = useState(state?.kind === 'new')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [remarks, setRemarks] = useState(report?.remarks ?? '')
  const [savingRemarks, setSavingRemarks] = useState(false)
  const [remarksNote, setRemarksNote] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  // Re-render when the edit window closes, so Edit and Delete disappear on time.
  const [now, setNow] = useState(() => Date.now())

  const open = state !== null
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      dialog.focus()
    } else if (!open && dialog.open) dialog.close()
  }, [open])

  const changeable = report ? canChange(report, me, settings.editWindowMinutes, now) : false
  const until = report ? editableUntil(report.submittedAt, settings.editWindowMinutes) : null
  const ownWindow = report && me.role !== 'owner' && report.createdBy === me.id && changeable
  const untilMs = until?.getTime() ?? 0
  useEffect(() => {
    if (!ownWindow) return
    const timer = setTimeout(() => setNow(Date.now()), Math.max(0, untilMs - Date.now()) + 500)
    return () => clearTimeout(timer)
  }, [ownWindow, untilMs])

  const busy = savingRemarks
  function close() {
    if (busy) return
    onClose()
  }

  const refresh = () => queryClient.invalidateQueries({ queryKey: REPORTS_KEY })

  async function saveRemarks() {
    if (!report) return
    setSavingRemarks(true)
    setRemarksNote(null)
    try {
      const updated = await updateReportRemarks(report.id, remarks.trim() || null)
      setRemarks(updated.remarks ?? '')
      setRemarksNote({ tone: 'ok', text: 'Remarks saved.' })
      await refresh()
    } catch (cause) {
      setRemarksNote({
        tone: 'error',
        text: cause instanceof ApiError && cause.status !== 500 ? cause.message : 'Couldn’t save remarks. Try again.',
      })
    } finally {
      setSavingRemarks(false)
    }
  }

  // The form reports why its picked date can't take the report (off day,
  // already filed); the heading then says so, in muted red, instead of the title.
  const [dateNotice, setDateNotice] = useState<string | null>(null)
  const newNotice = editing ? dateNotice : null
  const title = newNotice ?? (state?.kind === 'new' ? 'New report' : report ? formatDayLong(report.reportDate) : '')
  const isOwner = me.role === 'owner'

  return (
    <>
      <dialog
        ref={ref}
        aria-labelledby={titleId}
        onCancel={(event) => {
          if (event.target !== event.currentTarget) return
          event.preventDefault()
          close()
        }}
        onKeyDown={(event) => event.key === 'Escape' && event.stopPropagation()}
        onClick={(event) => event.target === event.currentTarget && close()}
        tabIndex={-1}
        className="app-drawer w-full max-w-sheet border-0 bg-surface p-0 text-ink shadow-dialog outline-none"
      >
        {state && (
          <div className="flex h-full flex-col">
            <div className="flex items-center gap-2 border-b border-line px-4 py-3.5">
              <div className="min-w-0 flex-1">
                {/* The notice stands alone; otherwise a small caption names the drawer. */}
                {!newNotice && (
                  <p className="text-caption text-ink-3">{editing && report ? 'Edit report' : 'Daily report'}</p>
                )}
                <h2
                  id={titleId}
                  className={
                    newNotice
                      ? 'text-body leading-5 font-semibold text-danger/75'
                      : 'truncate text-title font-semibold tracking-title'
                  }
                >
                  {title}
                </h2>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="grid size-9 shrink-0 place-items-center rounded-md text-ink-3 hover:bg-surface-hover hover:text-ink"
              >
                <X size={18} strokeWidth={1.9} />
              </button>
            </div>

            {editing ? (
              <ReportForm
                report={report}
                settings={settings}
                initialDate={state.kind === 'new' ? state.date : undefined}
                onDateNoticeChange={setDateNotice}
                onCancel={() => (report ? setEditing(false) : close())}
                onSubmit={async (input) => {
                  if (report) {
                    await updateReport(report.id, input)
                    await refresh()
                    setEditing(false)
                  } else {
                    const created = await createReport(input)
                    await refresh()
                    onCreated(created)
                  }
                }}
              />
            ) : report ? (
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto bg-canvas px-4 py-4 [&>*]:shrink-0">
                  <Panel title="Report">
                    <Detail label="Date">
                      <span className="tabular-nums">{formatDay(report.reportDate)}</span>
                    </Detail>
                    <Detail label="Filed by">
                      {report.createdByName ?? <Muted>Deleted user</Muted>}
                    </Detail>
                    <Detail label="Submitted">
                      <span className="tabular-nums">{formatStamp(report.submittedAt)}</span>
                      <SubmittedMarks report={report} />
                    </Detail>
                    <Detail label="Files">
                      {report.attachment?.type === 'file' ? (
                        // A short-lived signed link: it downloads under the file's own name.
                        <a
                          href={report.attachment.url}
                          className="inline-flex max-w-full items-start gap-1.5 font-medium text-secondary-text underline-offset-2 hover:underline"
                        >
                          <Download size={14} strokeWidth={2} aria-hidden className="mt-0.5 shrink-0" />
                          <span className="min-w-0 break-all">
                            {report.attachment.name}
                            <span className="ml-1.5 font-normal text-ink-3 tabular-nums">
                              {formatBytes(report.attachment.size)}
                            </span>
                          </span>
                        </a>
                      ) : report.attachment ? (
                        <a
                          href={report.attachment.url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="inline-flex max-w-full items-center gap-1 font-medium break-all text-secondary-text underline underline-offset-2"
                        >
                          {report.attachment.url}
                          <ExternalLink size={13} strokeWidth={2} aria-hidden className="shrink-0" />
                        </a>
                      ) : (
                        <Muted>None</Muted>
                      )}
                    </Detail>
                  </Panel>

                  <Panel title={`Works (${report.reports.length})`} plain>
                    <ol className="divide-y divide-line">
                      {report.reports.map((point, index) => (
                        <li key={index} className="flex gap-3 px-3.5 py-2.5">
                          <span
                            aria-hidden
                            className="mt-px w-5 shrink-0 text-right text-label font-semibold text-ink-3 tabular-nums"
                          >
                            {index + 1}
                          </span>
                          <span className="min-w-0 text-body leading-6 break-words whitespace-pre-wrap text-ink">
                            {point}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </Panel>

                  {isOwner ? (
                    <Panel title="Remarks" plain>
                      <div className="p-3.5">
                        <textarea
                          rows={3}
                          maxLength={4000}
                          value={remarks}
                          onChange={(event) => {
                            setRemarks(event.target.value)
                            setRemarksNote(null)
                          }}
                          aria-label="Remarks"
                          placeholder="Feedback for the author…"
                          className="field-input h-auto min-h-20 resize-y py-2 leading-6"
                        />
                        <div className="mt-2.5 flex items-center justify-end gap-3">
                          {remarksNote && (
                            <p
                              role={remarksNote.tone === 'error' ? 'alert' : 'status'}
                              className={`mr-auto text-caption ${remarksNote.tone === 'error' ? 'text-danger' : 'text-ink-3'}`}
                            >
                              {remarksNote.text}
                            </p>
                          )}
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => void saveRemarks()}
                            loading={savingRemarks}
                            disabled={remarks.trim() === (report.remarks ?? '')}
                          >
                            {savingRemarks ? 'Saving…' : 'Save remarks'}
                          </Button>
                        </div>
                      </div>
                    </Panel>
                  ) : (
                    report.remarks && (
                      <Panel title="Remarks" plain>
                        <p className="px-3.5 py-2.5 text-body leading-6 break-words whitespace-pre-wrap text-ink">
                          {report.remarks}
                        </p>
                      </Panel>
                    )
                  )}
                </div>

                {changeable && (
                  <div className="flex items-center gap-2 border-t border-line bg-canvas/60 px-5 py-3.5">
                    {ownWindow && until && (
                      <p className="mr-auto text-caption text-ink-3">Editable until {formatClock(until)}</p>
                    )}
                    <Button variant="primary" onClick={() => setEditing(true)} className="ml-auto">
                      <Pencil size={15} strokeWidth={2} aria-hidden />
                      Edit
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => setConfirmDelete(true)}
                      aria-label="Delete report"
                      title="Delete report"
                      className="w-9 px-0! text-danger"
                    >
                      <Trash2 size={16} strokeWidth={2} className="shrink-0" aria-hidden />
                    </Button>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}
      </dialog>

      <AlertDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        tone="danger"
        icon={null}
        width="compact"
        title="Delete this report?"
        description={
          report
            ? `The report for ${formatDay(report.reportDate)}${
                report.createdByName && report.createdBy !== me.id ? ` by ${report.createdByName}` : ''
              } will be deleted. This can’t be undone.`
            : undefined
        }
        confirmLabel="Delete"
        pendingLabel="Deleting…"
        onConfirm={async () => {
          if (!report) return
          await deleteReport(report.id)
          await refresh()
          onClose()
        }}
      />
    </>
  )
}

/** "Edited" and "Late" after a submitted time. */
export function SubmittedMarks({ report }: { report: Report }) {
  if (!report.editedAt && !report.late) return null
  return (
    <span className="ml-1.5 inline-flex flex-wrap items-center gap-1.5 align-middle">
      {report.late && (
        <span className="inline-flex items-center gap-1 text-caption font-medium text-danger/75">
          <Clock3 size={12} strokeWidth={2.2} aria-hidden />
          Late
        </span>
      )}
      {report.editedAt && (
        <span className="text-caption text-ink-3 italic" title={`Edited ${formatStamp(report.editedAt)}`}>
          Edited
        </span>
      )}
    </span>
  )
}
