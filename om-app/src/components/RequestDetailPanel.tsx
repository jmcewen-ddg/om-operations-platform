import { useEffect, useState } from 'react'
import { updateRequest, type OmRequest } from '../services/requestService'
import { colors } from '../theme'
import { ConfirmModal } from './ConfirmModal'
import { loadDomains, type DomainMap } from '../services/domainService'
import { RequestNotesSection } from './RequestNotesSection'
import {
  getCategoryOptions,
  getSubcategoryOptions,
  buildRequestTitle,
} from '../utils/requestCategoryHelpers'



type Props = {
  request: OmRequest | null      // null = panel closed; a request = panel open with that data
  onClose: () => void
  /** Called with the updated request after a successful save.
   *  Parent should use this to update its list state so the row reflects new values. */
  onRequestUpdated?: (updated: OmRequest) => void
}

export function RequestDetailPanel({ request, onClose, onRequestUpdated }: Props) {

  // ---- Local state ----
  // hasUnsavedChanges will be flipped on by Edit mode in a later step.
  // For now it's always false, so close behavior is unguarded.

  const [isDiscardConfirmOpen, setIsDiscardConfirmOpen] = useState(false)

  // Edit mode + draft values for the cascading category/subcategory dropdowns.
  // editCategory / editSubcategory hold the *code* (not the display name).
  const [isEditing, setIsEditing] = useState(false)
  const [domains, setDomains] = useState<DomainMap | null>(null)
  const [editCategory, setEditCategory] = useState<string>('')
  const [editSubcategory, setEditSubcategory] = useState<string>('')

  // Dirty state is derived: any draft value differing from the loaded request
  // counts as unsaved. Add more fields here as we make them editable.
  const hasUnsavedChanges =
    isEditing &&
    (editCategory !== (request?.requestCategory ?? '') ||
      editSubcategory !== (request?.requestSubcategory ?? ''))


  // ---- Save state ----
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // ---- Save handler ----
  async function handleSave() {
    if (!request) return
    if (!hasUnsavedChanges) {
      setIsEditing(false)
      return
    }

    setIsSaving(true)
    setSaveError(null)

    // Build the changes payload — only the fields we actually edited.
    // Title is derived from subcategory, so we send all three together.
    const newTitle = domains ? buildRequestTitle(domains, editSubcategory) : ''
    const changes: Partial<OmRequest> = {
      requestCategory: editCategory || null,
      requestSubcategory: editSubcategory || null,
      requestTitle: newTitle || null,
    }

    try {
      await updateRequest(request.objectId, changes)

      // Build the optimistically-updated request to hand back to the parent.
      const updated: OmRequest = { ...request, ...changes }
      onRequestUpdated?.(updated)

      setIsEditing(false)
    } catch (err) {
      console.error('Failed to save request:', err)
      setSaveError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setIsSaving(false)
    }
  }

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

  // ---- Load coded-value domains once ----
  // Cached inside domainService, so this is cheap on remount.
  useEffect(() => {
    let cancelled = false
    loadDomains()
      .then((d) => {
        if (!cancelled) setDomains(d)
      })
      .catch((err) => console.error('Failed to load domains', err))
    return () => {
      cancelled = true
    }
  }, [])

  // ---- Reset edit drafts whenever a different request is loaded ----
  // Keyed on globalId so reopening the same request is a no-op,
  // but switching to a different request clears stale drafts.
  useEffect(() => {
    setIsEditing(false)
    setEditCategory(request?.requestCategory ?? '')
    setEditSubcategory(request?.requestSubcategory ?? '')
  }, [request?.globalId])

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
          <Section title="Triage" defaultOpen={true}>
            
{isEditing ? (
              <>
                <CategoryDropdown
                  label="Category"
                  value={editCategory}
                  options={domains ? getCategoryOptions(domains) : []}
                  onChange={(code) => {
                    setEditCategory(code)
                    // Clear subcategory when category changes — old sub may no longer be valid
                    setEditSubcategory('')
                  }}
                />
                <CategoryDropdown
                  label="Subcategory"
                  value={editSubcategory}
                  options={domains ? getSubcategoryOptions(domains, editCategory) : []}
                  disabled={!editCategory}
                  onChange={(code) => setEditSubcategory(code)}
                />
                <Field
                  label="Title (auto)"
                  value={domains ? buildRequestTitle(domains, editSubcategory) : ''}
                  wide
                />
              </>
            ) : (
              <>
                <Field label="Title" value={request.requestTitle} />
                <Field label="Category" value={request.requestCategory} />
                <Field label="Subcategory" value={request.requestSubcategory} />
              </>
            )}
            <Field label="Urgency" value={request.urgency} />

            <Field label="Urgency" value={request.urgency} />
            <Field label="Priority Score" value={request.priorityScore} />
            <Field label="Due Date" value={formatDate(request.dueDate)} />
            <Field label="Triaged Date" value={formatDate(request.triagedDate)} />
            <Field label="Description" value={request.requestDescription} wide />
            <Field label="Public Notes" value={request.publicNotes} wide />
            <Field label="Internal Notes" value={request.internalNotes} wide />
          </Section>

          <Section title="Location" defaultOpen={false}>
            <Field label="District" value={request.district} />
            <Field label="Parish" value={request.parish} />
            <Field label="Municipality" value={request.municipality} />
            <Field label="Route Name" value={request.routeName} />
            <Field label="Route ID" value={request.routeId} />
            <Field label="Milepost" value={request.milepost} />
            <Field label="Original Lat" value={request.originalLatitude} />
            <Field label="Original Lon" value={request.originalLongitude} />
            <Field label="Corrected Lat" value={request.correctedLatitude} />
            <Field label="Corrected Lon" value={request.correctedLongitude} />
            <Field label="Location Corrected" value={request.locationCorrected} />
            <Field label="Location Description" value={request.locationDescription} wide />
          </Section>

          <Section title="Requestor" defaultOpen={false}>
            <Field label="Name" value={request.requestorName} />
            <Field label="Organization" value={request.requestorOrganization} />
            <Field label="Email" value={request.requestorEmail} />
            <Field label="Phone" value={request.requestorPhone} />
            <Field label="Intake Type" value={request.intakeType} />
            <Field label="Source" value={request.source} />
          </Section>

          <Section title="Assignment" defaultOpen={false}>
            <Field label="Assignment Status" value={request.assignmentStatus} />
            <Field label="Work Order ID" value={request.assignedWorkOrderId} />
            <Field label="Assigned To" value={request.assignedToName} />
            <Field label="Assigned Team" value={request.assignedTeam} />
            <Field label="Assigned Email" value={request.assignedToEmail} />
            <Field label="Requires Design" value={request.requiresDesign} />
            <Field label="Design Status" value={request.designStatus} />
            <Field label="Maintenance Initiative" value={request.maintenanceInitiativeId} />
            <Field label="Capital Project" value={request.capitalProjectId} />
            <Field label="Assignment Notes" value={request.assignmentNotes} wide />
          </Section>

          <Section title="Status & Lifecycle" defaultOpen={false}>
            <Field label="Status" value={request.status} />
            <Field label="Submitted" value={formatDate(request.submittedDate)} />
            <Field label="Assigned" value={formatDate(request.assignedDate)} />
            <Field label="Canceled" value={formatDate(request.canceledDate)} />
            <Field label="Closed" value={formatDate(request.closedDate)} />
            <Field label="Cancellation Reason" value={request.cancellationReason} wide />
            <Field label="Closed Reason" value={request.closedReason} wide />
          </Section>

          {/* --------- Notes --------- */}
<RequestNotesSection requestGlobalId={request.globalId} defaultOpen={false} />

          <Section title="System" defaultOpen={false}>
            <Field label="OBJECTID" value={request.objectId} />
            <Field label="GlobalID" value={request.globalId} />
            <Field label="Request ID" value={request.requestId} />
            <Field label="Created By" value={request.createdUser} />
            <Field label="Created Date" value={formatDate(request.createdDate)} />
            <Field label="Last Edited By" value={request.lastEditedUser} />
            <Field label="Last Edited Date" value={formatDate(request.lastEditedDate)} />
            <Field label="Deleted" value={request.deleted} />
            <Field label="Deleted Date" value={formatDate(request.deletedDate)} />
            <Field label="Deleted By" value={request.deletedBy} />
          </Section>
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
{!isEditing ? (
            <>
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
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                style={{
                  background: colors.blue,
                  color: colors.white,
                  border: 'none',
                  borderRadius: 4,
                  padding: '0.4rem 0.9rem',
                  cursor: 'pointer',
                }}
              >
                Edit
              </button>
            </>
          ) : (
            <>
              {saveError && (
                <div
                  style={{
                    flex: '1 1 auto',
                    color: '#9B1C1C',
                    fontSize: '0.85em',
                    alignSelf: 'center',
                  }}
                  role="alert"
                >
                  ⚠️ {saveError}
                </div>
              )}
              <button
                type="button"
                disabled={isSaving}
                onClick={() => {
                  if (hasUnsavedChanges) {
                    setIsDiscardConfirmOpen(true)
                  } else {
                    setIsEditing(false)
                  }
                }}
                style={{
                  background: colors.white,
                  color: colors.darkestGray,
                  border: `1px solid ${colors.gray}`,
                  borderRadius: 4,
                  padding: '0.4rem 0.9rem',
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                  opacity: isSaving ? 0.6 : 1,
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSaving || !hasUnsavedChanges}
                onClick={handleSave}
                style={{
                  background:
                    isSaving || !hasUnsavedChanges ? colors.gray : colors.green,
                  color: isSaving || !hasUnsavedChanges ? colors.white : colors.darkestGray,
                  border: 'none',
                  borderRadius: 4,
                  padding: '0.4rem 0.9rem',
                  cursor:
                    isSaving || !hasUnsavedChanges ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                }}
              >
                {isSaving ? 'Saving…' : 'Save'}
              </button>
            </>
          )}
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
// ============================================================
// Helpers
// ============================================================

function formatDate(epochMs: number | null): string | null {
  if (!epochMs) return null
  try {
    return new Date(epochMs).toLocaleString()
  } catch {
    return null
  }
}

type SectionProps = {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}

function Section({ title, defaultOpen = true, children }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section
      style={{
        marginBottom: '1rem',
        border: `1px solid ${colors.lightGray}`,
        borderRadius: 6,
        background: colors.white,
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%',
          textAlign: 'left',
          background: colors.lightestGray,
          color: colors.darkestGray,
          border: 'none',
          padding: '0.5rem 0.75rem',
          fontWeight: 700,
          cursor: 'pointer',
          borderRadius: '6px 6px 0 0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span>{title}</span>
        <span style={{ color: colors.darkGray, fontWeight: 400 }}>{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div
          style={{
            padding: '0.5rem 0.75rem',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '0.4rem 1rem',
            fontSize: '0.9em',
          }}
        >
          {children}
        </div>
      )}
    </section>
  )
}

type FieldProps = {
  label: string
  value: string | number | null | undefined
  wide?: boolean
}

function Field({ label, value, wide }: FieldProps) {
  const display = value === null || value === undefined || value === '' ? '—' : String(value)
  return (
    <div style={{ gridColumn: wide ? '1 / -1' : 'auto' }}>
      <div style={{ color: colors.darkGray, fontSize: '0.75em', textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ color: colors.darkestGray, wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
        {display}
      </div>
    </div>
  )
}
type CategoryDropdownProps = {
  label: string
  value: string
  options: { code: string; name: string }[]
  onChange: (code: string) => void
  disabled?: boolean
}

function CategoryDropdown({ label, value, options, onChange, disabled }: CategoryDropdownProps) {
  return (
    <div style={{ gridColumn: 'auto' }}>
      <div style={{ color: colors.darkGray, fontSize: '0.75em', textTransform: 'uppercase' }}>
        {label}
      </div>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          padding: '0.3rem 0.4rem',
          border: `1px solid ${colors.gray}`,
          borderRadius: 4,
          background: disabled ? colors.lightestGray : colors.white,
          color: colors.darkestGray,
          fontSize: '0.95em',
        }}
      >
        <option value="">{disabled ? '— select category first —' : '— choose —'}</option>
        {options.map((opt) => (
          <option key={opt.code} value={opt.code}>
            {opt.name}
          </option>
        ))}
      </select>
    </div>
  )
}
}