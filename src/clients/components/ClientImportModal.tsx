import { useQueryClient } from '@tanstack/react-query'
import { Check, ChevronDown, Upload } from 'lucide-react'
import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import * as XLSX from 'xlsx'
import { Button } from '@/components/Button'
import { FormError, FormField } from '@/components/FormField'
import { Modal } from '@/components/Modal'
import { CLIENTS_KEY, importClientsChunk, type ClientInput } from '@/lib/clients'

const STEPS = ['Upload file', 'Match fields', 'Select fields', 'Preview'] as const
const MAX_ROWS = 500
const CHUNK_SIZE = 100
type Step = 1 | 2 | 3 | 4

interface ParsedFile {
  name: string
  headers: string[]
  rows: Record<string, string>[]
}

interface FieldMapping {
  name: string
  email: string
  phone: string
}

interface ImportResult {
  created: number
  skipped: number
}

function uniqueHeaders(values: unknown[]): string[] {
  const seen = new Map<string, number>()
  return values.map((value, index) => {
    const base = String(value ?? '').trim() || `Column ${index + 1}`
    const count = (seen.get(base) ?? 0) + 1
    seen.set(base, count)
    return count === 1 ? base : `${base} (${count})`
  })
}

function parseWorkbook(fileName: string, buffer: ArrayBuffer): ParsedFile {
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  if (!sheet) throw new Error('empty')
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false, defval: '' })
  const headers = uniqueHeaders(matrix[0] ?? [])
  const rows = matrix
    .slice(1)
    .filter((row) => row.some((cell) => String(cell ?? '').trim() !== ''))
    .map((row) =>
      Object.fromEntries(headers.map((header, index) => [header, String(row[index] ?? '').trim()])),
    )
  if (!headers.length || !rows.length) throw new Error('empty')
  return { name: fileName, headers, rows }
}

function guessMapping(headers: string[]): FieldMapping {
  const find = (needles: string[]) =>
    headers.find((header) => needles.some((needle) => header.toLowerCase().includes(needle))) ?? ''
  return {
    name: find(['name', 'client', 'company']),
    email: find(['email', 'e-mail', 'mail']),
    phone: find(['phone', 'mobile', 'tel']),
  }
}

export function ClientImportModal({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [step, setStep] = useState<Step>(1)
  const [file, setFile] = useState<ParsedFile | null>(null)
  const [mapping, setMapping] = useState<FieldMapping>({ name: '', email: '', phone: '' })
  const [customFields, setCustomFields] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)

  function reset() {
    setStep(1)
    setFile(null)
    setMapping({ name: '', email: '', phone: '' })
    setCustomFields([])
    setError(null)
    setImporting(false)
    setProgress(null)
    setResult(null)
  }

  function close() {
    if (importing) return
    reset()
    onOpenChange(false)
  }

  async function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0]
    event.target.value = ''
    if (!selected) return
    reset()
    const extension = selected.name.split('.').pop()?.toLowerCase()
    if (!['xlsx', 'xls', 'csv'].includes(extension ?? '')) {
      setError('Choose an Excel or CSV file.')
      return
    }
    try {
      const parsed = parseWorkbook(selected.name, await selected.arrayBuffer())
      if (parsed.rows.length > MAX_ROWS) {
        setError('Cannot import more than 500 rows.')
        return
      }
      setFile(parsed)
      setMapping(guessMapping(parsed.headers))
      setCustomFields([])
      setError(null)
      setStep(2)
    } catch {
      setError('Couldn’t read that file. Try another Excel or CSV file.')
    }
  }

  const selectedColumns = [mapping.name, mapping.email, mapping.phone].filter(Boolean)
  const availableCustomFields = file?.headers.filter((header) => !selectedColumns.includes(header)) ?? []

  const canContinue = step === 1 ? !!file : step === 2 ? !!mapping.name && (!!mapping.email || !!mapping.phone) : true

  async function runImport() {
    if (!file) return
    const payloads: ClientInput[] = []
    let invalid = 0
    for (const row of file.rows) {
      const name = (row[mapping.name] ?? '').trim()
      const email = mapping.email ? row[mapping.email]?.trim() || null : null
      const phone = mapping.phone ? row[mapping.phone]?.trim() || null : null
      if (!name || (!email && !phone)) {
        invalid += 1
        continue
      }
      const customDetails = Object.fromEntries(
        customFields.filter((header) => row[header]?.trim()).map((header) => [header, row[header]!.trim()]),
      )
      payloads.push({ name, email, phone, customDetails })
    }
    if (!payloads.length) {
      setError('No rows have a name plus email or phone.')
      return
    }

    setImporting(true)
    setError(null)
    setProgress({ current: 0, total: payloads.length })
    let created = 0
    let skipped = invalid
    try {
      for (let index = 0; index < payloads.length; index += CHUNK_SIZE) {
        const chunk = payloads.slice(index, index + CHUNK_SIZE)
        const outcome = await importClientsChunk(chunk)
        created += outcome.created
        skipped += outcome.skipped
        setProgress({ current: Math.min(index + chunk.length, payloads.length), total: payloads.length })
      }
      await queryClient.invalidateQueries({ queryKey: CLIENTS_KEY })
      setResult({ created, skipped })
    } catch {
      setError('Couldn’t finish the import. Try again.')
      setProgress(null)
    } finally {
      setImporting(false)
    }
  }

  const preview = file?.rows.slice(0, 5) ?? []
  const percent = progress?.total ? Math.round((progress.current / progress.total) * 100) : 0

  return (
    <Modal
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
      busy={importing}
      wide
      title="Import clients"
      description="Bring a spreadsheet of clients into the directory."
    >
      <div className="flex max-h-[min(70vh,34rem)] flex-col overflow-hidden sm:max-h-[min(82vh,46rem)]">
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-4">
          {importing || result ? (
            <div>
              <div className="mb-2 flex items-center justify-between text-caption text-ink-3">
                <span>{importing ? 'Importing clients…' : 'Import complete'}</span>
                <span className="tabular-nums">
                  {progress?.current ?? 0} / {progress?.total ?? 0}
                </span>
              </div>
              <div
                role="progressbar"
                aria-label="Import progress"
                aria-valuenow={percent}
                aria-valuemin={0}
                aria-valuemax={100}
                className="h-2 overflow-hidden rounded-full bg-surface-hover"
              >
                <div
                  className="h-full rounded-full bg-secondary transition-[width] duration-200"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          ) : (
            <ol className="flex items-center gap-2" aria-label="Import steps">
              {STEPS.map((label, index) => {
                const number = (index + 1) as Step
                const done = number < step
                const active = number === step
                return (
                  <li key={label} className="flex min-w-0 flex-1 items-center gap-2">
                    <span
                      aria-current={active ? 'step' : undefined}
                      className={`grid size-7 shrink-0 place-items-center rounded-full text-micro font-semibold ${
                        done || active ? 'bg-secondary text-on-secondary' : 'bg-surface-hover text-ink-3'
                      }`}
                    >
                      {done ? <Check size={14} strokeWidth={2.4} aria-hidden /> : number}
                    </span>
                    {number < STEPS.length && (
                      <span className={`h-px flex-1 ${number < step ? 'bg-secondary' : 'bg-line'}`} />
                    )}
                  </li>
                )
              })}
            </ol>
          )}

          <div className="mt-5">
            <FormError message={error} />

            {result ? (
              <div className="rounded-xl bg-surface p-5 text-center shadow-lift">
                <span className="mx-auto grid size-10 place-items-center rounded-lg bg-secondary-soft text-secondary-text">
                  <Check size={20} strokeWidth={2} aria-hidden />
                </span>
                <p className="mt-3 text-title font-semibold text-ink">Import complete</p>
                <p className="mt-1 text-body text-ink-2">
                  {result.created} client{result.created === 1 ? '' : 's'} added · {result.skipped} skipped.
                </p>
              </div>
            ) : step === 1 ? (
              <label className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border border-dashed border-line-strong bg-canvas/50 px-6 py-10 text-center hover:bg-surface-hover">
                <span className="grid size-10 place-items-center rounded-lg bg-surface text-secondary-text shadow-lift">
                  <Upload size={19} strokeWidth={1.9} aria-hidden />
                </span>
                <span className="text-body font-medium text-ink">Choose an Excel or CSV file</span>
                <span className="text-caption text-ink-3">The first row must contain column headings.</span>
                <input type="file" accept=".xlsx,.xls,.csv" className="sr-only" onChange={(event) => void onFileChange(event)} />
              </label>
            ) : step === 2 ? (
              <div className="flex flex-col gap-4">
                <p className="text-label text-ink-2">Match the columns that hold each client's contact details.</p>
                <ColumnSelect
                  id="import-name"
                  label="Name"
                  value={mapping.name}
                  options={file?.headers ?? []}
                  placeholder="Select a column"
                  onChange={(value) => setMapping({ ...mapping, name: value })}
                />
                <ColumnSelect
                  id="import-email"
                  label="Email"
                  value={mapping.email}
                  options={file?.headers ?? []}
                  placeholder="None"
                  onChange={(value) => setMapping({ ...mapping, email: value })}
                />
                <ColumnSelect
                  id="import-phone"
                  label="Phone"
                  value={mapping.phone}
                  options={file?.headers ?? []}
                  placeholder="None"
                  onChange={(value) => setMapping({ ...mapping, phone: value })}
                />
                <p className="text-caption text-ink-3">Name and at least one of email or phone are required.</p>
              </div>
            ) : step === 3 ? (
              <div>
                <p className="text-label text-ink-2">Choose the columns to keep as custom details.</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {availableCustomFields.length ? (
                    availableCustomFields.map((header) => (
                      <label
                        key={header}
                        className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-body text-ink-2 hover:bg-surface-hover"
                      >
                        <input
                          type="checkbox"
                          className="size-4 shrink-0 accent-secondary"
                          checked={customFields.includes(header)}
                          onChange={() =>
                            setCustomFields((current) =>
                              current.includes(header)
                                ? current.filter((field) => field !== header)
                                : [...current, header],
                            )
                          }
                        />
                        <span className="truncate">{header}</span>
                      </label>
                    ))
                  ) : (
                    <p className="text-label text-ink-3">No other columns to import.</p>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <p className="text-label text-ink-2">
                  Previewing {preview.length} of {file?.rows.length ?? 0} rows.
                </p>
                <div className="mt-3 overflow-x-auto rounded-lg border border-line">
                  <table className="w-full min-w-[36rem] text-left text-label">
                    <thead className="bg-canvas/60 text-ink-3">
                      <tr>
                        <th className="px-3 py-2 font-medium whitespace-nowrap">Name</th>
                        <th className="px-3 py-2 font-medium whitespace-nowrap">Email</th>
                        <th className="px-3 py-2 font-medium whitespace-nowrap">Phone</th>
                        {customFields.map((header) => (
                          <th key={header} className="px-3 py-2 font-medium whitespace-nowrap">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {preview.map((row, index) => (
                        <tr key={index} className="text-ink-2">
                          <td className="px-3 py-2 whitespace-nowrap">{row[mapping.name] || '—'}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{row[mapping.email] || '—'}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{row[mapping.phone] || '—'}</td>
                          {customFields.map((header) => (
                            <td key={header} className="px-3 py-2 whitespace-nowrap">
                              {row[header] || '—'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-5 flex items-center gap-2 border-t border-line bg-canvas/60 px-5 py-3.5 [&>*]:flex-1 sm:justify-end sm:[&>*]:flex-none">
          {(result || step === 1) && (
            <Button variant="secondary" onClick={close} disabled={importing}>
              {result ? 'Done' : 'Cancel'}
            </Button>
          )}
          {!result && step > 1 && (
            <Button variant="secondary" onClick={() => setStep((step - 1) as Step)} disabled={importing}>
              Back
            </Button>
          )}
          {!result && step < 4 && (
            <Button variant="primary" onClick={() => setStep((step + 1) as Step)} disabled={!canContinue}>
              Next
            </Button>
          )}
          {!result && step === 4 && (
            <Button variant="primary" onClick={() => void runImport()} loading={importing}>
              {importing ? 'Importing…' : `Import ${file?.rows.length ?? 0} clients`}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  )
}

function ColumnSelect({
  id,
  label,
  value,
  options,
  placeholder,
  onChange,
}: {
  id: string
  label: string
  value: string
  options: string[]
  placeholder: string
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const choices = [''].concat(options.filter((option) => option !== placeholder))
  const selected = value || placeholder

  return (
    <FormField label={label} htmlFor={id}>
      <div ref={ref} className="relative">
        <button
          id={id}
          type="button"
          onClick={() => setOpen((current) => !current)}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="btn btn-secondary flex h-10 w-full items-center justify-between px-3 text-body font-normal"
        >
          <span className={`truncate ${value ? 'text-ink' : 'text-ink-3'}`}>{selected}</span>
          <ChevronDown size={15} strokeWidth={2} className="shrink-0 text-ink-3" aria-hidden />
        </button>
        {open && (
          <ul
            role="listbox"
            aria-label={`${label} column`}
            className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-lg bg-surface py-1 shadow-dialog"
          >
            {choices.map((option) => (
              <li key={option || 'none'} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={option === value}
                  onClick={() => {
                    onChange(option)
                    setOpen(false)
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-body ${
                    option === value
                      ? 'bg-secondary-soft font-medium text-secondary-text'
                      : 'text-ink-2 hover:bg-surface-hover hover:text-ink'
                  }`}
                >
                  <span className="flex-1 truncate">{option || placeholder}</span>
                  {option === value && <Check size={14} strokeWidth={2} aria-hidden />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </FormField>
  )
}
