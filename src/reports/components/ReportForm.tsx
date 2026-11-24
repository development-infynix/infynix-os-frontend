import { useQuery } from '@tanstack/react-query'
import { Link2, Plus, X } from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Button } from '@/components/Button'
import { FormError, FormField } from '@/components/FormField'
import { ApiError } from '@/lib/api'
import { useSession } from '@/lib/auth'
import {
  MAX_REPORT_FILE_BYTES,
  reportsForDayQuery,
  uploadReportFile,
  type Report,
  type ReportInput,
  type ReportSettings,
  type UploadedReportFile,
} from '../api'
import { WEEKDAYS, formatBytes, weekdayOf } from '../lib/format'
import { ReportFileSlot } from './ReportFileSlot'

/** The file in the Upload tab: the report's current one, or one just uploaded. */
type AttachedFile =
  | { kind: 'current'; name: string; size: number }
  | { kind: 'uploading'; name: string; size: number }
  | ({ kind: 'uploaded' } & UploadedReportFile)

const MAX_POINTS = 100

interface ReportFormProps {
  /** The report being edited; null for a new one. */
  report: Report | null
  settings: ReportSettings
  /** A new report's starting date, when one was picked elsewhere. */
  initialDate?: string
  /**
   * Why the picked date can't take this report (an off day, or already filed),
   * or null. The drawer shows it as its heading; Submit stays off meanwhile.
   */
  onDateNoticeChange?: (notice: string | null) => void
  onCancel: () => void
  onSubmit: (input: ReportInput) => Promise<void>
}

interface FieldErrors {
  date?: string
  points?: string
  link?: string
}

/** New and edit share this form: the date, one row per point, and an optional link. */
export function ReportForm({
  report,
  settings,
  initialDate,
  onDateNoticeChange,
  onCancel,
  onSubmit,
}: ReportFormProps) {
  // A new report starts on the picked day, else today (the heading warns if today is taken).
  const defaultDate = initialDate ?? (settings.todayIsOffDay ? '' : settings.today)
  const [date, setDate] = useState(report?.reportDate ?? defaultDate)
  const { user } = useSession()

  // One report per person per day: look up the picked day as soon as it's set,
  // so Submit is off before typing goes to waste. (The server refuses too.)
  const checkable = /^\d{4}-\d{2}-\d{2}$/.test(date) && date <= settings.today
  const dayQuery = useQuery({ ...reportsForDayQuery(date, user.id), enabled: checkable })
  const alreadyFiled =
    checkable &&
    !!dayQuery.data?.items.some((other) => other.createdBy === user.id && other.id !== report?.id)
  // An off day blocks a new date; a report already on a day that later became
  // an off day can still be edited without moving it.
  const offDay =
    /^\d{4}-\d{2}-\d{2}$/.test(date) && date !== report?.reportDate && settings.skipDays.includes(weekdayOf(date))
  const dateNotice = offDay
    ? `${WEEKDAYS.find((w) => w.value === weekdayOf(date))?.long ?? 'That day'} is an off day. Pick another day.`
    : alreadyFiled
      ? 'You already filed a report for this day. Pick another day.'
      : null
  useEffect(() => onDateNoticeChange?.(dateNotice), [dateNotice, onDateNoticeChange])
  const [points, setPoints] = useState<string[]>(report?.reports.length ? report.reports : [''])
  const current = report?.attachment
  // The open tab is what gets attached: a report carries a link or a file, never both.
  const [filesTab, setFilesTab] = useState<'link' | 'upload'>(current?.type === 'file' ? 'upload' : 'link')
  const [link, setLink] = useState(current?.type === 'url' ? current.url : '')
  const [file, setFile] = useState<AttachedFile | null>(
    current?.type === 'file' ? { kind: 'current', name: current.name, size: current.size } : null,
  )
  const [progress, setProgress] = useState<number | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const uploadAbort = useRef<AbortController | null>(null)

  // Leaving the form mid-upload cancels it.
  useEffect(() => () => uploadAbort.current?.abort(), [])

  /** Uploads as soon as a file is picked, so Submit only has to attach it. */
  async function pickFile(picked: File) {
    setFileError(null)
    if (picked.size > MAX_REPORT_FILE_BYTES) {
      setFileError(`That file is ${formatBytes(picked.size)}. Files can be up to ${formatBytes(MAX_REPORT_FILE_BYTES)}.`)
      return
    }
    uploadAbort.current?.abort()
    const controller = new AbortController()
    uploadAbort.current = controller
    setFile({ kind: 'uploading', name: picked.name, size: picked.size })
    setProgress(0)
    try {
      const uploaded = await uploadReportFile(picked, { onProgress: setProgress, signal: controller.signal })
      if (controller.signal.aborted) return
      setFile({ kind: 'uploaded', ...uploaded })
    } catch (cause) {
      if (controller.signal.aborted) return
      setFile(null)
      setFileError(
        cause instanceof ApiError && cause.status === 413
          ? `Files can be up to ${formatBytes(MAX_REPORT_FILE_BYTES)}.`
          : cause instanceof ApiError && cause.status === 415
            ? 'That type of file can’t be attached. Use a PDF, image, Office file, CSV or text file.'
            : cause instanceof ApiError && cause.status !== 500
              ? cause.message
              : 'Couldn’t upload the file. Try again.',
      )
    } finally {
      if (uploadAbort.current === controller) {
        uploadAbort.current = null
        setProgress(null)
      }
    }
  }

  function removeFile() {
    uploadAbort.current?.abort()
    uploadAbort.current = null
    setProgress(null)
    setFile(null)
    setFileError(null)
  }

  /** What the open tab attaches. */
  function attachment(): Pick<ReportInput, 'attachmentMode' | 'attachmentUrl' | 'fileKey' | 'fileName'> {
    if (filesTab === 'link') {
      return link.trim() ? { attachmentMode: 'url', attachmentUrl: link.trim() } : { attachmentMode: 'none' }
    }
    if (file?.kind === 'current') return { attachmentMode: 'keep' }
    if (file?.kind === 'uploaded') return { attachmentMode: 'file', fileKey: file.key, fileName: file.name }
    return { attachmentMode: 'none' }
  }
  const [errors, setErrors] = useState<FieldErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const pointRefs = useRef<(HTMLTextAreaElement | null)[]>([])

  const setPoint = (index: number, value: string) =>
    setPoints((current) => current.map((point, i) => (i === index ? value : point)))

  function addPoint(after = points.length - 1) {
    if (points.length >= MAX_POINTS) return
    setPoints((current) => [...current.slice(0, after + 1), '', ...current.slice(after + 1)])
    requestAnimationFrame(() => pointRefs.current[after + 1]?.focus())
  }

  function removePoint(index: number) {
    setPoints((current) => current.filter((_, i) => i !== index))
    requestAnimationFrame(() => pointRefs.current[Math.max(0, index - 1)]?.focus())
  }

  /** Enter starts the next point; Shift+Enter is a line break inside this one. */
  function onPointKeyDown(event: KeyboardEvent<HTMLTextAreaElement>, index: number) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      if (points[index].trim()) addPoint(index)
    } else if (event.key === 'Backspace' && !points[index] && points.length > 1) {
      event.preventDefault()
      removePoint(index)
    }
  }

  function validate(): FieldErrors {
    const next: FieldErrors = {}
    if (!date) next.date = 'Choose the day this report covers'
    else if (date > settings.today) next.date = 'Reports can’t be dated in the future'
    else if (date !== report?.reportDate && settings.skipDays.includes(weekdayOf(date))) {
      const day = WEEKDAYS.find((w) => w.value === weekdayOf(date))?.long
      next.date = `${day} is an off day`
    }
    if (!points.some((point) => point.trim())) next.points = 'Add at least one work'
    const value = link.trim()
    if (filesTab === 'link' && value && !/^https?:\/\/\S+$/i.test(value)) {
      next.link = 'Enter a full link, like https://example.com'
    }
    return next
  }

  async function submit() {
    const next = validate()
    setErrors(next)
    if (Object.keys(next).length) return
    if (filesTab === 'upload' && file?.kind === 'uploading') {
      setFileError('Wait for the upload to finish, or remove the file.')
      return
    }
    setSaving(true)
    setServerError(null)
    try {
      await onSubmit({
        reportDate: date,
        reports: points.map((point) => point.trim()).filter(Boolean),
        ...attachment(),
      })
    } catch (cause) {
      setServerError(cause instanceof ApiError && cause.status !== 500 ? cause.message : 'Couldn’t save. Try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      noValidate
      aria-busy={saving}
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto bg-canvas px-5 py-5 [&>*]:shrink-0">
        <FormError message={serverError} />

        {/* Date: label on the left, the picker flush right on the same line. */}
        <div>
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="report-date" className="text-label font-medium text-ink-2">
              Date
            </label>
            <input
              id="report-date"
              type="date"
              value={date}
              max={settings.today}
              onChange={(event) => setDate(event.target.value)}
              aria-invalid={!!errors.date}
              aria-describedby={errors.date ? 'report-date-error' : undefined}
              className="field-input w-auto max-w-[12rem] tabular-nums"
            />
          </div>
          {errors.date && (
            <p id="report-date-error" className="mt-1.5 text-right text-caption text-danger">
              {errors.date}
            </p>
          )}
        </div>

        <FormField label={`Works (${points.length})`} error={errors.points}>
          <ol className="flex flex-col gap-2">
            {points.map((point, index) => (
              <li key={index} className="flex items-start gap-2">
                <span
                  aria-hidden
                  className="mt-1 grid size-8 shrink-0 place-items-center rounded-md bg-surface text-caption font-semibold text-ink-3 tabular-nums shadow-lift"
                >
                  {index + 1}
                </span>
                <textarea
                  ref={(el) => {
                    pointRefs.current[index] = el
                  }}
                  rows={1}
                  maxLength={5000}
                  value={point}
                  onChange={(event) => setPoint(index, event.target.value)}
                  onKeyDown={(event) => onPointKeyDown(event, index)}
                  aria-label={`Work ${index + 1}`}
                  placeholder={index === 0 ? 'What did you work on?' : undefined}
                  className="field-input h-auto min-h-10 resize-y py-2 leading-6 [field-sizing:content]"
                />
                {/* The last row ends in the add button; earlier rows end in remove. */}
                {index === points.length - 1 ? (
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => addPoint(index)}
                    disabled={points.length >= MAX_POINTS}
                    aria-label="Add work"
                    title="Add work (or press Enter)"
                    className="mt-1 w-8 shrink-0 px-0!"
                  >
                    <Plus size={16} strokeWidth={2.2} aria-hidden />
                  </Button>
                ) : (
                  <button
                    type="button"
                    onClick={() => removePoint(index)}
                    aria-label={`Remove work ${index + 1}`}
                    title="Remove work"
                    className="mt-1 grid size-8 shrink-0 place-items-center rounded-md text-ink-3 hover:bg-surface-hover hover:text-danger"
                  >
                    <X size={16} strokeWidth={2} aria-hidden />
                  </button>
                )}
              </li>
            ))}
          </ol>
        </FormField>

      </div>

      {/* Sub-footer: files, pinned above the actions while the works scroll. */}
      <section aria-labelledby="report-files-label" className="shrink-0 border-t border-line bg-surface px-5 pt-3 pb-4">
        <div className="flex items-center justify-between gap-3">
          <h3 id="report-files-label" className="text-label font-medium text-ink-2">
            Files <span className="font-normal text-ink-3">(optional)</span>
          </h3>
          <div role="radiogroup" aria-labelledby="report-files-label" className="flex gap-1 rounded-xl bg-canvas p-1 shadow-well">
            {(
              [
                ['link', 'Link'],
                ['upload', 'Upload'],
              ] as const
            ).map(([value, label]) => (
              <label
                key={value}
                className={`inline-flex h-7 min-w-[5.5rem] cursor-pointer items-center justify-center rounded-lg px-3 text-label transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--focus)] ${
                  filesTab === value ? 'btn btn-primary' : 'font-medium text-ink-2 hover:bg-surface-hover hover:text-ink'
                }`}
              >
                <input
                  type="radio"
                  name="report-files"
                  value={value}
                  checked={filesTab === value}
                  onChange={() => setFilesTab(value)}
                  className="sr-only"
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        {filesTab === 'link' ? (
          <div className="mt-3">
            <div className="relative">
              <Link2
                size={16}
                strokeWidth={1.9}
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-3"
              />
              <input
                type="url"
                inputMode="url"
                autoComplete="off"
                value={link}
                onChange={(event) => setLink(event.target.value)}
                placeholder="Paste a link: Drive, Figma, a doc…"
                aria-label="Link"
                aria-invalid={!!errors.link}
                aria-describedby={errors.link ? 'report-link-error' : undefined}
                className="field-input pl-9"
              />
            </div>
            {errors.link && (
              <p id="report-link-error" className="mt-1.5 text-caption text-danger">
                {errors.link}
              </p>
            )}
          </div>
        ) : (
          <ReportFileSlot
            file={file}
            progress={progress}
            error={fileError}
            disabled={saving}
            onPick={(picked) => void pickFile(picked)}
            onRemove={removeFile}
          />
        )}
      </section>

      <div className="flex items-center gap-2 border-t border-line bg-canvas/60 px-5 py-3.5 [&>*]:flex-1 sm:justify-end sm:[&>*]:flex-none">
        <Button variant="secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={saving} disabled={progress !== null || !!dateNotice}>
          {saving ? 'Saving…' : report ? 'Save changes' : 'Submit report'}
        </Button>
      </div>
    </form>
  )
}
