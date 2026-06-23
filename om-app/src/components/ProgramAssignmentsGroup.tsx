import { useState } from 'react'
import { colors } from '../theme'
import type { OmRequest } from '../services/requestService'
import { ProgramAssignmentsRow } from './ProgramAssignmentsRow'

type Props = {
  /** Display name of the MI or CP (e.g. "Vegetation Maintenance"). */
  programName: string

  /** Optional description shown under the name when expanded. */
  programDescription?: string | null

  /** Requests currently assigned to this MI/CP. May be empty. */
  requests: OmRequest[]

  /** Defaults to collapsed; the view can override (e.g. expand groups with results). */
  defaultExpanded?: boolean

  /** Forwarded to each row — see ProgramAssignmentsRow for behavior. */
  selectedRequestObjectId?: number | null
  onSelectRequest?: (request: OmRequest) => void
  onReturnClick?: (request: OmRequest) => void
}

/**
 * Accordion section for one Maintenance Initiative or Capital Project.
 *
 * Presentational. Owns only its open/closed state.
 * Empty groups still render collapsed so users can see the full program list.
 */
export function ProgramAssignmentsGroup({
  programName,
  programDescription,
  requests,
  defaultExpanded = false,
  selectedRequestObjectId,
  onSelectRequest,
  onReturnClick,
}: Props) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  const count = requests.length
  const isEmpty = count === 0

  return (
    <div
      style={{
        border: `1px solid ${colors.lightGray}`,
        borderRadius: 6,
        background: colors.white,
        marginBottom: '0.5rem',
        overflow: 'hidden',
      }}
    >
      {/* Header / toggle */}
      <button
        type="button"
        onClick={() => setIsExpanded((v) => !v)}
        style={{
          width: '100%',
          textAlign: 'left',
          background: isEmpty ? colors.lightestGray : colors.white,
          border: 'none',
          padding: '0.6rem 0.85rem',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
        }}
        aria-expanded={isExpanded}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span
            style={{
              display: 'inline-block',
              width: '1ch',
              color: colors.darkGray,
              fontFamily: 'monospace',
              fontWeight: 700,
            }}
            aria-hidden
          >
            {isExpanded ? '▾' : '▸'}
          </span>
          <span
            style={{
              fontWeight: 700,
              color: isEmpty ? colors.darkGray : colors.darkestGray,
            }}
          >
            {programName}
          </span>
        </span>

        <span
          style={{
            color: isEmpty ? colors.darkGray : colors.blue,
            fontSize: '0.85em',
            fontWeight: 600,
            whiteSpace: 'nowrap',
          }}
        >
          {count} {count === 1 ? 'request' : 'requests'}
        </span>
      </button>

      {/* Body */}
      {isExpanded && (
        <div>
          {programDescription && (
            <div
              style={{
                padding: '0.5rem 0.85rem',
                borderTop: `1px solid ${colors.lightGray}`,
                background: colors.lightestGray,
                color: colors.darkGray,
                fontSize: '0.85em',
                fontStyle: 'italic',
              }}
            >
              {programDescription}
            </div>
          )}

          {isEmpty ? (
            <div
              style={{
                padding: '0.6rem 0.85rem',
                borderTop: `1px solid ${colors.lightGray}`,
                color: colors.darkGray,
                fontSize: '0.9em',
              }}
            >
              No requests currently assigned.
            </div>
          ) : (
            <div>
              {/* Column headings */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.2fr 0.8fr 0.8fr 1fr auto',
                  gap: '0.75rem',
                  padding: '0.4rem 0.75rem',
                  borderTop: `1px solid ${colors.lightGray}`,
                  background: colors.lightestGray,
                  color: colors.darkGray,
                  fontSize: '0.72em',
                  textTransform: 'uppercase',
                  fontWeight: 700,
                }}
              >
                <div>Request ID</div>
                <div>District</div>
                <div>Urgency</div>
                <div>Title</div>
                <div></div>
              </div>

              {requests.map((r) => (
                <ProgramAssignmentsRow
                  key={r.objectId}
                  request={r}
                  isSelected={r.objectId === selectedRequestObjectId}
                  onSelect={onSelectRequest}
                  onReturnClick={onReturnClick}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}