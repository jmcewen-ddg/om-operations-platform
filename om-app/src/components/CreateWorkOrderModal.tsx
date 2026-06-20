import { useState } from 'react'
import { DISTRICTS, districtName } from '../constants/districts'
import { colors, styles } from '../theme'

type Mode = 'standalone' | 'from-selection'

type Props = {
  mode: Mode
  /** When mode === 'from-selection', the district code derived from selected requests */
  derivedDistrict?: string
  /** When mode === 'from-selection', the count of selected requests */
  selectedCount?: number
  onCancel: () => void
  onConfirm: (districtCode: string) => Promise<void> | void
}

export function CreateWorkOrderModal({
  mode,
  derivedDistrict,
  selectedCount,
  onCancel,
  onConfirm,
}: Props) {
  const [districtCode, setDistrictCode] = useState<string>(
    mode === 'from-selection' ? derivedDistrict ?? '' : ''
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = !!districtCode && !submitting

  async function handleConfirm() {
    setSubmitting(true)
    setError(null)
    try {
      await onConfirm(districtCode)
    } catch (e: any) {
      setError(e?.message ?? 'Failed to create work order.')
      setSubmitting(false)
    }
  }

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <h3 style={{ marginTop: 0, color: colors.darkestGray }}>
          {mode === 'standalone'
            ? 'Create New Work Order'
            : 'Create Work Order from Selection'}
        </h3>

        {mode === 'from-selection' && (
          <p style={{ color: colors.darkGray }}>
            You're about to create a new work order in{' '}
            <strong>{districtName(derivedDistrict)}</strong> from{' '}
            <strong>{selectedCount}</strong> selected request
            {selectedCount === 1 ? '' : 's'}. After it's created, the selected
            requests will be assigned to it.
          </p>
        )}

        {mode === 'standalone' && (
          <>
            <p style={{ color: colors.darkGray }}>
              Pick a service area. The work order will start as <strong>Draft</strong> with
              no requests attached.
            </p>
            <label style={{ display: 'block', marginBottom: 12 }}>
              Service Area:{' '}
              <select
                value={districtCode}
                onChange={(e) => setDistrictCode(e.target.value)}
                style={{ padding: '0.3rem', borderRadius: 4, border: `1px solid ${colors.gray}` }}
              >
                <option value="">— Select —</option>
                {DISTRICTS.map((d) => (
                  <option key={d.code} value={d.code}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}

        {error && (
          <div style={{ ...styles.errorBanner, marginBottom: 12 }}>{error}</div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            style={styles.secondaryButton}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canSubmit}
            style={canSubmit ? styles.primaryButton : styles.disabledButton}
          >
            {submitting ? 'Creating…' : 'Create Work Order'}
          </button>
        </div>
      </div>
    </div>
  )
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(71,75,79,0.4)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
}

const modalStyle: React.CSSProperties = {
  background: colors.white,
  border: `1px solid ${colors.lightGray}`,
  borderRadius: 8,
  padding: '1.5rem',
  width: 'min(480px, 90vw)',
  boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
}