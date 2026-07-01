import { useState } from 'react'

type Props = {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  workOrderId: string
}

export function DeleteWorkOrderModal({ isOpen, onClose, onConfirm, workOrderId }: Props) {
  const [submitting, setSubmitting] = useState(false)

  if (!isOpen) return null

  const handleConfirm = () => {
    if (submitting) return
    setSubmitting(true)
    onConfirm()
    setSubmitting(false)
  }

  const handleClose = () => {
    if (submitting) return
    onClose()
  }

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
          Delete Work Order {workOrderId}?
        </h2>
        <p style={{ margin: '0 0 8px 0', color: '#7C7B7A', fontSize: 14 }}>
          This is a <strong>soft delete</strong>. The work order will be hidden
          from normal views but preserved in the database — an admin can restore
          it if needed.
        </p>
        <p style={{ margin: '0 0 16px 0', color: '#7C7B7A', fontSize: 14 }}>
          Are you sure you want to delete this work order?
        </p>

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
            Keep Work Order
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting}
            style={{
              padding: '8px 16px',
              background: submitting ? '#D3D4CF' : '#C43D3D',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: 4,
              cursor: submitting ? 'not-allowed' : 'pointer',
              fontWeight: 600,
            }}
          >
            {submitting ? 'Deleting…' : 'Delete Work Order'}
          </button>
        </div>
      </div>
    </div>
  )
}