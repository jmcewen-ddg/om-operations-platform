import { useEffect, useMemo, useState } from 'react'
import { updateWorkOrder, cancelWorkOrder, type OmWorkOrder } from '../services/workOrderService'
import { colors } from '../theme'
import { ConfirmModal } from './ConfirmModal'
import { loadDomains, type DomainMap } from '../services/domainService'
import { WorkOrderNotesSection } from './WorkOrderNotesSection'
import {
  getAllowedWorkOrderTransitions,
  canEditWorkOrderStatus,
} from '../utils/workOrderStatusHelpers'
import { useUser } from '../lib/userContext'
import { atLeast } from '../lib/roles'
import { workOrderMatrix } from '../domain/workOrder/workOrderMatrix'
import { MatrixFieldProvider } from '../lib/matrixFieldContext'
import { CancelWorkOrderModal } from './CancelWorkOrderModal'

// Lightweight inline EditableField to avoid a missing-module build error.
// Only implements the input shapes used by this panel.
type EditableFieldProps = {
  type: 'text' | 'textarea' | 'select' | 'date' | 'number'
  label: string
  value: any
  onChange?: (v: any) => void
  options?: Array<{ code: string; name: string }>
  helperText?: string
  maxLength?: number
  rows?: number
  wide?: boolean
  step?: number
  min?: number
  disabled?: boolean
}
function EditableField({ type, label, value, onChange, options, helperText, maxLength, rows = 3, wide, step, min, disabled }: EditableFieldProps) {
  const gridCol = wide ? { gridColumn: '1 / -1' } : undefined
  const id = `ef-${label.replace(/\s+/g, '-')}`

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    if (!onChange) return
    if (type === 'number') {
      const v = e.target.value
      onChange(v === '' ? null : Number(v))
    } else if (type === 'date') {
      const v = e.target.value
      onChange(v === '' ? null : Date.parse(v))
    } else {
      onChange(e.target.value === '' ? null : e.target.value)
    }
  }

  return (
    <div style={gridCol}>
      <div style={{ color: colors.darkGray, fontSize: '0.75em', textTransform: 'uppercase' }}>{label}</div>
      {type === 'textarea' ? (
        <textarea id={id} value={value ?? ''} onChange={handleChange} rows={rows} maxLength={maxLength}
          style={{ width: '100%' }} />
      ) : type === 'select' ? (
        <select id={id} value={value ?? ''} onChange={handleChange} disabled={disabled} style={{ width: '100%' }}>
          <option value="">(none)</option>
          {options?.map((o) => <option key={o.code} value={o.code}>{o.name}</option>)}
        </select>
      ) : (
        <input id={id} type={type === 'number' ? 'number' : type === 'date' ? 'date' : 'text'}
          value={
            type === 'date'
              ? (value ? new Date(value).toISOString().slice(0, 10) : '')
              : (value ?? '')
          }
          onChange={handleChange}
          step={step}
          min={min}
          maxLength={maxLength}
          disabled={disabled}
          style={{ width: '100%' }} />
      )}
      {helperText && <div style={{ color: colors.darkGray, fontSize: '0.72em', marginTop: 4 }}>{helperText}</div>}
    </div>
  )
}

type Props = {
  workOrder: OmWorkOrder | null
  onClose: () => void
  /** Called with the updated work order after a successful save.
   *  Parent uses this to update its list state so the row reflects new values. */
  onWorkOrderUpdated?: (updated: OmWorkOrder) => void
  /** Hand back to App's existing delete flow (which also unassigns attached requests). */
  onRequestDelete?: (wo: OmWorkOrder) => void
}

/**
 * Status → date field that should auto-stamp when status reaches that value
 * (and the date hasn't been set yet on the saved record).
 *
 * NOTE: We don't auto-stamp scheduled_* dates because those are
 * intentions, not events.
 */
const STATUS_DATE_STAMPS: Partial<Record<string, keyof OmWorkOrder>> = {
  'In Progress': 'actualStartDate',
  Completed:    'completedDate',
  Closed:       'closedDate',
}

export function WorkOrderDetailPanel({
  workOrder, onClose, onWorkOrderUpdated, onRequestDelete,
}: Props) {
  const user = useUser()

  // ---- One draft object holds ALL pending edits ----
  const [draft, setDraft] = useState<Partial<OmWorkOrder>>({})
  const [isEditing, setIsEditing] = useState(false)
  const [domains, setDomains] = useState<DomainMap | null>(null)

  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isDiscardConfirmOpen, setIsDiscardConfirmOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)

  const hasUnsavedChanges = isEditing && Object.keys(draft).length > 0

  const canCancel =
    atLeast(user.role, 'tier2Triager') &&
    workOrder?.workOrderStatus !== 'Canceled' &&
    workOrder?.workOrderStatus !== 'Closed'

  // Helper: get the live value for any field (draft override → saved value).
  function v<K extends keyof OmWorkOrder>(key: K): OmWorkOrder[K] | null {
    if (key in draft) return draft[key] as OmWorkOrder[K]
    return (workOrder?.[key] ?? null) as OmWorkOrder[K] | null
  }

  // Helper: write a field into draft. If the new value matches the saved
  // value, REMOVE the key from draft so hasUnsavedChanges stays accurate.
  function setField<K extends keyof OmWorkOrder>(key: K, value: OmWorkOrder[K] | null) {
    setDraft((d) => {
      const next = { ...d }
      const savedValue = workOrder?.[key] ?? null
      const isSame = (value ?? null) === (savedValue ?? null)
      if (isSame) delete next[key]
      else next[key] = value as OmWorkOrder[K]
      return next
    })
  }

  // ---- Save ----
  async function handleSave() {
    if (!workOrder) return
    if (!hasUnsavedChanges) { setIsEditing(false); return }

    const changes: Partial<OmWorkOrder> = { ...draft }

    // Auto-stamp the matching date field when status enters a stamp-worthy state
    // and the corresponding date hasn't been set yet on the saved record.
    const newStatus = (changes.workOrderStatus ?? workOrder.workOrderStatus) as string | null
    if (newStatus && STATUS_DATE_STAMPS[newStatus]) {
      const dateKey = STATUS_DATE_STAMPS[newStatus]!
      if (!workOrder[dateKey] && changes[dateKey] === undefined) {
        (changes as any)[dateKey] = Date.now()
      }
    }

    setIsSaving(true)
    setSaveError(null)
    try {
      await updateWorkOrder(workOrder.objectId, changes)
      const updated: OmWorkOrder = { ...workOrder, ...changes }
      onWorkOrderUpdated?.(updated)
      setDraft({})
      setIsEditing(false)
    } catch (err) {
      console.error('Failed to save work order:', err)
      setSaveError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setIsSaving(false)
    }
  }

  // ---- Close handling ----
  function attemptClose() {
    if (hasUnsavedChanges) setIsDiscardConfirmOpen(true)
    else onClose()
  }
  function confirmDiscard() {
    setIsDiscardConfirmOpen(false)
    setDraft({}); setIsEditing(false); onClose()
  }
  function cancelEdit() {
    if (hasUnsavedChanges) setIsDiscardConfirmOpen(true)
    else { setDraft({}); setIsEditing(false) }
  }

  // ---- Load coded-value domains once ----
  // (Cached in domainService — cheap on remount. We mostly need the WO status
  //  domain here, but loading the full set keeps consistency with the request panel.)
  useEffect(() => {
    let cancelled = false
    loadDomains()
      .then((d) => { if (!cancelled) setDomains(d) })
      .catch((err) => console.error('Failed to load domains', err))
    return () => { cancelled = true }
  }, [])

  // ---- Reset drafts when a different WO is loaded ----
  useEffect(() => {
    setDraft({}); setIsEditing(false); setSaveError(null)
  }, [workOrder?.globalId])

  // ---- Escape closes ----
  useEffect(() => {
    if (!workOrder) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') attemptClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workOrder, hasUnsavedChanges])

  // ---- Status options restricted by current saved status ----
  // MUST come before the early return below so the hook count stays stable.
  const statusOptions = useMemo(() => {
    const allowed = getAllowedWorkOrderTransitions(workOrder?.workOrderStatus ?? null)
    return allowed.map((s) => ({ code: s, name: s }))
  }, [workOrder?.workOrderStatus])

  if (!workOrder) return null

  // suppress unused warning until we wire domain-driven dropdowns for WO
  void domains

  return (
    <>
      {/* ===== Backdrop ===== */}
      <div
        onClick={attemptClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(71, 75, 79, 0.45)', zIndex: 900 }}
      />

      {/* ===== Side panel ===== */}
      <aside
        style={{
          position: 'fixed', top: 0, right: 0, height: '100vh',
          width: 'min(820px, 95vw)', background: colors.white,
          boxShadow: '-4px 0 20px rgba(0,0,0,0.15)',
          borderLeft: `1px solid ${colors.lightGray}`,
          display: 'flex', flexDirection: 'column', zIndex: 950,
        }}
      >
        {/* ===== Header ===== */}
        <header
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '1rem 1.25rem', background: colors.blue, color: colors.white,
            flex: '0 0 auto',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: '0.8em', opacity: 0.85 }}>Work Order</div>
            <div style={{ fontSize: '1.1em', fontWeight: 700 }}>
              {workOrder.workOrderId ?? '(no ID yet)'}
            </div>
          </div>
          <button
            type="button" onClick={attemptClose} aria-label="Close panel"
            style={{
              background: 'transparent', color: colors.white,
              border: `1px solid ${colors.white}55`, borderRadius: 4,
              width: 32, height: 32, fontSize: '1.2em', cursor: 'pointer', lineHeight: 1,
            }}
          >✕</button>
        </header>

        {/* ===== Body ===== */}
        
<div style={{ flex: '1 1 auto', overflowY: 'auto', padding: '1rem 1.25rem', color: colors.darkestGray }}>
  <MatrixFieldProvider
    matrix={workOrderMatrix}
    role={user.role}
    status={workOrder.workOrderStatus ?? 'Draft'}
    isEditing={isEditing}
  >


          {/* --------- Classification --------- */}
          <Section title="Classification" defaultOpen>
            {isEditing ? (
              <>
                <EditableField type="text" label="Title" maxLength={255} wide
                  value={v('workOrderTitle') as string | null}
                  onChange={(val) => setField('workOrderTitle', val)} />
                <EditableField type="text" label="Type" maxLength={100}
                  value={v('workOrderType') as string | null}
                  helperText="No domain yet — free text for now."
                  onChange={(val) => setField('workOrderType', val)} />
                <Field label="Urgency" value={workOrder.urgency}
                       helperText="Read-only — derived in SQL from attached requests." />
                <Field label="District" value={workOrder.district}
                       helperText="Set at create time; not editable here." />
                <EditableField type="textarea" label="Scope of Work" wide
                  maxLength={4000} rows={4}
                  value={v('scopeOfWork') as string | null}
                  onChange={(val) => setField('scopeOfWork', val)} />
              </>
            ) : (
              <>
                <Field label="Title"         value={workOrder.workOrderTitle} wide />
                <Field label="Type"          value={workOrder.workOrderType} />
                <Field label="Urgency"       value={workOrder.urgency} />
                <Field label="District"      value={workOrder.district} />
                <Field label="Scope of Work" value={workOrder.scopeOfWork} wide />
              </>
            )}
          </Section>

          {/* --------- Status & Lifecycle --------- */}
          <Section title="Status & Lifecycle" defaultOpen>
            {isEditing ? (
              <>
                <EditableField type="select" label="Status"
                  value={v('workOrderStatus') as string | null}
                  options={statusOptions}
                  disabled={!canEditWorkOrderStatus(workOrder.workOrderStatus)}
                  helperText={
                    canEditWorkOrderStatus(workOrder.workOrderStatus)
                      ? 'Status follows the WO lifecycle transitions.'
                      : 'Terminal status — no further changes allowed.'
                  }
                  onChange={(val) => setField('workOrderStatus', val)} />
                <Field label="Completed Date" value={formatDate(v('completedDate') as number | null)}
                       helperText="Auto-stamped when status reaches Completed." />
                <Field label="Closed Date" value={formatDate(v('closedDate') as number | null)}
                       helperText="Auto-stamped when status reaches Closed." />
                <EditableField type="textarea" label="Completion Notes" wide
                  maxLength={4000} rows={3}
                  value={v('completionNotes') as string | null}
                  onChange={(val) => setField('completionNotes', val)} />
                <EditableField type="textarea" label="Cancellation Reason" wide
                  maxLength={1000} rows={2}
                  value={v('cancellationReason') as string | null}
                  helperText="Free text for now; may become a dropdown later."
                  onChange={(val) => setField('cancellationReason', val)} />
              </>
            ) : (
              <>
                <Field label="Status"              value={workOrder.workOrderStatus} />
                <Field label="Completed Date"      value={formatDate(workOrder.completedDate)} />
                <Field label="Closed Date"         value={formatDate(workOrder.closedDate)} />
                <Field label="Completion Notes"    value={workOrder.completionNotes} wide />
                <Field label="Cancellation Reason" value={workOrder.cancellationReason} wide />
              </>
            )}
          </Section>

          {/* --------- Assignment --------- */}
          <Section title="Assignment" defaultOpen={false}>
            {isEditing ? (
              <>
                <EditableField type="text" label="Assigned To Name" maxLength={255}
                  value={v('assignedToName') as string | null}
                  onChange={(val) => setField('assignedToName', val)} />
                <EditableField type="text" label="Assigned To Email" maxLength={255}
                  value={v('assignedToEmail') as string | null}
                  onChange={(val) => setField('assignedToEmail', val)} />
                <EditableField type="text" label="Assigned Team" maxLength={255}
                  value={v('assignedTeam') as string | null}
                  onChange={(val) => setField('assignedTeam', val)} />
              </>
            ) : (
              <>
                <Field label="Assigned To Name"  value={workOrder.assignedToName} />
                <Field label="Assigned To Email" value={workOrder.assignedToEmail} />
                <Field label="Assigned Team"     value={workOrder.assignedTeam} />
              </>
            )}
          </Section>

          {/* --------- Schedule --------- */}
          <Section title="Schedule" defaultOpen={false}>
            {isEditing ? (
              <>
                <EditableField type="date" label="Scheduled Start"
                  value={v('scheduledStartDate') as number | null}
                  onChange={(val) => setField('scheduledStartDate', val)} />
                <EditableField type="date" label="Scheduled End"
                  value={v('scheduledEndDate') as number | null}
                  onChange={(val) => setField('scheduledEndDate', val)} />
                <EditableField type="date" label="Actual Start"
                  value={v('actualStartDate') as number | null}
                  helperText="Auto-stamped when status reaches In Progress."
                  onChange={(val) => setField('actualStartDate', val)} />
                <EditableField type="date" label="Actual End"
                  value={v('actualEndDate') as number | null}
                  onChange={(val) => setField('actualEndDate', val)} />
              </>
            ) : (
              <>
                <Field label="Scheduled Start" value={formatDate(workOrder.scheduledStartDate)} />
                <Field label="Scheduled End"   value={formatDate(workOrder.scheduledEndDate)} />
                <Field label="Actual Start"    value={formatDate(workOrder.actualStartDate)} />
                <Field label="Actual End"      value={formatDate(workOrder.actualEndDate)} />
              </>
            )}
          </Section>

          {/* --------- Effort & Cost --------- */}
          <Section title="Effort & Cost" defaultOpen={false}>
            {isEditing ? (
              <>
                <EditableField type="number" label="Estimated Hours" step={0.25} min={0}
                  value={v('estimatedHours') as number | null}
                  onChange={(val) => setField('estimatedHours', val)} />
                <EditableField type="number" label="Actual Hours" step={0.25} min={0}
                  value={v('actualHours') as number | null}
                  onChange={(val) => setField('actualHours', val)} />
                <EditableField type="number" label="Estimated Cost" step={0.01} min={0}
                  value={v('estimatedCost') as number | null}
                  onChange={(val) => setField('estimatedCost', val)} />
                <EditableField type="number" label="Actual Cost" step={0.01} min={0}
                  value={v('actualCost') as number | null}
                  onChange={(val) => setField('actualCost', val)} />
              </>
            ) : (
              <>
                <Field label="Estimated Hours" value={workOrder.estimatedHours} />
                <Field label="Actual Hours"    value={workOrder.actualHours} />
                <Field label="Estimated Cost"  value={formatMoney(workOrder.estimatedCost)} />
                <Field label="Actual Cost"     value={formatMoney(workOrder.actualCost)} />
              </>
            )}
          </Section>

          {/* --------- Notes --------- */}
          <WorkOrderNotesSection workOrderGlobalId={workOrder.globalId} defaultOpen={false} />

          {/* --------- System (read-only) --------- */}
          <Section title="System" defaultOpen={false}>
            <Field label="OBJECTID"         value={workOrder.objectId} />
            <Field label="GlobalID"         value={workOrder.globalId} />
            <Field label="Work Order ID"    value={workOrder.workOrderId} />
            <Field label="Created By"       value={workOrder.createdUser} />
            <Field label="Created Date"     value={formatDate(workOrder.createdDate)} />
            <Field label="Last Edited By"   value={workOrder.lastEditedUser} />
            <Field label="Last Edited Date" value={formatDate(workOrder.lastEditedDate)} />
            <Field label="Deleted"          value={workOrder.deleted} />
            <Field label="Deleted Date"     value={formatDate(workOrder.deletedDate)} />
            <Field label="Deleted By"       value={workOrder.deletedBy} />
          </Section>
          </MatrixFieldProvider>
        </div>

        {/* ===== Footer ===== */}
        <footer
          style={{
            flex: '0 0 auto', padding: '0.75rem 1.25rem',
            borderTop: `1px solid ${colors.lightGray}`, background: colors.lightestGray,
            display: 'flex', justifyContent: 'flex-end', gap: 8,
          }}
        >
          {!isEditing ? (
            <>
              {onRequestDelete && (
                <button
                  type="button"
                  onClick={() => onRequestDelete(workOrder)}
                  style={dangerBtn}
                  title="Soft-delete this work order"
                >
                  Delete
                </button>
              )}
              
{canCancel && (
      <button
        type="button"
        onClick={() => setCancelOpen(true)}
        style={{
          padding: '0.4rem 0.9rem',
          background: '#FFFFFF',
          color: '#FFAC0F',
          border: '1px solid #FFAC0F',
          borderRadius: 4,
          cursor: 'pointer',
          fontWeight: 600,
        }}
        title="Cancel this work order"
      >
        Cancel Work Order
      </button>
    )}

              <button type="button" onClick={attemptClose} style={secondaryBtn}>Close</button>
              <button type="button" onClick={() => setIsEditing(true)} style={primaryBtn(false)}>Edit</button>
            </>
          ) : (
            <>
              {saveError && (
                <div
                  style={{ flex: '1 1 auto', color: '#9B1C1C', fontSize: '0.85em', alignSelf: 'center' }}
                  role="alert"
                >
                  ⚠️ {saveError}
                </div>
              )}
              <button
                type="button" disabled={isSaving} onClick={cancelEdit}
                style={{ ...secondaryBtn, opacity: isSaving ? 0.6 : 1 }}
              >Cancel</button>
              <button
                type="button" disabled={isSaving || !hasUnsavedChanges} onClick={handleSave}
                style={primaryBtn(isSaving || !hasUnsavedChanges)}
              >
                {isSaving ? 'Saving…' : 'Save'}
              </button>
            </>
          )}
        </footer>
      </aside>


      <ConfirmModal
        isOpen={isDiscardConfirmOpen}
        title="Discard unsaved changes?"
        confirmLabel="Discard"
        confirmVariant="danger"
        onCancel={() => setIsDiscardConfirmOpen(false)}
        onConfirm={confirmDiscard}
        message={<>You have unsaved edits to this work order. If you close now, those changes will be lost.</>}
      />

      <CancelWorkOrderModal
        isOpen={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={async (reason: string) => {
          const patch = await cancelWorkOrder(workOrder.objectId, reason)
          const updated: OmWorkOrder = { ...workOrder, ...patch }
          onWorkOrderUpdated?.(updated)
          setCancelOpen(false)
        }}
        workOrderId={workOrder.workOrderId ?? '(no ID)'}
      />
    </>
  )
}

// ============================================================
// Local helpers (duplicated from RequestDetailPanel for now).
// If we want one source of truth later, hoist into src/components/_panelKit.tsx.
// ============================================================

const secondaryBtn: React.CSSProperties = {
  background: colors.white, color: colors.darkestGray,
  border: `1px solid ${colors.gray}`, borderRadius: 4,
  padding: '0.4rem 0.9rem', cursor: 'pointer',
}

function primaryBtn(disabled: boolean): React.CSSProperties {
  return {
    background: disabled ? colors.gray : colors.green,
    color: disabled ? colors.white : colors.darkestGray,
    border: 'none', borderRadius: 4, padding: '0.4rem 0.9rem',
    cursor: disabled ? 'not-allowed' : 'pointer', fontWeight: 600,
  }
}

const dangerBtn: React.CSSProperties = {
  background: 'transparent', color: '#B00020',
  border: `1px solid #B00020`, borderRadius: 4,
  padding: '0.4rem 0.9rem', cursor: 'pointer', fontWeight: 600,
}

function formatDate(epochMs: number | null | undefined): string | null {
  if (!epochMs) return null
  try { return new Date(epochMs).toLocaleString() } catch { return null }
}

function formatMoney(n: number | null | undefined): string | null {
  if (n === null || n === undefined) return null
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD' })
}

type SectionProps = { title: string; defaultOpen?: boolean; children: React.ReactNode }
function Section({ title, defaultOpen = true, children }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section style={{
      marginBottom: '1rem', border: `1px solid ${colors.lightGray}`,
      borderRadius: 6, background: colors.white,
    }}>
      <button type="button" onClick={() => setOpen((x) => !x)}
        style={{
          width: '100%', textAlign: 'left',
          background: colors.lightestGray, color: colors.darkestGray,
          border: 'none', padding: '0.5rem 0.75rem',
          fontWeight: 700, cursor: 'pointer', borderRadius: '6px 6px 0 0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
        <span>{title}</span>
        <span style={{ color: colors.darkGray, fontWeight: 400 }}>{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div style={{
          padding: '0.5rem 0.75rem', display: 'grid',
          gridTemplateColumns: '1fr 1fr', gap: '0.4rem 1.5rem', fontSize: '0.9em',
        }}>
          {children}
        </div>
      )}
    </section>
  )
}

type FieldProps = {
  label: string
  value: string | number | null | undefined
  wide?: boolean
  helperText?: string
}
function Field({ label, value, wide, helperText }: FieldProps) {
  const display = value === null || value === undefined || value === '' ? '—' : String(value)
  return (
    <div style={{ gridColumn: wide ? '1 / -1' : 'auto' }}>
      <div style={{ color: colors.darkGray, fontSize: '0.75em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ color: colors.darkestGray, wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
        {display}
      </div>
      {helperText && (
        <div style={{ color: colors.darkGray, fontSize: '0.72em', marginTop: 2 }}>{helperText}</div>
      )}
    </div>
  )
}