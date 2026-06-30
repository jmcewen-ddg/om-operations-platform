
import { useEffect } from 'react'
import { colors, styles } from '../theme'

type ConfirmModalProps = {
  isOpen: boolean
  title: string
  message: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  confirmVariant?: 'primary' | 'danger'
  isWorking?: boolean
  onConfirm: () => void | Promise<void>
  onCancel: () => void
}

// One-off destructive color — not part of the brand palette, but every app needs a "no, really?" red.
// If we add more destructive UI, promote this into theme.ts as colors.danger.
const DANGER_RED = '#B00020'

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Return to Editing',
  confirmVariant = 'primary',
  isWorking = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isWorking) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, isWorking, onCancel])

  if (!isOpen) return null

  // Pick the confirm button style based on variant + working state
  const confirmButtonStyle =
    confirmVariant === 'danger'
      ? {
          ...styles.primaryButton,
          background: DANGER_RED,
          opacity: isWorking ? 0.7 : 1,
          cursor: isWorking ? 'not-allowed' : 'pointer',
        }
      : {
          ...styles.primaryButton,
          opacity: isWorking ? 0.7 : 1,
          cursor: isWorking ? 'not-allowed' : 'pointer',
        }

  const cancelButtonStyle = {
    ...styles.secondaryButton,
    cursor: isWorking ? 'not-allowed' : 'pointer',
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(71, 75, 79, 0.55)', // darkestGray @ 55% — overlay
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={() => !isWorking && onCancel()}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          ...styles.card,
          padding: '20px 24px',
          minWidth: 360,
          maxWidth: 520,
          marginBottom: 0,
          boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
        }}
      >
        <h2 style={{ ...styles.h2, marginBottom: 12, fontSize: 18 }}>
          {title}
        </h2>

        <div
          style={{
            fontSize: 14,
            color: colors.darkestGray,
            marginBottom: 20,
            lineHeight: 1.5,
          }}
        >
          {message}
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
          }}
        >
          <button
            onClick={onCancel}
            disabled={isWorking}
            style={cancelButtonStyle}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={isWorking}
            style={confirmButtonStyle}
          >
            {isWorking ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
