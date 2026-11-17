import { Plus, X } from 'lucide-react'
import { useEffect, useId, useRef } from 'react'
import { Button } from '@/components/Button'
import { FormField } from '@/components/FormField'
import { emptyDetailRows, withBlankDetailRow, type CustomDetailRow } from '@/lib/clients'

interface CustomDetailsEditorProps {
  rows: CustomDetailRow[]
  onChange: (rows: CustomDetailRow[]) => void
  disabled?: boolean
}

/** A small key/value editor: one row per detail, always with an empty row to add another. */
export function CustomDetailsEditor({ rows, onChange, disabled = false }: CustomDetailsEditorProps) {
  const id = useId()
  const lastRowRef = useRef<HTMLDivElement>(null)
  const previousLength = useRef(rows.length)

  useEffect(() => {
    if (rows.length > previousLength.current) {
      lastRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
    previousLength.current = rows.length
  }, [rows.length])

  const setRow = (index: number, patch: Partial<CustomDetailRow>) =>
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  const removeRow = (index: number) =>
    onChange(
      rows.length === 1
        ? emptyDetailRows()
        : withBlankDetailRow(rows.filter((_, i) => i !== index)),
    )
  const addRow = () => onChange([...rows, ...emptyDetailRows()])

  return (
    <FormField label="Custom details (Optional)">
      <div className="flex flex-col gap-2">
        {rows.map((row, index) => (
          <div
            key={index}
            ref={index === rows.length - 1 ? lastRowRef : undefined}
            className="flex items-start gap-2"
          >
            <input
              id={`${id}-key-${index}`}
              aria-label={`Detail ${index + 1} name`}
              value={row.key}
              onChange={(event) => setRow(index, { key: event.target.value })}
              disabled={disabled}
              placeholder="Name"
              className="field-input min-w-0 flex-1"
            />
            <input
              id={`${id}-value-${index}`}
              aria-label={`Detail ${index + 1} value`}
              value={row.value}
              onChange={(event) => setRow(index, { value: event.target.value })}
              disabled={disabled}
              placeholder="Value"
              className="field-input min-w-0 flex-1"
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => (index === rows.length - 1 ? addRow() : removeRow(index))}
              disabled={disabled}
              aria-label={index === rows.length - 1 ? 'Add detail' : `Remove detail ${index + 1}`}
              title={index === rows.length - 1 ? 'Add detail' : 'Remove detail'}
              className="size-9 shrink-0 px-0!"
            >
              {index === rows.length - 1 ? (
                <Plus size={16} strokeWidth={2} aria-hidden />
              ) : (
                <X size={16} strokeWidth={2} aria-hidden />
              )}
            </Button>
          </div>
        ))}
      </div>
    </FormField>
  )
}
