import { useState } from 'react'
import type { OmRequest } from '../services/requestService'
import type { OmWorkOrder } from '../services/workOrderService'
import { colors, styles } from '../theme'
import { ConfirmModal } from './ConfirmModal'

const CLOSED_REQUEST_STATUSES = ['Closed', 'Canceled']
const isRequestModifiable = (req: OmRequest) =>
  !CLOSED_REQUEST_STATUSES.includes(req.status ?? '')

type Props = {
  workOrder: OmWorkOrder
  assignedRequests: OmRequest[]
  isSelected: boolean
  isAssignable: boolean
  onSelect: (objectId: number | null) => void
  onUnassignRequest: (requestObjectId: number) => void
  onDeleteWorkOrder: (workOrder: OmWorkOrder) => Promise<void>
  onOpenWorkOrder: (wo: OmWorkOrder) => void
}

export function WorkOrderWithRequests({
  workOrder,
  assignedRequests,
  isSelected,
  isAssignable,
  onSelect,
  onUnassignRequest,
  onDeleteWorkOrder,
  onOpenWorkOrder,
}: Props) {
  // ---- Local UI state for the delete confirmation ----
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  async function handleConfirmDelete() {
    setIsDeleting(true)
    try {
      await onDeleteWorkOrder(workOrder)
      setIsConfirmOpen(false)
    } catch {
      // Parent already surfaced the error message. Keep modal open so user can retry/cancel.
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div
      style={{
        marginBottom: '0.75rem',
        padding: '0.75rem 1rem',
        background: colors.white,
        border: `1px solid ${isSelected ? colors.blue : colors.lightGray}`,
        borderLeft: `4px solid ${isSelected ? colors.blue : colors.lightGray}`,
        borderRadius: 6,
        boxShadow: isSelected ? `0 0 0 2px ${colors.blue}22` : 'none',
        opacity: isAssignable ? 1 : 0.65,
        transition: 'border-color 0.15s, box-shadow 0.15s',
      }}
    >
      {/* ===== Header row: radio + work order summary ===== */}
      <label
        style={{
          display: 'block',
          cursor: isAssignable ? 'pointer' : 'not-allowed',
          color: colors.darkestGray,
        }}
      >
        <input
          type="radio"
          name="workOrder"
          checked={isSelected}
          disabled={!isAssignable}
          onClick={() => {
            if (isSelected) onSelect(null)   // toggle off
          }}
          onChange={() => onSelect(workOrder.objectId)}
          style={{ accentColor: colors.blue, marginRight: 6 }}
        />
        
<button
  type="button"
  onClick={(e) => {
    e.preventDefault()        // don't trigger the surrounding <label>'s radio
    e.stopPropagation()
    onOpenWorkOrder(workOrder)
  }}
  style={styles.linkButton}
  title="Open work order detail panel"
>
  {workOrder.workOrderId}
</button>

        {' · '}{workOrder.district ?? '—'}
        {' · '}{workOrder.urgency ?? '—'}
        {' · '}
        <StatusPill status={workOrder.workOrderStatus} />
        {' · '}{workOrder.workOrderTitle ?? 'Untitled'}
        {!isAssignable && (
          <span style={{ marginLeft: '0.5rem', color: colors.darkGray, fontSize: '0.85em' }}>
            (closed — no new assignments)
          </span>
        )}
      </label>

      {/* ===== Assigned requests block ===== */}
      <div style={{ marginLeft: '1.75rem', marginTop: '0.5rem' }}>
        <div style={{ color: colors.darkGray, fontSize: '0.85em', fontStyle: 'italic' }}>
          Assigned Requests ({assignedRequests.length})
        </div>

        {assignedRequests.length === 0 ? (
          <div style={{ color: colors.gray, fontSize: '0.9em', fontStyle: 'italic' }}>
            (none)
          </div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: '0.35rem 0 0' }}>
            {assignedRequests.map((req) => {
              const modifiable = isRequestModifiable(req)
              return (
                <li
                  key={req.objectId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '0.25rem 0.5rem',
                    fontSize: '0.9em',
                    color: colors.darkestGray,
                    borderBottom: `1px solid ${colors.lightestGray}`,
                  }}
                >
                  <span style={{ flex: 1 }}>
                    <strong>{req.requestId}</strong>
                    {' · '}{req.urgency ?? '—'}
                    {' · '}{req.status ?? '—'}
                  </span>
                  <button
                    type="button"
                    disabled={!modifiable}
                    title={modifiable ? 'Unassign this request' : 'Closed/canceled requests cannot be unassigned'}
                    onClick={() => onUnassignRequest(req.objectId)}
                    style={modifiable ? unassignButton : unassignButtonDisabled}
                  >
                    Unassign
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* ===== Footer row: destructive actions ===== */}
      <div
        style={{
          marginTop: '0.75rem',
          paddingTop: '0.5rem',
          borderTop: `1px solid ${colors.lightestGray}`,
          display: 'flex',
          justifyContent: 'flex-end',
        }}
      >
        <button
          type="button"
          onClick={() => setIsConfirmOpen(true)}
          style={deleteButton}
          title="Soft-delete this work order. Attached requests will revert to Unassigned."
        >
          Delete Work Order
        </button>
      </div>

      {/* ===== Confirm modal ===== */}
      <ConfirmModal
        isOpen={isConfirmOpen}
        title="Delete this work order?"
        confirmLabel="Delete Work Order"
        confirmVariant="danger"
        isWorking={isDeleting}
        onCancel={() => setIsConfirmOpen(false)}
        onConfirm={handleConfirmDelete}
        message={
          <>
            <p style={{ margin: '0 0 0.5rem 0' }}>
              You are about to soft-delete work order{' '}
              <strong>{workOrder.workOrderId}</strong>.
            </p>
            {assignedRequests.length > 0 ? (
              <p style={{ margin: 0 }}>
                {assignedRequests.length === 1
                  ? 'The 1 attached request will revert to Unassigned.'
                  : `The ${assignedRequests.length} attached requests will revert to Unassigned.`}
              </p>
            ) : (
              <p style={{ margin: 0, color: colors.darkGray }}>
                No requests are currently attached.
              </p>
            )}
            <p style={{ margin: '0.5rem 0 0 0', color: colors.darkGray, fontSize: '0.9em' }}>
              Soft-deleted records are hidden from normal views but remain visible to admins.
            </p>
          </>
        }
      />
    </div>
  )
}

// ============================================================
// Small helpers / local styles
// ============================================================

const unassignButton = {
  background: colors.orange,
  color: colors.darkestGray,
  border: 'none',
  borderRadius: 4,
  padding: '0.2rem 0.6rem',
  fontSize: '0.85em',
  fontWeight: 600,
  cursor: 'pointer',
} as const

const unassignButtonDisabled = {
  ...unassignButton,
  background: colors.lightGray,
  color: colors.darkGray,
  cursor: 'not-allowed',
} as const

const deleteButton = {
  background: 'transparent',
  color: '#B00020',
  border: `1px solid #B00020`,
  borderRadius: 4,
  padding: '0.25rem 0.7rem',
  fontSize: '0.85em',
  fontWeight: 600,
  cursor: 'pointer',
} as const

function StatusPill({ status }: { status: string | null | undefined }) {
  const s = status ?? '—'
  const bg = pillColor(s)
  return (
    <span
      style={{
        display: 'inline-block',
        background: bg,
        color: colors.darkestGray,
        padding: '0.1rem 0.5rem',
        borderRadius: 999,
        fontSize: '0.8em',
        fontWeight: 600,
      }}
    >
      {s}
    </span>
  )
}

function pillColor(status: string): string {
  switch (status) {
    case 'Draft':       return colors.lightGray
    case 'In Progress': return colors.blue + '33'   // tinted blue
    case 'On Hold':     return colors.orange + '44' // tinted orange
    case 'Completed':   return colors.green + '55'  // tinted green
    case 'Canceled':
    case 'Closed':      return colors.gray
    default:            return colors.lightestGray
  }
}