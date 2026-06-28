import { useEffect, useState } from 'react'

type RequiresDesign = 'Yes' | 'No'

type Props = {
  isOpen: boolean
  onClose: () => void
  onConfirm: (requiresDesign: RequiresDesign) => Promise<void> | void
  requestId: string
  /** Current requires_design value on the request (null if unset). Used to pre-select. */
  initialRequiresDesign: string | null
}

export function CompleteTriageModal({
  isOpen,
  onClose,
  onConfirm,
  requestId,
  initialRequiresDesign,
}: Props) {
  const [choice, setChoice] = useState<RequiresDesign | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Pre-populate from current value when the modal opens
  useEffect(() => {
    if (!isOpen) return
    if (initialRequiresDesign === 'Yes' || initialRequiresDesign === 'No') {
      setChoice(initialRequiresDesign)
    } else {
      setChoice(null)
    }
    setError(null)
  }, [isOpen, initialRequiresDesign])

  if (!isOpen) return null

  const canSubmit = choice !== null && !submitting

  const handleConfirm = async () => {
    if (!canSubmit || choice === null) return
    setSubmitting(true)
    setError(null)
    try {
      await onConfirm(choice)
    } catch (err) {
      console.error('Complete triage failed:', err)
      setError(err instanceof Error ? err.message : 'Triage submit failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    if (submitting) return
    setError(null)
    onClose()
  }

  const targetStatus = choice === 'Yes'
    ? 'In Design'
    : choice === 'No'
      ? 'Ready for Work Order'
      : null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(71, 75, 79, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={handleClose}
    >
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: 8,
          padding: 24,
          width: 'min(500px, 90vw)',
          boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: '0 0 12px 0', color: '#474B4F' }}>
          Complete Triage — {requestId}
        </h2>
        <p style={{ margin: '0 0 16px 0', color: '#7C7B7A', fontSize: 14 }}>
          Answer the question below to complete triage. The request status
          will advance automatically based on your answer.
        </p>

        <fieldset style={{ border: 'none', padding: 0, margin: '0 0 12px 0' }}>
          <legend
            style={{
              fontSize: 13,
              color: '#474B4F',
              marginBottom: 8,
              padding: 0,
              fontWeight: 600,
            }}
          >
            Does this request require design?{' '}
            <span style={{ color: '#FFAC0F' }}>*</span>
          </legend>

          <label style={radioRow}>
            <input
              type="radio"
              name="requires-design"
              value="Yes"
              checked={choice === 'Yes'}
              disabled={submitting}
              onChange={() => setChoice('Yes')}
            />
            <span><strong>Yes</strong> — request will move to <em>In Design</em></span>
          </label>

          <label style={radioRow}>
            <input
              type="radio"
              name="requires-design"
              value="No"
              checked={choice === 'No'}
              disabled={submitting}
              onChange={() => setChoice('No')}
            />
            <span><strong>No</strong> — request will move to <em>Ready for Work Order</em></span>
          </label>
        </fieldset>

        {targetStatus && (
          <div
            style={{
              padding: 8,
              background: '#F6F6F6',
              border: '1px solid #D3D4CF',
              borderRadius: 4,
              color: '#474B4F',
              fontSize: 13,
              marginBottom: 8,
            }}
          >
            On confirm, status will become <strong>{targetStatus}</strong> and
            the triaged date will be stamped.
          </div>
        )}

        {error && (
          <div
            role="alert"
            style={{
              marginTop: 8,
              padding: 8,
              background: '#FEF2F2',
              border: '1px solid #FCA5A5',
              borderRadius: 4,
              color: '#9B1C1C',
              fontSize: 13,
            }}
          >
            ⚠️ {error}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            style={{
              padding: '8px 16px',
              background: '#FFFFFF',
              color: '#474B4F',
              border: '1px solid #C1C5C8',
              borderRadius: 4,
              cursor: submitting ? 'not-allowed' : 'pointer',
            }}
          >
            Not Yet
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canSubmit}
            style={{
              padding: '8px 16px',
              background: canSubmit ? '#C1D52F' : '#D3D4CF',
              color: canSubmit ? '#474B4F' : '#7C7B7A',
              border: 'none',
              borderRadius: 4,
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              fontWeight: 600,
            }}
          >
            {submitting ? 'Completing…' : 'Complete Triage'}
          </button>
        </div>
      </div>
    </div>
  )
}

const radioRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '6px 0',
  color: '#474B4F',
  fontSize: 14,
  cursor: 'pointer',
}