import { colors } from '../theme'
import type { OmRequest } from '../services/requestService'

type Props = {
  request: OmRequest

  /** Click the row body to open the request detail panel. */
  onSelect?: (request: OmRequest) => void

  /** Click the action button to open the Return-to-Unassigned modal. */
  onReturnClick?: (request: OmRequest) => void

  /** Highlight when this row matches the currently-selected detail panel. */
  isSelected?: boolean
}

/**
 * One request row inside a ProgramAssignmentsGroup.
 *
 * Intentionally presentational:
 *  - knows nothing about MIs/CPs or fetching
 *  - emits events upward; parent decides what to do
 *  - layout can be swapped (table row, card, map popup) without changing the contract
 */
export function ProgramAssignmentsRow({
  request,
  onSelect,
  onReturnClick,
  isSelected,
}: Props) {
  const rowBg = isSelected ? '#e6f2ff' : 'transparent'

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1.2fr 0.8fr 0.8fr 1fr auto',
        gap: '0.75rem',
        alignItems: 'center',
        padding: '0.5rem 0.75rem',
        borderTop: `1px solid ${colors.lightGray}`,
        background: rowBg,
      }}
    >
      {/* Request ID — clickable to open detail panel */}
      <button
        type="button"
        onClick={() => onSelect?.(request)}
        title="Open request details"
        style={{
          background: 'transparent',
          border: 'none',
          padding: 0,
          textAlign: 'left',
          color: colors.blue,
          fontWeight: 600,
          cursor: onSelect ? 'pointer' : 'default',
        }}
      >
        {request.requestId ?? `OID ${request.objectId}`}
      </button>

      {/* District */}
      <div style={{ color: colors.darkestGray, fontSize: '0.9em' }}>
        {request.district ?? '—'}
      </div>

      {/* Urgency */}
      <div style={{ color: colors.darkestGray, fontSize: '0.9em' }}>
        {request.urgency ?? '—'}
      </div>

      {/* Title */}
      <div
        style={{
          color: colors.darkestGray,
          fontSize: '0.9em',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        title={request.requestTitle ?? undefined}
      >
        {request.requestTitle ?? '—'}
      </div>

      {/* Action */}
      <button
        type="button"
        onClick={() => onReturnClick?.(request)}
        disabled={!onReturnClick}
        title="Return this request to the unassigned pool"
        style={{
          background: colors.orange,
          color: colors.darkestGray,
          border: 'none',
          borderRadius: 4,
          padding: '0.3rem 0.7rem',
          cursor: onReturnClick ? 'pointer' : 'not-allowed',
          fontWeight: 600,
          fontSize: '0.85em',
          whiteSpace: 'nowrap',
        }}
      >
        Return to Unassigned
      </button>
    </div>
  )
}