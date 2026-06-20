import { useEffect, useState } from 'react'
import type { OmRequest } from '../services/requestService'
import { colors } from '../theme'
import { ConfirmModal } from './ConfirmModal'

type Props = {
  request: OmRequest | null      // null = panel closed; a request = panel open with that data
  onClose: () => void
}

export function RequestDetailPanel({ request, onClose }: Props) {
  // ---- Local state ----
  // hasUnsavedChanges will be flipped on by Edit mode in a later step.
  // For now it's always false, so close behavior is unguarded.
  const [hasUnsavedChanges, _setHasUnsavedChanges] = useState(false)
  const [isDiscardConfirmOpen, setIsDiscardConfirmOpen] = useState(false)

  // ---- Close handling ----
  // Centralized so every "close" path (X button, Escape, backdrop click) flows
  // through the same dirty-state check.
  function attemptClose() {
    if (hasUnsavedChanges) {
      setIsDiscardConfirmOpen(true)
    } else {
      onClose()
    }
  }

  function confirmDiscard() {
    setIsDiscardConfirmOpen(false)
    onClose()
  }

  // ---- Escape key closes the panel ----
  useEffect(() => {
    if (!request) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') attemptClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // attemptClose changes on every render but that's fine here — we want
    // the LATEST version to handle the keypress
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request, hasUnsavedChanges])

  if (!request) return null

  return (
    <>
      {/* ===== Backdrop ===== */}
      <div
        onClick={attemptClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(71, 75, 79, 0.45)',
          zIndex: 900,
        }}
      />

      {/* ===== Side panel ===== */}
      <aside
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          height: '100vh',
          width: 'min(560px, 95vw)',
          background: colors.white,
          boxShadow: '-4px 0 20px rgba(0,0,0,0.15)',
          borderLeft: `1px solid ${colors.lightGray}`,
          display: 'flex',
          flexDirection: 'column',
          zIndex: 950,
        }}
      >
        {/* ===== Header ===== */}
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1rem 1.25rem',
            background: colors.blue,
            color: colors.white,
            flex: '0 0 auto',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: '0.8em', opacity: 0.85 }}>Request</div>
            <div style={{ fontSize: '1.1em', fontWeight: 700 }}>
              {request.requestId ?? '(no ID yet)'}
            </div>
          </div>
          <button
            type="button"
            onClick={attemptClose}
            aria-label="Close panel"
            style={{
              background: 'transparent',
              color: colors.white,
              border: `1px solid ${colors.white}55`,
              borderRadius: 4,
              width: 32,
              height: 32,
              fontSize: '1.2em',
              cursor: 'pointer',
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </header>

        {/* ===== Body ===== */}
        <div
          style={{
            flex: '1 1 auto',
            overflowY: 'auto',
            padding: '1rem 1.25rem',
            color: colors.darkestGray,
          }}
        >
          <p style={{ color: colors.darkGray, fontStyle: 'italic' }}>
            Panel content coming soon — read-only field display in the next step.
          </p>
        </div>

        {/* ===== Footer (placeholder for action buttons) ===== */}
        <footer
          style={{
            flex: '0 0 auto',
            padding: '0.75rem 1.25rem',
            borderTop: `1px solid ${colors.lightGray}`,
            background: colors.lightestGray,
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
          }}
        >
          <button
            type="button"
            onClick={attemptClose}
            style={{
              background: colors.white,
              color: colors.darkestGray,
              border: `1px solid ${colors.gray}`,
              borderRadius: 4,
              padding: '0.4rem 0.9rem',
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </footer>
      </aside>

      {/* ===== Discard-changes confirmation ===== */}
      <ConfirmModal
        isOpen={isDiscardConfirmOpen}
        title="Discard unsaved changes?"
        confirmLabel="Discard"
        confirmVariant="danger"
        onCancel={() => setIsDiscardConfirmOpen(false)}
        onConfirm={confirmDiscard}
        message={
          <>
            You have unsaved edits to this request. If you close now, those
            changes will be lost.
          </>
        }
      />
    </>
  )
}