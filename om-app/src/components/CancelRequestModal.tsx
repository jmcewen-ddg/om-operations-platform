import { useState } from 'react'

type Props = {
  isOpen: boolean
  onClose: () => void
  onConfirm: (reason: string) => void
  requestId: string
}

export function CancelRequestModal({ isOpen, onClose, onConfirm, requestId }: Props) {
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!isOpen) return null

  const trimmed = reason.trim()
  const canSubmit = trimmed.length > 0 && !submitting

  const handleConfirm = () => {
    if (!canSubmit) return
    setSubmitting(true)
    // Step 2 will replace this with the actual update call
    console.log('[CancelRequestModal] would cancel', { requestId, reason: trimmed })
    onConfirm(trimmed)
    setSubmitting(false)
    setReason('')
  }

  const handleClose = () => {
    if (submitting) return
    setReason('')
    onClose()
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(71, 75, 79, 0.5)', // darkest gray @ 50%
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
          Cancel Request {requestId}
        </h2>
        <p style={{ margin: '0 0 16px 0', color: '#7C7B7A', fontSize: 14 }}>
          This will set the request status to <strong>Canceled</strong>. Please
          provide a reason.
        </p>

        <label
          htmlFor="cancellation-reason"
          style={{ display: 'block', fontSize: 13, color: '#474B4F', marginBottom: 6 }}
        >
          Cancellation reason <span style={{ color: '#FFAC0F' }}>*</span>
        </label>
        <textarea
          id="cancellation-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value.slice(0, 1000))}
          rows={4}
          placeholder="Why is this request being canceled?"
          style={{
            width: '100%',
            padding: 8,
            border: '1px solid #C1C5C8',
            borderRadius: 4,
            fontFamily: 'inherit',
            fontSize: 14,
            resize: 'vertical',
            boxSizing: 'border-box',
          }}
        />
        <div style={{ fontSize: 12, color: '#7C7B7A', marginTop: 4, textAlign: 'right' }}>
          {trimmed.length} / 1000
        </div>

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
            Keep Request
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canSubmit}
            style={{
              padding: '8px 16px',
              background: canSubmit ? '#FFAC0F' : '#D3D4CF',
              color: canSubmit ? '#FFFFFF' : '#7C7B7A',
              border: 'none',
              borderRadius: 4,
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              fontWeight: 600,
            }}
          >
            {submitting ? 'Canceling…' : 'Confirm Cancel'}
          </button>
        </div>
      </div>
    </div>
  )
}