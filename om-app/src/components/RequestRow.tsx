import type { OmRequest } from '../services/requestService'
import { colors, styles } from '../theme'

type Props = {
  request: OmRequest
  isSelected: boolean
  onToggleSelect: (objectId: number) => void
  onOpenRequest: (request: OmRequest) => void
}

/**
 * One row in the Unassigned Requests list.
 *
 * Visual layout:
 *   [checkbox] [Request ID (link)] · Urgency · Status
 *              Title (truncates with ellipsis)
 *
 * Tightened to match the WorkOrderWithRequests card density pattern:
 * compact padding, tight lineHeight, 2-line layout with ID/meta on
 * line 1 and title on line 2.
 */
export function RequestRow({
  request,
  isSelected,
  onToggleSelect,
  onOpenRequest,
}: Props) {
  return (
    <li
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 6,
        padding: '0.3rem 0.5rem',
        marginBottom: '0.25rem',
        background: isSelected ? `${colors.blue}11` : colors.white,
        border: `1px solid ${isSelected ? colors.blue : colors.lightGray}`,
        borderLeft: `4px solid ${isSelected ? colors.blue : colors.lightGray}`,
        borderRadius: 4,
        color: colors.darkestGray,
        lineHeight: 1.3,
        transition: 'border-color 0.15s, background 0.15s',
      }}
    >
      <input
        type="checkbox"
        checked={isSelected}
        onChange={() => onToggleSelect(request.objectId)}
        style={{ accentColor: colors.blue, marginTop: 3, flex: '0 0 auto' }}
        aria-label={`Select request ${request.requestId ?? request.objectId}`}
      />

      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: '1 1 auto' }}>
        {/* Line 1: ID · Urgency · Status */}
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
            onClick={() => onOpenRequest(request)}
            style={{ ...styles.linkButton, fontWeight: 700 }}
            title="Open request detail panel"
          >
            {request.requestId ?? '(no ID)'}
          </button>
          <span style={{ color: colors.darkGray }}>·</span>
          <span>{request.urgency ?? '—'}</span>
          <span style={{ color: colors.darkGray }}>·</span>
          <span>{request.status ?? '—'}</span>
        </div>

        {/* Line 2: Title (truncates with ellipsis) */}
        <div
          style={{
            fontSize: '0.9em',
            color: colors.darkestGray,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
          title={request.requestTitle ?? 'Untitled'}
        >
          {request.requestTitle ?? 'Untitled'}
        </div>
      </div>
    </li>
  )
}