import { useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Button } from '@/components/Button'
import { FormError, FormField } from '@/components/FormField'
import { Modal, ModalFooter } from '@/components/Modal'
import { ApiError } from '@/lib/api'
import { REPORTS_KEY, updateReportSettings, type ReportSettings } from '../api'
import { WEEKDAYS } from '../lib/format'

/** Browsers still list some zones by their old names; show the current ones. */
const RENAMED: Record<string, string> = {
  'Asia/Calcutta': 'Asia/Kolkata',
  'Asia/Katmandu': 'Asia/Kathmandu',
  'Asia/Rangoon': 'Asia/Yangon',
  'Asia/Saigon': 'Asia/Ho_Chi_Minh',
  'Europe/Kiev': 'Europe/Kyiv',
}

function timezoneList(current: string): string[] {
  const zones = new Set(Intl.supportedValuesOf('timeZone').map((zone) => RENAMED[zone] ?? zone))
  zones.add('UTC')
  zones.add(current)
  return [...zones].sort()
}

interface ReportSettingsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  settings: ReportSettings
}

/** Owner only: the company's timezone, due time and off days for Reports. */
export function ReportSettingsModal({ open, onOpenChange, settings }: ReportSettingsModalProps) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Report settings"
      description="These apply to everyone in your company."
    >
      {/* Remount on open so the form starts from the saved values. */}
      {open && <SettingsForm settings={settings} onDone={() => onOpenChange(false)} />}
    </Modal>
  )
}

function SettingsForm({ settings, onDone }: { settings: ReportSettings; onDone: () => void }) {
  const queryClient = useQueryClient()
  const [timezone, setTimezone] = useState(settings.timezone)
  const [dueTime, setDueTime] = useState(settings.dueTime ?? '')
  const [skipDays, setSkipDays] = useState<number[]>(settings.skipDays)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const zones = useMemo(() => timezoneList(settings.timezone), [settings.timezone])

  const toggleDay = (day: number) =>
    setSkipDays((current) => (current.includes(day) ? current.filter((d) => d !== day) : [...current, day]))

  async function save() {
    if (skipDays.length >= 7) {
      setError('Leave at least one working day.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await updateReportSettings({ timezone, dueTime: dueTime || null, skipDays })
      await queryClient.invalidateQueries({ queryKey: REPORTS_KEY })
      onDone()
    } catch (cause) {
      setError(cause instanceof ApiError && cause.status !== 500 ? cause.message : 'Couldn’t save. Try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        void save()
      }}
    >
      <div className="flex flex-col gap-4 px-5 pt-4">
        <FormError message={error} />
        <FormField
          label="Timezone"
          htmlFor="report-timezone"
          hint="“Today”, the due time and off days follow this zone."
        >
          <select
            id="report-timezone"
            value={timezone}
            onChange={(event) => setTimezone(event.target.value)}
            className="field-input"
          >
            {zones.map((zone) => (
              <option key={zone} value={zone}>
                {zone.replaceAll('_', ' ')}
              </option>
            ))}
          </select>
        </FormField>

        <FormField
          label="Due time"
          htmlFor="report-due-time"
          hint={dueTime ? 'Reports submitted after this time on their day are marked Late.' : 'No due time: nothing is marked Late.'}
        >
          <div className="flex items-center gap-2">
            <input
              id="report-due-time"
              type="time"
              value={dueTime}
              onChange={(event) => setDueTime(event.target.value)}
              className="field-input max-w-[10rem] tabular-nums"
            />
            {dueTime && (
              <Button size="sm" variant="secondary" onClick={() => setDueTime('')}>
                Clear
              </Button>
            )}
          </div>
        </FormField>

        <FormField label="Off days" hint="No report can be dated on an off day.">
          <div className="grid grid-cols-7 gap-1.5">
            {WEEKDAYS.map((day) => {
              const off = skipDays.includes(day.value)
              return (
                <button
                  key={day.value}
                  type="button"
                  aria-pressed={off}
                  aria-label={`${day.long}: ${off ? 'off day' : 'working day'}`}
                  title={day.long}
                  onClick={() => toggleDay(day.value)}
                  className={`h-9 rounded-md text-label transition-colors ${
                    off
                      ? 'bg-secondary-soft font-semibold text-secondary-text'
                      : 'font-medium text-ink-2 shadow-[inset_0_0_0_1px_var(--line-strong)] hover:bg-surface-hover hover:text-ink'
                  }`}
                >
                  {day.short}
                </button>
              )
            })}
          </div>
        </FormField>
      </div>
      <ModalFooter>
        <Button variant="secondary" onClick={onDone} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={saving}>
          {saving ? 'Saving…' : 'Save settings'}
        </Button>
      </ModalFooter>
    </form>
  )
}
