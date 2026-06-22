import { useState } from 'react'
import { colors } from '../theme'
import { programLinks, type ProgramTarget } from '../config/programLinks'

type Props = {
  isOpen: boolean
  /** Human-readable request ID shown in the modal title; just for context. */
  requestIdLabel: string | null
  onCancel: () => void
  onConfirm: (params: {
    target: ProgramTarget
    programLinkValue: string
    reason: string
  }) => Promise<void> | void
}

export function MoveToInitiativeModal({
  isOpen, requestIdLabel, onCancel, onConfirm,
}: Props) {
  const [target, setTarget] = useState<ProgramTarget>('maintenanceInitiative')
  const [linkValue, setLinkValue] = useState('')
  const [reason, setReason] = useState('')
  const [isWorking, setIsWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const canConfirm = linkValue.trim().length > 0 && !isWorking

  async function handleConfirm() {
    setIsWorking(true)
    setError(null)
    try {
      await onConfirm({ target, programLinkValue: linkValue.trim(), reason: reason.trim() })
      // Reset for next time
      setTarget('maintenanceInitiative')
      setLinkValue('')
      setReason('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Move failed')
    } finally {
      setIsWorking(false)
    }
  }

  return (
    <>
      <div onClick={() => !isWorking && onCancel()}
        style={{ position: 'fixed', inset: 0, background: 'rgba(71, 75, 79, 0.55)', zIndex: 1000 }} />

      <div style={{
        position: 'fixed',
        top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        width: 'min(520px, 92vw)',
        background: colors.white,
        borderRadius: 8,
        boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
        zIndex: 1001,
        display: 'flex', flexDirection: 'column',
      }}>
        <header style={{
          padding: '1rem 1.25rem',
          borderBottom: `1px solid ${colors.lightGray}`,
          background: colors.blue, color: colors.white,
          borderRadius: '8px 8px 0 0',
        }}>
          <div style={{ fontSize: '0.8em', opacity: 0.85 }}>Move Request</div>
          <div style={{ fontSize: '1.05em', fontWeight: 700 }}>
            {requestIdLabel ?? '(unknown request)'}
          </div>
        </header>

        <div style={{ padding: '1rem 1.25rem', color: colors.darkestGray, display: 'grid', gap: '0.75rem' }}>
          <div>
            <div style={{
              color: colors.darkGray, fontSize: '0.75em',
              textTransform: 'uppercase', marginBottom: 4,
            }}>Move To</div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              {(Object.keys(programLinks) as ProgramTarget[]).map((key) => (
                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="moveTarget"
                    checked={target === key}
                    onChange={() => setTarget(key)}
                    disabled={isWorking}
                    style={{ accentColor: colors.blue }}
                  />
                  {programLinks[key].label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <div style={{
              color: colors.darkGray, fontSize: '0.75em',
              textTransform: 'uppercase', marginBottom: 4,
            }}>
              {programLinks[target].label} {programLinks[target].linkField}
            </div>
            <input
              type="text"
              value={linkValue}
              disabled={isWorking}
              onChange={(e) => setLinkValue(e.target.value)}
              placeholder="Paste the GlobalID of the target record"
              style={{
                width: '100%',
                padding: '0.4rem 0.5rem',
                border: `1px solid ${colors.gray}`,
                borderRadius: 4,
                fontFamily: 'monospace',
                fontSize: '0.9em',
                boxSizing: 'border-box',
              }}
            />
            <div style={{ color: colors.darkGray, fontSize: '0.72em', marginTop: 3 }}>
              Free text for now — using GlobalID until proper IDs exist on the MI/CP tables.
            </div>
          </div>

          <div>
            <div style={{
              color: colors.darkGray, fontSize: '0.75em',
              textTransform: 'uppercase', marginBottom: 4,
            }}>
              Reason (optional)
            </div>
            <textarea
              value={reason}
              disabled={isWorking}
              rows={3}
              maxLength={1000}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is this being moved? Captured in the auto-generated Triage note."
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
          </div>

          <div style={{
            background: colors.lightestGray,
            border: `1px solid ${colors.lightGray}`,
            borderRadius: 4, padding: '0.5rem 0.6rem',
            fontSize: '0.85em', color: colors.darkGray,
          }}>
            Moving this request will set its status to <strong>Closed</strong>, mark it
            as <strong>{programLinks[target].requestAssignmentValue}</strong>, stamp
            the assigned and closed dates, and create a Triage note for the audit trail.
          </div>

          {error && (
            <div style={{ color: '#9B1C1C', fontSize: '0.9em' }} role="alert">
              ⚠️ {error}
            </div>
          )}
        </div>

        <footer style={{
          padding: '0.75rem 1.25rem',
          borderTop: `1px solid ${colors.lightGray}`,
          background: colors.lightestGray,
          display: 'flex', justifyContent: 'flex-end', gap: 8,
          borderRadius: '0 0 8px 8px',
        }}>
          <button type="button" disabled={isWorking} onClick={onCancel}
            style={{
              background: colors.white, color: colors.darkestGray,
              border: `1px solid ${colors.gray}`, borderRadius: 4,
              padding: '0.4rem 0.9rem',
              cursor: isWorking ? 'not-allowed' : 'pointer',
              opacity: isWorking ? 0.6 : 1,
            }}>
            Cancel
          </button>
          <button type="button" disabled={!canConfirm} onClick={handleConfirm}
            style={{
              background: canConfirm ? colors.blue : colors.gray,
              color: colors.white, border: 'none', borderRadius: 4,
              padding: '0.4rem 0.9rem',
              cursor: canConfirm ? 'pointer' : 'not-allowed',
              fontWeight: 600,
            }}>
            {isWorking ? 'Moving…' : 'Move Request'}
          </button>
        </footer>
      </div>
    </>
  )
}