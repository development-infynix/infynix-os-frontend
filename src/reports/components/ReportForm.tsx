import { Link2, Plus, X } from 'lucide-react'
import { useRef, useState, type KeyboardEvent } from 'react'
import { Button } from '@/components/Button'
import { FormError, FormField } from '@/components/FormField'
import { ApiError } from '@/lib/api'
import type { Report, ReportInput, ReportSettings } from '../api'
import { WEEKDAYS, weekdayOf } from '../lib/format'

const MAX_POINTS = 100

interface ReportFormProps {
  /** The report being edited; null for a new one. */
  report: Report | null
  settings: ReportSettings
  /** A new report's starting date (the day picked on the calendar), when it can take one. */
  initialDate?: string
  onCancel: () => void
  onSubmit: (input: ReportInput) => Promise<void>
}

interface FieldErrors {
  date?: string
  points?: string
  link?: string
}

/** New and edit share this form: the date, one row per point, and an optional link. */
export function ReportForm({ report, settings, initialDate, onCancel, onSubmit }: ReportFormProps) {
  // A new report starts on the picked day, else today unless today can't take one.
  const defaultDate = initialDate ?? (settings.submittedToday || settings.todayIsOffDay ? '' : settings.today)
  const [date, setDate] = useState(report?.reportDate ?? defaultDate)
  const [points, setPoints] = useState<string[]>(report?.reports.length ? report.reports : [''])
  const [mode, setMode] = useState<'none' | 'url'>(report?.attachment ? 'url' : 'none')
  const [link, setLink] = useState(report?.attachment?.url ?? '')
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
    if (mode === 'url') {
      const value = link.trim()
      if (!value) next.link = 'Paste the link, or choose None'
      else if (!/^https?:\/\/\S+$/i.test(value)) next.link = 'Enter a full link, like https://example.com'
    }
    return next
  }

  async function submit() {
    const next = validate()
    setErrors(next)
    if (Object.keys(next).length) return
    setSaving(true)
    setServerError(null)
    try {
      await onSubmit({
        reportDate: date,
        reports: points.map((point) => point.trim()).filter(Boolean),
        attachmentMode: mode,
        attachmentUrl: mode === 'url' ? link.trim() : undefined,
      })
    } catch (cause) {
      setServerError(cause instanceof ApiError && cause.status !== 500 ? cause.message : 'Couldn’t save. Try again.')
    } finally {
      setSaving(false)
    }
  }

  const dateHint =
    !report && !initialDate && settings.submittedToday
      ? 'You’ve filed today’s report. Pick a day you missed.'
      : !report && !initialDate && settings.todayIsOffDay
        ? 'Today is an off day. Pick a day you missed.'
        : undefined

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
      <div className="flex flex-1 flex-col gap-5 overflow-y-auto bg-canvas px-5 py-5">
        <FormError message={serverError} />

        <FormField label="Date" htmlFor="report-date" error={errors.date} hint={dateHint}>
          <input
            id="report-date"
            type="date"
            value={date}
            max={settings.today}
            onChange={(event) => setDate(event.target.value)}
            aria-invalid={!!errors.date}
            aria-describedby={errors.date ? 'report-date-error' : undefined}
            className="field-input max-w-[12rem] tabular-nums"
          />
        </FormField>

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
                {points.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removePoint(index)}
                    aria-label={`Remove work ${index + 1}`}
                    title="Remove work"
                    className="mt-1 grid size-8 shrink-0 place-items-center rounded-md text-ink-3 hover:bg-surface-hover hover:text-ink"
                  >
                    <X size={16} strokeWidth={2} aria-hidden />
                  </button>
                )}
              </li>
            ))}
          </ol>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 pl-10">
            <Button size="sm" variant="secondary" onClick={() => addPoint()} disabled={points.length >= MAX_POINTS}>
              <Plus size={15} strokeWidth={2} aria-hidden />
              Add work
            </Button>
            <span className="text-caption text-ink-3">Enter adds the next work · Shift+Enter for a new line</span>
          </div>
        </FormField>

        <FormField label="Link (optional)">
          <div className="flex w-fit gap-1 rounded-xl bg-canvas p-1.5 shadow-well">
            {(
              [
                ['none', 'None'],
                ['url', 'Link'],
              ] as const
            ).map(([value, label]) => (
              <label
                key={value}
                className={`inline-flex h-8 min-w-[6.5rem] cursor-pointer items-center justify-center rounded-lg px-5 text-label transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--focus)] ${
                  mode === value ? 'btn btn-primary' : 'font-medium text-ink-2 hover:bg-surface-hover hover:text-ink'
                }`}
              >
                <input
                  type="radio"
                  name="report-attachment"
                  value={value}
                  checked={mode === value}
                  onChange={() => setMode(value)}
                  className="sr-only"
                />
                {label}
              </label>
            ))}
          </div>
          {mode === 'url' && (
            <div className="relative mt-3">
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
                placeholder="https://"
                aria-label="Link"
                aria-invalid={!!errors.link}
                className="field-input pl-9"
              />
              {errors.link && <p className="mt-1.5 text-caption text-danger">{errors.link}</p>}
            </div>
          )}
        </FormField>
      </div>

      <div className="flex items-center gap-2 border-t border-line bg-canvas/60 px-5 py-3.5 [&>*]:flex-1 sm:justify-end sm:[&>*]:flex-none">
        <Button variant="secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={saving}>
          {saving ? 'Saving…' : report ? 'Save changes' : 'Submit report'}
        </Button>
      </div>
    </form>
  )
}
