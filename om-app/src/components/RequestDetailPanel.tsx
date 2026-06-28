import { useEffect, useMemo, useState } from 'react'
import { updateRequest, type OmRequest } from '../services/requestService'
import { colors } from '../theme'
import { ConfirmModal } from './ConfirmModal'
import { loadDomains, type DomainMap } from '../services/domainService'
import { RequestNotesSection } from './RequestNotesSection'
import { moveRequestToProgram } from '../services/requestService'
import { MoveToInitiativeModal } from './MoveToInitiativeModal'
import {
  getCategoryOptions,
  getSubcategoryOptions,
  buildRequestTitle,
} from '../utils/requestCategoryHelpers'
import {
  getAllowedTriageTransitions,
  canTriageEditStatus,
} from '../utils/requestStatusHelpers'
import { EditableField } from './EditableField'
import { useUser } from '../lib/userContext'
import { can, canEditAnyField } from '../lib/permissions'
import { type RequestStatus } from '../domain/request/requestStatus'
import { requestMatrix } from '../domain/request/requestMatrix'
import { CancelRequestModal } from './CancelRequestModal'
import { atLeast } from '../lib/roles'

type Props = {
  request: OmRequest | null
  onClose: () => void
  onRequestUpdated?: (updated: OmRequest) => void
}

// Statuses that mean "triage is done" — used to decide when to stamp triaged_date
const TRIAGE_COMPLETE_STATUSES = new Set(['Triaged', 'In Design', 'Ready for Work Order'])

export function RequestDetailPanel({ request, onClose, onRequestUpdated }: Props) {
  const user = useUser()

  // ---- One draft object holds ALL pending edits ----
  // Keys present in draft = fields the user has touched. Empty = clean.
  const [draft, setDraft] = useState<Partial<OmRequest>>({})
  const [isEditing, setIsEditing] = useState(false)
  const [domains, setDomains] = useState<DomainMap | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isDiscardConfirmOpen, setIsDiscardConfirmOpen] = useState(false)
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false)
  const hasUnsavedChanges = isEditing && Object.keys(draft).length > 0
  const [cancelOpen, setCancelOpen] = useState(false)


  // Helper: get the live value for any field (draft override → saved value).
  function v<K extends keyof OmRequest>(key: K): OmRequest[K] | null {
    if (key in draft) return draft[key] as OmRequest[K]
    return (request?.[key] ?? null) as OmRequest[K] | null
  }

  // Helper: write a field into draft. If the new value matches the saved
  // value, REMOVE the key from draft so hasUnsavedChanges stays accurate.
  function setField<K extends keyof OmRequest>(key: K, value: OmRequest[K] | null) {
    setDraft((d) => {
      const next = { ...d }
      const savedValue = request?.[key] ?? null
      const isSame = (value ?? null) === (savedValue ?? null)
      if (isSame) {
        delete next[key]
      } else {
        next[key] = value as OmRequest[K]
      }
      return next
    })
  }

  // ---- Derived: the live title (auto-built from category + sub + route) ----
  const liveCategory = v('requestCategory') as string | null
  const liveSubcategory = v('requestSubcategory') as string | null
  const liveRouteName = v('routeName') as string | null

  const liveTitle = useMemo(() => {
    if (!domains) return ''
    return buildRequestTitle(domains, liveSubcategory, liveRouteName, liveCategory)
  }, [domains, liveCategory, liveSubcategory, liveRouteName])

  // Keep request_title in draft in sync with the live derivation while editing.
  // Only writes when the computed value actually differs from the saved title,
  // so we don't pollute draft with a no-op.
  useEffect(() => {
    if (!isEditing || !domains) return
    const saved = request?.requestTitle ?? ''
    if (liveTitle !== saved) {
      setDraft((d) => ({ ...d, requestTitle: liveTitle || null }))
    } else {
      setDraft((d) => {
        if (!('requestTitle' in d)) return d
        const { requestTitle: _drop, ...rest } = d
        return rest
      })
    }
  }, [liveTitle, isEditing, domains, request?.requestTitle])

  // ---- Save ----
  async function handleSave() {
    if (!request) return
    if (!hasUnsavedChanges) {
      setIsEditing(false)
      return
    }

    // Auto-stamp triaged_date if status is moving into a triage-complete state
    // and it hasn't already been stamped on the saved record.
    const changes: Partial<OmRequest> = { ...draft }
    const newStatus = (changes.status ?? request.status) as string | null
    if (
      newStatus &&
      TRIAGE_COMPLETE_STATUSES.has(newStatus) &&
      !request.triagedDate &&
      changes.triagedDate === undefined
    ) {
      changes.triagedDate = Date.now()
    }

    setIsSaving(true)
    setSaveError(null)
    try {
      await updateRequest(request.objectId, changes)
      const updated: OmRequest = { ...request, ...changes }
      onRequestUpdated?.(updated)
      setDraft({})
      setIsEditing(false)
    } catch (err) {
      console.error('Failed to save request:', err)
      setSaveError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setIsSaving(false)
    }
  }

  // ---- Close handling ----
  function attemptClose() {
    if (hasUnsavedChanges) setIsDiscardConfirmOpen(true)
    else onClose()
  }

  function confirmDiscard() {
    setIsDiscardConfirmOpen(false)
    setDraft({})
    setIsEditing(false)
    onClose()
  }

  function cancelEdit() {
    if (hasUnsavedChanges) {
      setIsDiscardConfirmOpen(true)
    } else {
      setDraft({})
      setIsEditing(false)
    }
  }

  // ---- Load coded-value domains once ----
  useEffect(() => {
    let cancelled = false
    loadDomains()
      .then((d) => { if (!cancelled) setDomains(d) })
      .catch((err) => console.error('Failed to load domains', err))
    return () => { cancelled = true }
  }, [])

  // ---- Reset drafts when a different request is loaded ----
  useEffect(() => {
    setDraft({})
    setIsEditing(false)
    setSaveError(null)
  }, [request?.globalId])

  // ---- Escape closes ----
  useEffect(() => {
    if (!request) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') attemptClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request, hasUnsavedChanges])

  // ---- Domain-driven option lists (memoized so EditableField re-renders are cheap) ----
  // NOTE: these MUST come before the early-return below so the hook count
  // stays stable across renders (Rules of Hooks).
  const categoryOptions    = useMemo(() => (domains ? getCategoryOptions(domains) : []), [domains])
  const subcategoryOptions = useMemo(
    () => (domains ? getSubcategoryOptions(domains, liveCategory ?? '') : []),
    [domains, liveCategory],
  )
  const statusOptions = useMemo(() => {
    const allowed = getAllowedTriageTransitions(request?.status ?? null)
    return allowed.map((s) => ({ code: s, name: s }))
  }, [request?.status])

  // Plain (non-hook) helpers — safe to leave after the early return,
  // but easier to keep them grouped here.
  const urgencyOptions    = domainOptions(domains, 'urgency')
  const sourceOptions     = domainOptions(domains, 'source')
  const intakeTypeOptions = domainOptions(domains, 'intake_type')
  const yesNoOptions      = domainOptions(domains, 'location_corrected')
  const districtOptions   = domainOptions(domains, 'district')
  const isBridge          = (liveCategory ?? '').toLowerCase() === 'bridge'

  if (!request) return null   // 👈 NOW comes after all hooks

  // "Move to Program": user permission + the request being in a clean state
// (not already moved, not on a WO, not terminal).
const status = (request.status ?? 'Draft') as RequestStatus
const userCanMoveToProgram = can(user, 'moveToProgram', 'request', { status })
const requestIsMoveable =
  (request.assignmentStatus === 'Unassigned' || request.assignmentStatus === null) &&
  request.status !== 'Closed' &&
  request.status !== 'Canceled'
const canMoveToProgram = userCanMoveToProgram && requestIsMoveable

// "Edit": user has write access to at least one field at the current status.
// Matrix-driven — when the matrix changes, this updates with no code changes
// here. Terminal statuses naturally lock out edit because every field becomes
// R-only.
const canEditRequest = canEditAnyField(user, 'request', requestMatrix, status)

console.log('[canCancel debug]', {
  role: user.role,
  status: request.status,
  statusType: typeof request.status,
  statusJSON: JSON.stringify(request.status),
})

const canCancel =
  atLeast(user.role, 'tier2Triager') &&
  request.status !== 'Canceled' &&
  request.status !== 'Closed'

  return (
    <>
      {/* ===== Backdrop ===== */}
      <div
        onClick={attemptClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(71, 75, 79, 0.45)', zIndex: 900 }}
      />

      {/* ===== Side panel ===== */}
      <aside
        style={{
          position: 'fixed', top: 0, right: 0, height: '100vh',
          width: 'min(1000px, 95vw)', background: colors.white,
          boxShadow: '-4px 0 20px rgba(0,0,0,0.15)',
          borderLeft: `1px solid ${colors.lightGray}`,
          display: 'flex', flexDirection: 'column', zIndex: 950,
        }}
      >
        {/* ===== Header ===== */}
        <header
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '1rem 1.25rem', background: colors.blue, color: colors.white,
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
              background: 'transparent', color: colors.white,
              border: `1px solid ${colors.white}55`, borderRadius: 4,
              width: 32, height: 32, fontSize: '1.2em', cursor: 'pointer', lineHeight: 1,
            }}
          >
            ✕
          </button>
        </header>

        {/* ===== Body ===== */}
        <div style={{ flex: '1 1 auto', overflowY: 'auto', padding: '1rem 1.25rem', color: colors.darkestGray }}>
          {/* --------- Triage --------- */}
          <Section title="Triage" defaultOpen>
            {isEditing ? (
              <>
                <EditableField
                  type="select" label="Category"
                  value={liveCategory}
                  options={categoryOptions}
                  onChange={(code) => {
                    setField('requestCategory', code)
                    // Clear subcategory when category changes
                    setField('requestSubcategory', null)
                    // Bridge ignores route_name — clear it for cleanliness
                    if ((code ?? '').toLowerCase() === 'bridge') setField('routeName', null)
                  }}
                />
                <EditableField
                  type="select" label="Subcategory"
                  value={liveSubcategory}
                  options={subcategoryOptions}
                  disabled={!liveCategory}
                  onChange={(code) => setField('requestSubcategory', code)}
                />
                <Field label="Title (auto)" value={liveTitle} wide />

                <EditableField
                  type="select" label="Urgency"
                  value={v('urgency') as string | null}
                  options={urgencyOptions}
                  onChange={(val) => setField('urgency', val)}
                />
                {/*<EditableField
                  type="number" label="Priority Score"
                  value={v('priorityScore') as number | null}
                  step={1} min={0}
                  onChange={(val) => setField('priorityScore', val)}
                />*/}
                <EditableField
                  type="date" label="Due Date"
                  value={v('dueDate') as number | null}
                  onChange={(val) => setField('dueDate', val)}
                />
                <Field label="Triaged Date" value={formatDate(v('triagedDate') as number | null)}
                       helperText="Auto-stamped when status reaches Triaged or Ready for Assignment." />

                <EditableField
                  type="textarea" label="Description" wide
                  value={v('requestDescription') as string | null}
                  maxLength={4000} rows={3}
                  onChange={(val) => setField('requestDescription', val)}
                />
                <EditableField
                  type="textarea" label="Public Notes" wide
                  value={v('publicNotes') as string | null}
                  maxLength={4000} rows={2}
                  onChange={(val) => setField('publicNotes', val)}
                />
                <EditableField
                  type="textarea" label="Internal Notes" wide
                  value={v('internalNotes') as string | null}
                  maxLength={4000} rows={2}
                  onChange={(val) => setField('internalNotes', val)}
                />
              </>
            ) : (
              <>
                <Field label="Title"        value={request.requestTitle} />
                <Field label="Category"     value={request.requestCategory} />
                <Field label="Subcategory"  value={request.requestSubcategory} />
                <Field label="Urgency"      value={request.urgency} />
                {/*<Field label="Priority Score" value={request.priorityScore} />*/}
                <Field label="Due Date"     value={formatDate(request.dueDate)} />
                <Field label="Triaged Date" value={formatDate(request.triagedDate)} />
                <Field label="Description"   value={request.requestDescription} wide />
                <Field label="Public Notes"  value={request.publicNotes} wide />
                <Field label="Internal Notes" value={request.internalNotes} wide />
              </>
            )}
          </Section>

          {/* --------- Location --------- */}
          <Section title="Location" defaultOpen={false}>
            {isEditing ? (
              <>
                <EditableField
                  type="select" label="District"
                  value={v('district') as string | null}
                  options={districtOptions}
                  onChange={(val) => setField('district', val)}
                />
                <EditableField
                  type="text" label="Parish" maxLength={100}
                  value={v('parish') as string | null}
                  onChange={(val) => setField('parish', val)}
                />
                <EditableField
                  type="text" label="Municipality" maxLength={100}
                  value={v('municipality') as string | null}
                  onChange={(val) => setField('municipality', val)}
                />
                <EditableField
                  type="text" label="Route Name" maxLength={100}
                  value={v('routeName') as string | null}
                  disabled={isBridge}
                  helperText={isBridge ? 'Not used for Bridge category.' : undefined}
                  onChange={(val) => setField('routeName', val)}
                />
                <EditableField
                  type="text" label="Route ID" maxLength={100}
                  value={v('routeId') as string | null}
                  onChange={(val) => setField('routeId', val)}
                />
                <EditableField
                  type="number" label="Milepost" step={0.001}
                  value={v('milepost') as number | null}
                  onChange={(val) => setField('milepost', val)}
                />

                <Field label="Original Lat" value={request.originalLatitude} />
                <Field label="Original Lon" value={request.originalLongitude} />

                <EditableField
                  type="number" label="Corrected Lat" step={0.000001} min={-90} max={90}
                  value={v('correctedLatitude') as number | null}
                  onChange={(val) => setField('correctedLatitude', val)}
                />
                <EditableField
                  type="number" label="Corrected Lon" step={0.000001} min={-180} max={180}
                  value={v('correctedLongitude') as number | null}
                  onChange={(val) => setField('correctedLongitude', val)}
                />
                <EditableField
                  type="select" label="Location Corrected"
                  value={v('locationCorrected') as string | null}
                  options={yesNoOptions}
                  onChange={(val) => setField('locationCorrected', val)}
                />
                <EditableField
                  type="textarea" label="Location Description" wide
                  maxLength={1000} rows={2}
                  value={v('locationDescription') as string | null}
                  onChange={(val) => setField('locationDescription', val)}
                />
              </>
            ) : (
              <>
                <Field label="District"      value={request.district} />
                <Field label="Parish"        value={request.parish} />
                <Field label="Municipality"  value={request.municipality} />
                <Field label="Route Name"    value={request.routeName} />
                <Field label="Route ID"      value={request.routeId} />
                <Field label="Milepost"      value={request.milepost} />
                <Field label="Original Lat"  value={request.originalLatitude} />
                <Field label="Original Lon"  value={request.originalLongitude} />
                <Field label="Corrected Lat" value={request.correctedLatitude} />
                <Field label="Corrected Lon" value={request.correctedLongitude} />
                <Field label="Location Corrected"   value={request.locationCorrected} />
                <Field label="Location Description" value={request.locationDescription} wide />
              </>
            )}
          </Section>

          {/* --------- Requestor --------- */}
          <Section title="Requestor" defaultOpen={false}>
            {isEditing ? (
              <>
                <EditableField type="text" label="Name" maxLength={255}
                  value={v('requestorName') as string | null}
                  onChange={(val) => setField('requestorName', val)} />
                <EditableField type="text" label="Organization" maxLength={255}
                  value={v('requestorOrganization') as string | null}
                  onChange={(val) => setField('requestorOrganization', val)} />
                <EditableField type="text" label="Email" maxLength={255}
                  value={v('requestorEmail') as string | null}
                  onChange={(val) => setField('requestorEmail', val)} />
                <EditableField type="text" label="Phone" maxLength={50}
                  value={v('requestorPhone') as string | null}
                  onChange={(val) => setField('requestorPhone', val)} />
                <EditableField type="select" label="Intake Type"
                  value={v('intakeType') as string | null}
                  options={intakeTypeOptions}
                  onChange={(val) => setField('intakeType', val)} />
                <EditableField type="select" label="Source"
                  value={v('source') as string | null}
                  options={sourceOptions}
                  onChange={(val) => setField('source', val)} />
              </>
            ) : (
              <>
                <Field label="Submission Type" value={request.submissionType} />
                <Field label="Name"         value={request.requestorName} />
                <Field label="Organization" value={request.requestorOrganization} />
                <Field label="Email"        value={request.requestorEmail} />
                <Field label="Phone"        value={request.requestorPhone} />
                {/* <Field label="Intake Type"  value={request.intakeType} /> */}
                <Field label="Source"       value={request.source} />
              </>
            )}
          </Section>

          {/* --------- Assignment (read-only — driven by assign-to-WO flow) --------- */}
          <Section title="Assignment" defaultOpen={false}>
            <Field label="Assignment Status"  value={request.assignmentStatus} />
            <Field label="Work Order ID"      value={request.assignedWorkOrderId} />
            <Field label="Assigned To"        value={request.assignedToName} />
            <Field label="Assigned Team"      value={request.assignedTeam} />
            <Field label="Assigned Email"     value={request.assignedToEmail} />
            <Field label="Requires Design"    value={request.requiresDesign} />
            <Field label="Design Status"      value={request.designStatus} />
            <Field label="Maintenance Initiative" value={request.maintenanceInitiativeGlobalId} />
            <Field label="Capital Project"    value={request.capitalProjectGlobalId} />
            <Field label="Assignment Notes"   value={request.assignmentNotes} wide />
          </Section>

          {/* --------- Status & Lifecycle --------- */}
          <Section title="Status & Lifecycle" defaultOpen={false}>
            {isEditing ? (
              <>
                <EditableField
                  type="select" label="Status"
                  value={v('status') as string | null}
                  options={statusOptions}
                  disabled={!canTriageEditStatus(request.status)}
                  helperText={
                    canTriageEditStatus(request.status)
                      ? 'Triage can move to Triaged or Ready for Work Order.'
                      : 'Status is past triage and is driven by other workflows.'
                  }
                  onChange={(val) => setField('status', val)}
                />
                <Field label="Submitted" value={formatDate(request.submittedDate)} />
                <Field label="Assigned"  value={formatDate(request.assignedDate)} />
                <Field label="Canceled"  value={formatDate(request.canceledDate)} />
                <Field label="Closed"    value={formatDate(request.closedDate)} />
                <Field label="Cancellation Reason" value={request.cancellationReason} wide />
                <Field label="Closed Reason"       value={request.closedReason} wide />
              </>
            ) : (
              <>
                <Field label="Status"     value={request.status} />
                <Field label="Submitted"  value={formatDate(request.submittedDate)} />
                <Field label="Assigned"   value={formatDate(request.assignedDate)} />
                <Field label="Canceled"   value={formatDate(request.canceledDate)} />
                <Field label="Closed"     value={formatDate(request.closedDate)} />
                <Field label="Cancellation Reason" value={request.cancellationReason} wide />
                <Field label="Closed Reason"       value={request.closedReason} wide />
              </>
            )}
          </Section>

          {/* --------- Notes --------- */}
          <RequestNotesSection requestGlobalId={request.globalId} defaultOpen={false} />

          {/* --------- System (read-only) --------- */}
          <Section title="System" defaultOpen={false}>
            <Field label="OBJECTID"          value={request.objectId} />
            <Field label="GlobalID"          value={request.globalId} />
            <Field label="Request ID"        value={request.requestId} />
            <Field label="Created By"        value={request.createdUser} />
            <Field label="Created Date"      value={formatDate(request.createdDate)} />
            <Field label="Last Edited By"    value={request.lastEditedUser} />
            <Field label="Last Edited Date"  value={formatDate(request.lastEditedDate)} />
            <Field label="Deleted"           value={request.deleted} />
            <Field label="Deleted Date"      value={formatDate(request.deletedDate)} />
            <Field label="Deleted By"        value={request.deletedBy} />
          </Section>
        </div>

        {/* ===== Footer ===== */}
        <footer
          style={{
            flex: '0 0 auto', padding: '0.75rem 1.25rem',
            borderTop: `1px solid ${colors.lightGray}`, background: colors.lightestGray,
            display: 'flex', justifyContent: 'flex-end', gap: 8,
          }}
        >

{!isEditing ? (
  <>
    <button type="button" onClick={attemptClose} style={footerSecondaryBtn}>Close</button>

    {canMoveToProgram && (
      <button
        type="button"
        onClick={() => setIsMoveModalOpen(true)}
        style={{
          background: colors.orange,
          color: colors.darkestGray,
          border: 'none', borderRadius: 4,
          padding: '0.4rem 0.9rem',
          cursor: 'pointer', fontWeight: 600,
        }}
        title="Move this request to a Maintenance Initiative or Capital Project"
      >
        Move to Program
      </button>
    )}
    {canEditRequest && (
    <button type="button" onClick={() => setIsEditing(true)} style={footerPrimaryBtn(false)}>Edit</button>
    )}


    {canCancel && (
  <button
    type="button"
    onClick={() => setCancelOpen(true)}
    style={{
      padding: '8px 16px',
      background: '#FFFFFF',
      color: '#FFAC0F',
      border: '1px solid #FFAC0F',
      borderRadius: 4,
      cursor: 'pointer',
      fontWeight: 600,
    }}
  >
    Cancel Request
  </button>
)}
  </>
) : (

            <>
              {saveError && (
                <div style={{
                  flex: '1 1 auto', color: '#9B1C1C',
                  fontSize: '0.85em', alignSelf: 'center',
                }} role="alert">
                  ⚠️ {saveError}
                </div>
              )}
              <button type="button" disabled={isSaving} onClick={cancelEdit}
                style={{ ...footerSecondaryBtn, opacity: isSaving ? 0.6 : 1 }}>
                Cancel
              </button>
              <button
                type="button"
                disabled={isSaving || !hasUnsavedChanges}
                onClick={handleSave}
                style={footerPrimaryBtn(isSaving || !hasUnsavedChanges)}
              >
                {isSaving ? 'Saving…' : 'Save'}
              </button>
            </>
          )}
        </footer>
      </aside>

      <ConfirmModal
        isOpen={isDiscardConfirmOpen}
        title="Discard unsaved changes?"
        confirmLabel="Discard"
        confirmVariant="danger"
        onCancel={() => setIsDiscardConfirmOpen(false)}
        onConfirm={confirmDiscard}
        message={<>You have unsaved edits to this request. If you close now, those changes will be lost.</>}
      />
      <MoveToInitiativeModal
  isOpen={isMoveModalOpen}
  requestIdLabel={request.requestId}
  onCancel={() => setIsMoveModalOpen(false)}
  onConfirm={async ({ target, programLinkValue, reason }) => {
    if (!request.globalId) throw new Error('Request is missing a GlobalID — cannot move.')
    await moveRequestToProgram({
      requestObjectId: request.objectId,
      requestGlobalId: request.globalId,
      target,
      programLinkValue,
      reason,
    })
    const targetAssignment =
      target === 'maintenanceInitiative'
        ? 'Moved to Maintenance Initiative'
        : 'Moved to Capital Projects'
    const now = Date.now()
    const updated: OmRequest = {
      ...request,
      assignmentStatus: targetAssignment,
      status: 'Closed',
      assignedDate: now,
      closedDate: now,
      maintenanceInitiativeGlobalId:
        target === 'maintenanceInitiative' ? programLinkValue : request.maintenanceInitiativeGlobalId,
      capitalProjectGlobalId:
        target === 'capitalProject' ? programLinkValue : request.capitalProjectGlobalId,
      assignedWorkOrderGlobalId: null,
      assignedWorkOrderId: null,
    }
    onRequestUpdated?.(updated)
    setIsMoveModalOpen(false)
  }}
/>

<CancelRequestModal
  isOpen={cancelOpen}
  onClose={() => setCancelOpen(false)}
  onConfirm={(reason) => {
    console.log('TODO step 2: submit cancel', { id: request.requestId, reason })
    setCancelOpen(false)
  }}
  requestId={request.requestId ?? '(no ID)'}
/>

    </>
  )
}


// ============================================================
// Local helpers
// ============================================================

const footerSecondaryBtn: React.CSSProperties = {
  background: colors.white, color: colors.darkestGray,
  border: `1px solid ${colors.gray}`, borderRadius: 4,
  padding: '0.4rem 0.9rem', cursor: 'pointer',
}

function footerPrimaryBtn(disabled: boolean): React.CSSProperties {
  return {
    background: disabled ? colors.gray : colors.green,
    color: disabled ? colors.white : colors.darkestGray,
    border: 'none', borderRadius: 4,
    padding: '0.4rem 0.9rem',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontWeight: 600,
  }
}

/** Pull coded-value options for a domain by REST name, with a graceful fallback. */
function domainOptions(domains: DomainMap | null, domainName: string): { code: string; name: string }[] {
  if (!domains) return []
  const d = domains[domainName]
  return d ?? []
}

function formatDate(epochMs: number | null | undefined): string | null {
  if (!epochMs) return null
  try { return new Date(epochMs).toLocaleString() } catch { return null }
}

type SectionProps = { title: string; defaultOpen?: boolean; children: React.ReactNode }
function Section({ title, defaultOpen = true, children }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section style={{
      marginBottom: '1rem',
      border: `1px solid ${colors.lightGray}`, borderRadius: 6, background: colors.white,
    }}>
      <button type="button" onClick={() => setOpen((x) => !x)}
        style={{
          width: '100%', textAlign: 'left',
          background: colors.lightestGray, color: colors.darkestGray,
          border: 'none', padding: '0.5rem 0.75rem',
          fontWeight: 700, cursor: 'pointer', borderRadius: '6px 6px 0 0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
        <span>{title}</span>
        <span style={{ color: colors.darkGray, fontWeight: 400 }}>{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div style={{
          padding: '0.5rem 0.75rem',
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          gap: '0.4rem 1.5rem', fontSize: '0.9em', //was gap: '0.4rem 1rem'
        }}>
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
  helperText?: string
}
function Field({ label, value, wide, helperText }: FieldProps) {
  const display = value === null || value === undefined || value === '' ? '—' : String(value)
  return (
    <div style={{ gridColumn: wide ? '1 / -1' : 'auto' }}>
      <div style={{ color: colors.darkGray, fontSize: '0.75em', textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ color: colors.darkestGray, wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
        {display}
      </div>
      {helperText && (
        <div style={{ color: colors.darkGray, fontSize: '0.72em', marginTop: 2 }}>{helperText}</div>
      )}
    </div>
  )
}