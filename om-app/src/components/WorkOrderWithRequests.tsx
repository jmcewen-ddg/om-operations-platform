import { useState } from 'react'
import type { OmRequest } from '../services/requestService'
import type { OmWorkOrder } from '../services/workOrderService'
import { colors, styles } from '../theme'
import { ConfirmModal } from './ConfirmModal'

const CLOSED_REQUEST_STATUSES = ['Closed', 'Canceled']
const isRequestModifiable = (req: OmRequest) =>
  !CLOSED_REQUEST_STATUSES.includes(req.status ?? '')

const LOCKED_WO_STATUSES = ['Closed', 'Canceled']
const isWorkOrderLocked = (wo: OmWorkOrder) =>
  LOCKED_WO_STATUSES.includes(wo.workOrderStatus ?? '')

type Props = {
  workOrder: OmWorkOrder
  assignedRequests: OmRequest[]
  isSelected: boolean
  isAssignable: boolean
  onSelect: (objectId: number | null) => void
  onUnassignRequest: (requestObjectId: number) => void
  onDeleteWorkOrder: (workOrder: OmWorkOrder) => Promise<void>
  onOpenWorkOrder: (wo: OmWorkOrder) => void
  onOpenRequest: (request: OmRequest) => void
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
  onOpenRequest,
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
        marginBottom: '0.4rem',
        padding: '0.5rem 0.75rem',
        background: colors.white,
        border: `1px solid ${isSelected ? colors.blue : colors.lightGray}`,
        borderLeft: `4px solid ${isSelected ? colors.blue : colors.lightGray}`,
        borderRadius: 6,
        boxShadow: isSelected ? `0 0 0 2px ${colors.blue}22` : 'none',
        opacity: isAssignable ? 1 : 0.65,
        transition: 'border-color 0.15s, box-shadow 0.15s',
        lineHeight: 1.3,
      }}
    >
      {/* ===== Header: radio + WO summary (2 lines) + Delete (top-right) ===== */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <label
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 6,
            flex: '1 1 auto',
            minWidth: 0,
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
              if (isSelected) onSelect(null) // toggle off
            }}
            onChange={() => onSelect(workOrder.objectId)}
            style={{ accentColor: colors.blue, marginTop: 2, flex: '0 0 auto' }}
          />

          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: '1 1 auto' }}>
            {/* Line 1: WO ID · District · Urgency · Status */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                flexWrap: 'wrap',
                fontSize: '0.95em',
              }}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onOpenWorkOrder(workOrder)
                }}
                style={{ ...styles.linkButton, fontWeight: 700 }}
                title="Open work order detail panel"
              >
                {workOrder.workOrderId}
              </button>
              <span style={{ color: colors.darkGray }}>·</span>
              <span>{workOrder.district ?? '—'}</span>
              <span style={{ color: colors.darkGray }}>·</span>
              <span>{workOrder.urgency ?? '—'}</span>
              <span style={{ color: colors.darkGray }}>·</span>
              <StatusPill status={workOrder.workOrderStatus} />
              {!isAssignable && (
                <span style={{ color: colors.darkGray, fontSize: '0.85em' }}>
                  (closed — no new assignments)
                </span>
              )}
            </div>

            {/* Line 2: Title (truncates with ellipsis if too long) */}
            <div
              style={{
                fontSize: '0.9em',
                color: colors.darkestGray,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title={workOrder.workOrderTitle ?? 'Untitled'}
            >
              {workOrder.workOrderTitle ?? 'Untitled'}
            </div>
          </div>
        </label>
      </div>

      {/* ===== Assigned requests block =====
          When 0 requests, render only the header line ("Assigned Requests (0)") —
          no extra "(none)" placeholder. Saves a row per empty card. */}
      <div style={{ marginLeft: '1.5rem', marginTop: '0.3rem' }}>
        <div style={{ color: colors.darkGray, fontSize: '0.8em', fontStyle: 'italic' }}>
          Assigned Requests ({assignedRequests.length})
        </div>

        {assignedRequests.length > 0 && (
          <ul style={{ listStyle: 'none', padding: 0, margin: '0.2rem 0 0' }}>
            {assignedRequests.map((req) => {
              const requestModifiable = isRequestModifiable(req)
              const woLocked = isWorkOrderLocked(workOrder)
              const canUnassign = requestModifiable && !woLocked
              return (
                <li
                  key={req.objectId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '0.15rem 0.4rem',
                    fontSize: '0.85em',
                    color: colors.darkestGray,
                    borderBottom: `1px solid ${colors.lightestGray}`,
                  }}
                >
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                    title={`${req.requestId ?? '(no ID)'} · ${req.urgency ?? '—'} · ${req.status ?? '—'} · ${req.requestTitle ?? 'Untitled'}`}
                  >
                    <button
                      type="button"
                      onClick={() => onOpenRequest(req)}
                      style={styles.linkButton}
                      title="Open request detail panel"
                    >
                      {req.requestId ?? '(no ID)'}
                    </button>
                    {' · '}{req.urgency ?? '—'}
                    {' · '}{req.status ?? '—'}
                    {' · '}{req.requestTitle ?? 'Untitled'}
                  </span>
                  <button
                    type="button"
                    disabled={!canUnassign}
                    title={
                      woLocked
                        ? `This work order is ${workOrder.workOrderStatus} — unassign is locked.`
                        : !requestModifiable
                        ? 'Closed/canceled requests cannot be unassigned'
                        : 'Unassign this request'
                    }
                    onClick={() => onUnassignRequest(req.objectId)}
                    style={canUnassign ? unassignButton : unassignButtonDisabled}
                  >
                    Unassign
                  </button>
                </li>
              )
            })}
          </ul>
        )}
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