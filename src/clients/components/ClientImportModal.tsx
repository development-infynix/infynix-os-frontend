import { useQueryClient } from '@tanstack/react-query'
import { Check, ChevronDown, Circle, Loader2, Upload, X } from 'lucide-react'
import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import * as XLSX from 'xlsx'
import { StagePicker } from '@/crm/components/StagePicker'
import type { CrmPipeline } from '@/crm/types'
import { useAddToPipeline, type AddToPipelineRun } from '@/crm/useAddToPipeline'
import { Button } from '@/components/Button'
import { FormError, FormField } from '@/components/FormField'
import { Modal } from '@/components/Modal'
import {
  CLIENTS_KEY,
  CLIENT_IMPORTS_KEY,
  chunkImportRows,
  clientImportIdsQuery,
  createClientImport,
  importClientsChunk,
  type ClientInput,
} from '@/lib/clients'

const STEPS = ['Upload file', 'Match fields', 'Select fields', 'Preview'] as const
const MAX_ROWS = 500
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
  pipeline,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /**
   * Opened from the CRM page (Add deal › Import data): the imported clients
   * also become deals in this pipeline, in the stage picked on the last step.
   */
  pipeline?: CrmPipeline
}) {
  const queryClient = useQueryClient()
  const [stageId, setStageId] = useState<string | null>(pipeline?.stages[0]?.id ?? null)
  /** The finished import, kept so adding its clients to the pipeline can be retried. */
  const [importId, setImportId] = useState<string | null>(null)
  /** Fetching the new clients' ids failed: nothing was sent to the pipeline yet. */
  const [idsFailed, setIdsFailed] = useState(false)
  const pipelineRun = useAddToPipeline()
  const stage = pipeline?.stages.find((item) => item.id === stageId) ?? pipeline?.stages[0] ?? null
  const where = pipeline ? (stage ? `${pipeline.name} › ${stage.name}` : pipeline.name) : ''
  const addingToPipeline = pipelineRun.phase === 'running'
  const [step, setStep] = useState<Step>(1)
  const [file, setFile] = useState<ParsedFile | null>(null)
  const [mapping, setMapping] = useState<FieldMapping>({ name: '', email: '', phone: '' })
  const [customFields, setCustomFields] = useState<string[]>([])
  const [importName, setImportName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)

  function reset() {
    setStep(1)
    setFile(null)
    setMapping({ name: '', email: '', phone: '' })
    setCustomFields([])
    setImportName('')
    setError(null)
    setImporting(false)
    setProgress(null)
    setResult(null)
    setStageId(pipeline?.stages[0]?.id ?? null)
    setImportId(null)
    setIdsFailed(false)
    pipelineRun.reset()
  }

  function close() {
    if (importing || addingToPipeline) return
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
      setImportName('')
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
      const job = await createClientImport({
        name: importName.trim(),
        fileName: file.name,
        rowCount: file.rows.length,
      })
      // Chunks by size, not a fixed count: usually the whole file in one request.
      let sent = 0
      for (const chunk of chunkImportRows(payloads)) {
        const outcome = await importClientsChunk(job.id, chunk)
        created += outcome.created
        skipped += outcome.skipped
        sent += chunk.length
        setProgress({ current: sent, total: payloads.length })
      }
      await queryClient.invalidateQueries({ queryKey: CLIENTS_KEY })
      await queryClient.invalidateQueries({ queryKey: CLIENT_IMPORTS_KEY })
      setResult({ created, skipped })
      setImportId(job.id)
      if (pipeline && created > 0) void addToPipeline(job.id)
    } catch {
      setError('Couldn’t finish the import. Try again.')
      setProgress(null)
    } finally {
      setImporting(false)
    }
  }

  /** From the CRM page: the clients this import created become deals in the pipeline. */
  async function addToPipeline(id: string) {
    if (!pipeline || !stage) return
    setIdsFailed(false)
    try {
      const ids = await queryClient.fetchQuery({ ...clientImportIdsQuery(id), staleTime: 0 })
      pipelineRun.start(ids, { pipelineId: pipeline.id, stageId: stage.id })
    } catch {
      setIdsFailed(true)
    }
  }

  function retryPipeline() {
    if (idsFailed && importId) void addToPipeline(importId)
    else pipelineRun.retry()
  }

  const pipelineFailed = idsFailed || pipelineRun.phase === 'failed'
  const preview = file?.rows.slice(0, 5) ?? []

  return (
    <Modal
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
      busy={importing || addingToPipeline}
      wide
      title="Import clients"
      description={
        pipeline
          ? `Bring a spreadsheet of clients into the directory and add them to ${pipeline.name}.`
          : 'Bring a spreadsheet of clients into the directory.'
      }
    >
      <div className="flex max-h-[min(70vh,34rem)] flex-col overflow-hidden sm:max-h-[min(82vh,46rem)]">
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-4">
          {importing || result ? (
            <ImportRun
              importing={importing}
              rowsSent={progress?.current ?? 0}
              rowsTotal={progress?.total ?? 0}
              result={result}
              pipelineStep={
                pipeline
                  ? {
                      where,
                      state:
                        idsFailed || pipelineRun.phase === 'failed'
                          ? 'failed'
                          : pipelineRun.phase === 'done'
                            ? 'done'
                            : pipelineRun.phase === 'running' || (result && result.created > 0)
                              ? 'running'
                              : result
                                ? 'skipped'
                                : 'waiting',
                      run: pipelineRun,
                      error: idsFailed ? 'Couldn’t start adding them. Try again.' : pipelineRun.error,
                    }
                  : undefined
              }
            />
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

            {result ? null : step === 1 ? (
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
                <div className="mb-4">
                  <FormField label="Import name *" htmlFor="import-job-name" hint="Required. A name to find this import later.">
                    <input
                      id="import-job-name"
                      type="text"
                      required
                      className="field-input"
                      value={importName}
                      onChange={(event) => setImportName(event.target.value)}
                      disabled={importing}
                      placeholder="Name this import"
                    />
                  </FormField>
                </div>
                {pipeline && pipeline.stages.length > 0 && (
                  <div className="mb-5">
                    <StagePicker
                      stages={pipeline.stages}
                      value={stage?.id ?? null}
                      onChange={setStageId}
                      label={`Also add them to ${pipeline.name}, in stage`}
                    />
                  </div>
                )}
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
            <Button variant="secondary" onClick={close} disabled={importing} loading={addingToPipeline}>
              {result ? (addingToPipeline ? 'Adding to pipeline…' : 'Done') : 'Cancel'}
            </Button>
          )}
          {result && pipelineFailed && (
            <Button variant="primary" onClick={retryPipeline}>
              Try again
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
            <Button
              variant="primary"
              onClick={() => void runImport()}
              loading={importing}
              disabled={!importName.trim()}
            >
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

const number = new Intl.NumberFormat()

type StepState = 'waiting' | 'running' | 'done' | 'failed' | 'skipped'

interface PipelineStep {
  /** "test 2 › Proposal". */
  where: string
  state: StepState
  run: AddToPipelineRun
  error: string | null
}

/**
 * The import once it starts: one bar for the whole run (import, then the add to
 * the pipeline when opened from the CRM page), a one-line status, and a short
 * checklist of the steps with what each did. The ticked checklist is the summary.
 */
function ImportRun({
  importing,
  rowsSent,
  rowsTotal,
  result,
  pipelineStep,
}: {
  importing: boolean
  rowsSent: number
  rowsTotal: number
  result: ImportResult | null
  pipelineStep?: PipelineStep
}) {
  const importState: StepState = importing ? 'running' : result ? 'done' : 'waiting'
  // Until the import finishes, assume every row will reach the pipeline step; then use the real count.
  const addTotal = pipelineStep
    ? pipelineStep.state === 'skipped'
      ? 0
      : pipelineStep.run.total || result?.created || rowsTotal
    : 0
  const addSent = pipelineStep?.state === 'done' ? addTotal : (pipelineStep?.run.tally.sent ?? 0)
  const done = rowsSent + addSent
  const total = rowsTotal + addTotal
  const percent = total ? Math.min(100, Math.round((done / total) * 100)) : 0
  const failed = pipelineStep?.state === 'failed'
  const finished = importState === 'done' && (!pipelineStep || ['done', 'skipped'].includes(pipelineStep.state))

  const status = failed
    ? 'Stopped'
    : finished
      ? 'Done'
      : importState === 'running'
        ? 'Importing clients…'
        : `Adding to ${pipelineStep?.where.split(' › ')[0] ?? 'the pipeline'}…`

  const tally = pipelineStep?.run.tally
  const addDetail = !pipelineStep
    ? ''
    : pipelineStep.state === 'waiting'
      ? 'Starts when the import finishes'
      : pipelineStep.state === 'skipped'
        ? 'No new clients to add'
        : pipelineStep.state === 'failed'
          ? (pipelineStep.error ?? 'Stopped.')
          : pipelineStep.state === 'done'
            ? [
                `${number.format(tally!.added)} added`,
                tally!.alreadyInPipeline ? `${number.format(tally!.alreadyInPipeline)} already there` : '',
                tally!.notFound ? `${number.format(tally!.notFound)} no longer in your directory` : '',
              ]
                .filter(Boolean)
                .join(' · ')
            : pipelineStep.run.total
              ? `${number.format(tally!.sent)} of ${number.format(pipelineStep.run.total)}`
              : 'Getting ready…'

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-label">
        <span className={`font-medium ${failed ? 'text-danger' : 'text-ink'}`} aria-live="polite">
          {status}
        </span>
        <span className="text-ink-3 tabular-nums">{percent}%</span>
      </div>
      <div
        role="progressbar"
        aria-label="Import progress"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        className="mt-2 h-2 overflow-hidden rounded-full bg-surface-hover"
      >
        <div
          className={`h-full rounded-full transition-[width] duration-200 ${failed ? 'bg-danger' : 'bg-secondary'}`}
          style={{ width: `${percent}%` }}
        />
      </div>

      <ol className="mt-5 flex flex-col gap-3.5" aria-label="Import steps">
        <RunStep
          state={importState}
          title="Import clients"
          detail={
            result
              ? `${number.format(result.created)} added · ${number.format(result.skipped)} skipped`
              : `${number.format(rowsSent)} of ${number.format(rowsTotal)} rows`
          }
        />
        {pipelineStep && <RunStep state={pipelineStep.state} title={`Add to ${pipelineStep.where}`} detail={addDetail} />}
      </ol>
    </div>
  )
}

function RunStep({ state, title, detail }: { state: StepState; title: string; detail: string }) {
  return (
    <li className="flex items-start gap-3">
      <span
        className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full ${
          state === 'done'
            ? 'bg-secondary text-on-secondary'
            : state === 'failed'
              ? 'bg-danger text-on-danger'
              : 'text-ink-3'
        }`}
        aria-hidden
      >
        {state === 'done' ? (
          <Check size={12} strokeWidth={3} />
        ) : state === 'failed' ? (
          <X size={12} strokeWidth={3} />
        ) : state === 'running' ? (
          <Loader2 size={16} strokeWidth={2.25} className="animate-spin" />
        ) : (
          <Circle size={16} strokeWidth={1.75} />
        )}
      </span>
      <span className="min-w-0">
        <span className={`block text-body font-medium ${state === 'waiting' ? 'text-ink-3' : 'text-ink'}`}>{title}</span>
        <span className={`block text-label tabular-nums ${state === 'failed' ? 'text-danger' : 'text-ink-3'}`}>{detail}</span>
      </span>
    </li>
  )
}
