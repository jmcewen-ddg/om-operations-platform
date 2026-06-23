import { useEffect, useState } from 'react'
import { colors } from '../theme'
import { programLinks, type ProgramTarget } from '../config/programLinks'

type Props = {
  isOpen: boolean

  /** Human-readable request ID shown in the modal title (e.g. "REQ-2026-00041"). */
  requestIdLabel: string | null

  /** Which program type the request is currently moved to. */
  fromTarget: ProgramTarget | null

  /** Human-readable program name to show + record in the auto-note. */
  fromProgramName: string | null

  onCancel: () => void

  /**
   * Called when the user confirms the return.
   * The parent owns the actual service call (returnRequestToUnassigned)
   * and is responsible for refreshing UI state on success.
   */
  onConfirm: (params: { reason: string }) => Promise<void> | void
}

export function ReturnToUnassignedModal({
  isOpen,
  requestIdLabel,
  fromTarget,
  fromProgramName,
  onCancel,
  onConfirm,
}: Props) {
  const [reason, setReason] = useState('')
  const [isWorking, setIsWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset form each time the modal opens
  useEffect(() => {
    if (!isOpen) return
    setReason('')
    setError(null)
    setIsWorking(false)
  }, [isOpen])

  if (!isOpen) return null

  const reasonTrimmed = reason.trim()
  const canConfirm = reasonTrimmed.length > 0 && !isWorking

  // Friendly label for "From" — falls back gracefully if we somehow don't know.
  const fromLabel = fromTarget ? programLinks[fromTarget].label : 'Program'
  const fromDisplay = fromProgramName ?? '(unknown)'

  async function handleConfirm() {
    setIsWorking(true)
    setError(null)
    try {
      await onConfirm({ reason: reasonTrimmed })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Return failed')
    } finally {
      setIsWorking(false)
    }
  }

  return (
    <>
      <div
        onClick={() => !isWorking && onCancel()}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(71, 75, 79, 0.55)',
          zIndex: 1000,
        }}
      />

      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(520px, 92vw)',
          background: colors.white,
          borderRadius: 8,
          boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
          zIndex: 1001,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <header
          style={{
            padding: '1rem 1.25rem',
            borderBottom: `1px solid ${colors.lightGray}`,
            background: colors.blue,
            color: colors.white,
            borderRadius: '8px 8px 0 0',
          }}
        >
          <div style={{ fontSize: '0.8em', opacity: 0.85 }}>Return Request</div>
          <div style={{ fontSize: '1.05em', fontWeight: 700 }}>
            {requestIdLabel ?? '(unknown request)'}
          </div>
        </header>

        <div
          style={{
            padding: '1rem 1.25rem',
            color: colors.darkestGray,
            display: 'grid',
            gap: '0.75rem',
          }}
        >
          <div
            style={{
              background: colors.lightestGray,
              border: `1px solid ${colors.lightGray}`,
              borderRadius: 4,
              padding: '0.5rem 0.6rem',
              fontSize: '0.85em',
              color: colors.darkGray,
            }}
          >
            Currently assigned to <strong>{fromLabel}</strong>:{' '}
            <strong>{fromDisplay}</strong>.
          </div>

          <div>
            <div
              style={{
                color: colors.darkGray,
                fontSize: '0.75em',
                textTransform: 'uppercase',
                marginBottom: 4,
              }}
            >
              Reason for return
              <span style={{ color: '#9B1C1C', marginLeft: 4 }}>*</span>
            </div>
            <textarea
              value={reason}
              disabled={isWorking}
              rows={3}
              maxLength={1000}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is this request being returned to the unassigned pool?"
              style={{
                width: '100%',
                padding: '0.4rem 0.5rem',
                border: `1px solid ${colors.gray}`,
                borderRadius: 4,
                fontFamily: 'inherit',
                fontSize: '0.9em',
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
            <div
              style={{
                color: colors.darkGray,
                fontSize: '0.72em',
                marginTop: 3,
              }}
            >
              Required. Captured in the auto-generated Triage note for the audit trail.
            </div>
          </div>

          <div
            style={{
              background: colors.lightestGray,
              border: `1px solid ${colors.lightGray}`,
              borderRadius: 4,
              padding: '0.5rem 0.6rem',
              fontSize: '0.85em',
              color: colors.darkGray,
            }}
          >
            Returning this request will clear its program assignment, reset its
            assignment to <strong>Unassigned</strong>, and restore its status
            (Triaged if previously triaged, otherwise New). A Triage note will
            be created for the audit trail.
          </div>

          {error && (
            <div
              style={{ color: '#9B1C1C', fontSize: '0.9em' }}
              role="alert"
            >
              ⚠️ {error}
            </div>
          )}
        </div>

        <footer
          style={{
            padding: '0.75rem 1.25rem',
            borderTop: `1px solid ${colors.lightGray}`,
            background: colors.lightestGray,
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
            borderRadius: '0 0 8px 8px',
          }}
        >
          <button
            type="button"
            disabled={isWorking}
            onClick={onCancel}
            style={{
              background: colors.white,
              color: colors.darkestGray,
              border: `1px solid ${colors.gray}`,
              borderRadius: 4,
              padding: '0.4rem 0.9rem',
              cursor: isWorking ? 'not-allowed' : 'pointer',
              opacity: isWorking ? 0.6 : 1,
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canConfirm}
            onClick={handleConfirm}
            style={{
              background: canConfirm ? colors.blue : colors.gray,
              color: colors.white,
              border: 'none',
              borderRadius: 4,
              padding: '0.4rem 0.9rem',
              cursor: canConfirm ? 'pointer' : 'not-allowed',
              fontWeight: 600,
            }}
          >
            {isWorking ? 'Returning…' : 'Return to Unassigned'}
          </button>
        </footer>
      </div>
    </>
  )
}