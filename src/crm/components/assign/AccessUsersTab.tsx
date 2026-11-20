import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/Button'
import { FormError } from '@/components/FormField'
import { Loader } from '@/components/Loader'
import { Modal, ModalFooter } from '@/components/Modal'
import { ApiError } from '@/lib/api'
import { CRM_KEY, crmAccessListQuery, saveCrmAccessList, type AccessCandidate } from '@/lib/crm'

const number = new Intl.NumberFormat()

/**
 * Access users: who can work in this pipeline and own its deals. Removing
 * someone who owns deals asks whether to unassign them or transfer them to
 * someone staying.
 */
export function AccessUsersTab({
  pipelineId,
  canManage,
  onBusyChange,
}: {
  pipelineId: string
  canManage: boolean
  onBusyChange: (busy: boolean) => void
}) {
  const queryClient = useQueryClient()
  const list = useQuery(crmAccessListQuery(pipelineId))
  /** Ticks being edited; null = untouched (shows the saved list). */
  const [draft, setDraft] = useState<Set<string> | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [handover, setHandover] = useState<AccessCandidate[] | null>(null)
  const [saved, setSaved] = useState(false)

  if (list.isPending) {
    return (
      <div className="grid flex-1 place-items-center py-12">
        <Loader label="Loading people" />
      </div>
    )
  }
  if (list.isError) {
    return (
      <div className="flex-1 py-10 text-center">
        <p className="text-label text-ink-2">Couldn’t load the people for this pipeline.</p>
        <Button size="sm" variant="secondary" className="mt-3" onClick={() => void list.refetch()}>
          Try again
        </Button>
      </div>
    )
  }

  const people = list.data
  const onList = new Set(people.filter((p) => p.onList).map((p) => p.userId))
  const ticked = draft ?? onList
  const changed = draft !== null && (draft.size !== onList.size || [...draft].some((id) => !onList.has(id)))
  const leavingWithDeals = people.filter((p) => p.onList && !ticked.has(p.userId) && p.dealCount > 0)

  function toggle(userId: string) {
    setSaved(false)
    setDraft((current) => {
      const next = new Set(current ?? onList)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  async function save(choice?: { mode: 'unassign' | 'transfer'; toUserId?: string }) {
    setSaving(true)
    setError(null)
    onBusyChange(true)
    try {
      await saveCrmAccessList(pipelineId, [...ticked], choice)
      await queryClient.invalidateQueries({ queryKey: CRM_KEY })
      setDraft(null)
      setHandover(null)
      setSaved(true)
    } catch (caught) {
      setError(caught instanceof ApiError && caught.status !== 500 ? caught.message : 'Couldn’t save. Try again.')
    } finally {
      setSaving(false)
      onBusyChange(false)
    }
  }

  return (
    <>
    <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
      <p className="px-1 text-label text-ink-2">
        People on this pipeline can see it and own its deals. The Owner sees every pipeline and is never listed.
      </p>
      {people.length === 0 ? (
        <p className="py-6 text-center text-label text-ink-3">
          Nobody else has CRM access yet. Give it in System › Users first.
        </p>
      ) : (
        <ul className="flex flex-col gap-2" aria-label="People">
          {people.map((person) => {
            const checked = ticked.has(person.userId)
            return (
              <li key={person.userId}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  disabled={!canManage || saving}
                  onClick={() => toggle(person.userId)}
                  className="card-3d flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left disabled:cursor-default"
                >
                  <span
                    aria-hidden
                    className={`grid size-4 shrink-0 place-items-center rounded border ${
                      checked ? 'border-secondary bg-secondary text-on-secondary' : 'border-line-strong bg-surface text-transparent'
                    }`}
                  >
                    <Check size={11} strokeWidth={3} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body font-medium text-ink">{person.fullName}</span>
                    <span className="block truncate text-caption text-ink-3">{person.email}</span>
                  </span>
                  <span className="shrink-0 rounded-md bg-surface-hover px-1.5 py-0.5 text-micro font-semibold capitalize text-ink-2">
                    {person.role}
                  </span>
                  <span className="w-16 shrink-0 text-right text-caption text-ink-3 tabular-nums">
                    {person.dealCount ? `${number.format(person.dealCount)} deal${person.dealCount === 1 ? '' : 's'}` : ''}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      <FormError message={error} />
    </div>
      {/* Pinned under the list, like the other drawers' actions. */}
      {canManage && (
        <div className="flex items-center justify-end gap-2 border-t border-line bg-canvas/60 px-5 py-3.5">
          {saved && !changed && <span className="mr-auto text-caption text-ink-3">Saved</span>}
          <Button variant="secondary" disabled={!changed || saving} onClick={() => setDraft(null)}>
            Reset
          </Button>
          <Button
            variant="primary"
            disabled={!changed}
            loading={saving && !handover}
            onClick={() => (leavingWithDeals.length ? setHandover(leavingWithDeals) : void save())}
          >
            Save access
          </Button>
        </div>
      )}

      <HandoverDialog
        leaving={handover}
        staying={people.filter((p) => ticked.has(p.userId) && p.eligible)}
        saving={saving}
        onCancel={() => setHandover(null)}
        onChoose={(choice) => void save(choice)}
      />
    </>
  )
}

/** People leaving the list own deals: unassign them, or transfer them all to someone staying. */
function HandoverDialog({
  leaving,
  staying,
  saving,
  onCancel,
  onChoose,
}: {
  leaving: AccessCandidate[] | null
  staying: AccessCandidate[]
  saving: boolean
  onCancel: () => void
  onChoose: (choice: { mode: 'unassign' | 'transfer'; toUserId?: string }) => void
}) {
  const [target, setTarget] = useState('')
  const total = (leaving ?? []).reduce((sum, p) => sum + p.dealCount, 0)
  const names = (leaving ?? []).map((p) => `${p.fullName} (${number.format(p.dealCount)})`).join(', ')
  const targetName = staying.find((p) => p.userId === target)?.fullName

  return (
    <Modal
      open={leaving !== null}
      onOpenChange={(open) => !open && !saving && onCancel()}
      busy={saving}
      title="Their deals need a new home"
      description={`${names} ${leaving && leaving.length === 1 ? 'owns' : 'own'} ${number.format(total)} deal${total === 1 ? '' : 's'} in this pipeline.`}
    >
      <div className="px-5 pt-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-label font-medium text-ink-2">Transfer them to</span>
          <select
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            disabled={saving || staying.length === 0}
            className="field-input h-10"
          >
            <option value="">{staying.length ? 'Choose a person' : 'Nobody staying can own deals'}</option>
            {staying.map((p) => (
              <option key={p.userId} value={p.userId}>
                {p.fullName}
              </option>
            ))}
          </select>
        </label>
      </div>
      <ModalFooter>
        <Button variant="secondary" disabled={saving} onClick={() => onChoose({ mode: 'unassign' })}>
          Unassign them
        </Button>
        <Button
          variant="primary"
          disabled={saving || !target}
          loading={saving}
          onClick={() => onChoose({ mode: 'transfer', toUserId: target })}
        >
          {targetName ? `Transfer to ${targetName}` : 'Transfer'}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
