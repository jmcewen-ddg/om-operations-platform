import { useEffect, useMemo, useState } from 'react'
import { updateRequest, cancelRequest, completeTriage, type OmRequest } from '../services/requestService'
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
  canCompleteTriage,
} from '../utils/requestStatusHelpers'
import { EditableField } from './EditableField'
import { useUser } from '../lib/userContext'
import { can, canEditAnyField } from '../lib/permissions'
import { type RequestStatus } from '../domain/request/requestStatus'
import { requestMatrix } from '../domain/request/requestMatrix'
import { MatrixFieldProvider } from '../lib/matrixFieldContext'
import { MatrixField } from './MatrixField'
import { CancelRequestModal } from './CancelRequestModal'
import { CompleteTriageModal } from './CompleteTriageModal'
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
// Why intent matters: the discard modal can be triggered either by clicking
// "Close Panel" (where the user wants to close) OR by clicking "Cancel" while
// editing (where the user just wants to back out of edit mode, NOT close).
// Track which one opened it so confirmDiscard does the right thing.
const [discardIntent, setDiscardIntent] = useState<'close' | 'cancelEdit' | null>(null)
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false)
  const hasUnsavedChanges = isEditing && Object.keys(draft).length > 0
 const [cancelOpen, setCancelOpen] = useState(false)
  const [triageOpen, setTriageOpen] = useState(false)


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
  if (hasUnsavedChanges) {
    setDiscardIntent('close')
    setIsDiscardConfirmOpen(true)
  } else {
    onClose()
  }
}

function confirmDiscard() {
  // Always discard the draft + exit edit mode.
  const intent = discardIntent
  setIsDiscardConfirmOpen(false)
  setDiscardIntent(null)
  setDraft({})
  setIsEditing(false)
  // Only close the whole panel if the user got here via Close Panel.
  // If they got here via Cancel (edit mode), stay on the request.
  if (intent === 'close') onClose()
}

function cancelEdit() {
  if (hasUnsavedChanges) {
    setDiscardIntent('cancelEdit')
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

const canRunTriage =
  atLeast(user.role, 'tier1Triager') &&
  canCompleteTriage(request.status)

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
{/* ===== Header =====
    Compact context banner. All text strictly left-aligned and tight.
    Lines 2/3/4 each join non-null pieces with " · " so missing values
    degrade cleanly (no dangling separators). */}
<header
  style={{
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    padding: '0.25rem 0.75rem',
    background: colors.blue,
    color: colors.white,
    flex: '0 0 auto',
    gap: '0.5rem',
    lineHeight: 1.5,
  }}
>
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
      textAlign: 'left',
      minWidth: 0,
      flex: '1 1 auto',
    }}
  >
    {/* Line 1: kicker label + ID */}
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
      <span style={{ fontSize: '0.95em', opacity: 1.0, letterSpacing: '0.05em' }}>
        REQUEST
      </span>
      <span style={{ fontSize: '0.95em', fontWeight: 700 }}>
        {request.requestId ?? '(no ID yet)'}
      </span>
    </div>

    {/* Line 2: urgency · category */}
    {(() => {
      const parts = [request.urgency, request.requestCategory].filter(Boolean)
      if (!parts.length) return null
      return (
        <div
          style={{
            textAlign: 'left',
            fontSize: '0.9em', fontWeight: 600, opacity: 0.95,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            width: '100%',
          }}
          title={parts.join(' · ')}
        >
          {parts.join(' · ')}
        </div>
      )
    })()}

    {/* Line 3: status · assignment */}
    {(() => {
      const parts = [request.status, request.assignmentStatus].filter(Boolean)
      if (!parts.length) return null
      return (
        <div
          style={{
            textAlign: 'left',
            fontSize: '0.9em', fontWeight: 600, opacity: 0.95,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            width: '100%',
          }}
          title={parts.join(' · ')}
        >
          {parts.join(' · ')}
        </div>
      )
    })()}

    {/* Line 4: subcategory */}
    {request.requestSubcategory && (
      <div
        style={{
          textAlign: 'left',
          fontSize: '0.85em', fontWeight: 600, opacity: 0.9,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          width: '100%',
        }}
        title={request.requestSubcategory}
      >
        {request.requestSubcategory}
      </div>
    )}
  </div>

  <button
    type="button"
    onClick={attemptClose}
    aria-label="Close panel"
    style={{
      background: 'transparent', color: colors.white,
      border: `1px solid ${colors.white}55`, borderRadius: 4,
      width: 22, height: 22, fontSize: '0.85em', cursor: 'pointer',
      lineHeight: 1, flex: '0 0 auto',
    }}
  >
    ✕
  </button>
</header>

        {/* ===== Body ===== */}
{/* ===== Body ===== */}
        <div style={{ flex: '1 1 auto', overflowY: 'auto', padding: '1rem 1.25rem', color: colors.darkestGray }}>
          <MatrixFieldProvider
            matrix={requestMatrix}
            role={user.role}
            status={status}
            isEditing={isEditing}
          >
{/* --------- Triage ---------
    Order: Title → Category · Subcategory → Urgency → Original Request
    Description. Category/Subcategory are cascading: clearing Category
    clears Subcategory; selecting Bridge clears Route Name (Location
    section). Description is read-only and not surfaced to the public
    role — see request_description in requestMatrix.ts.

    Public Notes and Internal Notes have been retired in favor of the
    related om_request_note table, rendered by RequestNotesSection
    immediately below this section.
*/}
<Section title="Triage" defaultOpen>
  <MatrixField
    fieldKey="request_title"
    type="text"
    label="Title"
    wide
    value={isEditing ? liveTitle : (request.requestTitle ?? null)}
    onChange={(val) => setField('requestTitle', val)}
  />

  {/* Three-up row: Category · Subcategory · Urgency.
    Spans both columns of the parent Section grid, then sub-divides into
    its own 3-column grid so the trio aligns horizontally. If any of the
    three is hidden by the matrix (e.g., urgency hidden from public),
    that cell renders empty — the other two stay in place. */}
<div
  style={{
    gridColumn: '1 / -1',
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: '0.3rem 1rem',
    alignItems: 'start',
  }}
>
    <MatrixField
    fieldKey="urgency"
    type="select"
    label="Urgency"
    value={v('urgency') as string | null}
    options={urgencyOptions}
    onChange={(val) => setField('urgency', val)}
  />
  <MatrixField
    fieldKey="request_category"
    type="select"
    label="Category"
    value={liveCategory}
    options={categoryOptions}
    onChange={(code) => {
      setField('requestCategory', code)
      // Subcategory is dependent on Category; clear it when Category changes.
      setField('requestSubcategory', null)
      // Bridge category doesn't use Route Name (Location section).
      if ((code ?? '').toLowerCase() === 'bridge') setField('routeName', null)
    }}
  />
  <MatrixField
    fieldKey="request_subcategory"
    type="select"
    label="Subcategory"
    value={liveSubcategory}
    options={subcategoryOptions}
    disabled={!liveCategory}
    onChange={(code) => setField('requestSubcategory', code)}
  />
</div>
  <MatrixField
    fieldKey="request_description"
    type="textarea"
    label="Original Request Description"
    wide
    value={request.requestDescription ?? null}
    rows={3}
    onChange={() => { /* read-only: matrix never grants RW */ }}
  />
</Section>

{/* --------- Notes (related table) --------- */}
<RequestNotesSection requestGlobalId={request.globalId} defaultOpen />

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
          <Section title="Reporter Information" defaultOpen={false}>
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
  {/*
    Status itself is workflow-driven, not matrix-driven. Triage uses
    canTriageEditStatus() to gate the dropdown; other transitions happen
    via actions (Cancel, Complete Triage, etc.). So Status stays as a
    manual EditableField / Field outside the matrix.
  */}
  {isEditing ? (
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
  ) : (
    <Field label="Status" value={request.status} />
  )}

  {/*
    Everything below is matrix-driven. All dates are AUTO_EVERYWHERE,
    so onChange is a no-op (never called). Reasons are conditionally
    visible per status (hidden until Canceled/Closed) — MatrixField
    handles that automatically.
  */}
  <MatrixField
    type="date"
    fieldKey="submitted_date"
    label="Submitted"
    value={request.submittedDate ?? null}
    formatValue={(v) => formatDate(v as number | null)}
    onChange={() => {}}
  />
  <MatrixField
    type="date"
    fieldKey="triaged_date"
    label="Triaged"
    value={request.triagedDate ?? null}
    formatValue={(v) => formatDate(v as number | null)}
    onChange={() => {}}
  />
  <MatrixField
    type="date"
    fieldKey="assigned_date"
    label="Assigned"
    value={request.assignedDate ?? null}
    formatValue={(v) => formatDate(v as number | null)}
    onChange={() => {}}
  />
  <MatrixField
    type="date"
    fieldKey="due_date"
    label="Due"
    value={request.dueDate ?? null}
    formatValue={(v) => formatDate(v as number | null)}
    helperText="Set when assigned WO is dispatched (TBD)."
    onChange={() => {}}
  />
  <MatrixField
    type="date"
    fieldKey="canceled_date"
    label="Canceled"
    value={request.canceledDate ?? null}
    formatValue={(v) => formatDate(v as number | null)}
    onChange={() => {}}
  />
  <MatrixField
    type="date"
    fieldKey="closed_date"
    label="Closed"
    value={request.closedDate ?? null}
    formatValue={(v) => formatDate(v as number | null)}
    onChange={() => {}}
  />
  <MatrixField
    type="textarea"
    fieldKey="cancellation_reason"
    label="Cancellation Reason"
    value={request.cancellationReason ?? null}
    wide
    onChange={() => {}}
  />
  <MatrixField
    type="textarea"
    fieldKey="closed_reason"
    label="Closed Reason"
    value={request.closedReason ?? null}
    wide
    onChange={() => {}}
  />
</Section>

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
          </MatrixFieldProvider>
        </div>


        {/* ===== Footer ===== */}
        
<footer
  style={{
    flex: '0 0 auto', padding: '0.75rem 1.25rem',
    borderTop: `1px solid ${colors.lightGray}`, background: colors.lightestGray,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  }}
>
  {!isEditing ? (
    <>
      {/* Left: panel-level action. "Close Panel" makes it unambiguous
          that this dismisses the side panel — NOT the request itself. */}
      <button
        type="button"
        onClick={attemptClose}
        style={footerSecondaryBtn}
        title="Close this side panel (does not change the request)"
      >
        Close Panel
      </button>

      {/* Right: request-level actions, grouped together. */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
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
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            style={footerPrimaryBtn(false)}
          >
            Edit
          </button>
        )}
        {canRunTriage && (
          <button
            type="button"
            onClick={() => setTriageOpen(true)}
            style={{
              padding: '8px 16px',
              background: colors.green,
              color: colors.darkestGray,
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              fontWeight: 600,
            }}
            title="Mark this request as triaged and route it forward"
          >
            Complete Triage
          </button>
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
      </div>
    </>
  ) : (
    <>
      {/* Editing mode: Cancel (discard edits) stays left; Save stays right.
          saveError sits between them, hard to miss. */}
      <button
        type="button"
        disabled={isSaving}
        onClick={cancelEdit}
        style={{ ...footerSecondaryBtn, opacity: isSaving ? 0.6 : 1 }}
      >
        Cancel Edits
      </button>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {saveError && (
          <div
            style={{ color: '#9B1C1C', fontSize: '0.85em' }}
            role="alert"
          >
            ⚠️ {saveError}
          </div>
        )}
        <button
          type="button"
          disabled={isSaving || !hasUnsavedChanges}
          onClick={handleSave}
          style={footerPrimaryBtn(isSaving || !hasUnsavedChanges)}
        >
          {isSaving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </>
  )}
</footer>

      </aside>

<ConfirmModal
  isOpen={isDiscardConfirmOpen}
  title="Discard unsaved changes?"
  confirmLabel="Discard"
  confirmVariant="danger"
  onCancel={() => {
    setIsDiscardConfirmOpen(false)
    setDiscardIntent(null)
  }}
  onConfirm={confirmDiscard}
  message={
    discardIntent === 'close' ? (
      <>You have unsaved edits to this request. If you close the panel now, those changes will be lost.</>
    ) : (
      <>You have unsaved edits to this request. If you cancel editing now, those changes will be lost.</>
    )
  }
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
  onConfirm={async (reason) => {
    const patch = await cancelRequest(request.objectId, reason)
    const updated: OmRequest = { ...request, ...patch }
    onRequestUpdated?.(updated)
    setCancelOpen(false)
  }}
  requestId={request.requestId ?? '(no ID)'}
/>

<CompleteTriageModal
  isOpen={triageOpen}
  onClose={() => setTriageOpen(false)}
  onConfirm={async (requiresDesign) => {
    const patch = await completeTriage(request.objectId, requiresDesign)
    const updated: OmRequest = { ...request, ...patch }
    onRequestUpdated?.(updated)
    setTriageOpen(false)
  }}
  requestId={request.requestId ?? '(no ID)'}
  initialRequiresDesign={request.requiresDesign ?? null}
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
      marginBottom: '0.5rem',
      border: `1px solid ${colors.lightGray}`, borderRadius: 6, background: colors.white,
    }}>
      <button type="button" onClick={() => setOpen((x) => !x)}
        style={{
          width: '100%', textAlign: 'left',
          background: colors.lightestGray, color: colors.darkestGray,
          border: 'none', padding: '0.35rem 0.75rem',
          fontWeight: 700, cursor: 'pointer', borderRadius: '6px 6px 0 0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          lineHeight: 1.2,
        }}>
        <span>{title}</span>
        <span style={{ color: colors.darkGray, fontWeight: 400 }}>{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div style={{
          padding: '0.4rem 0.75rem',
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          gap: '0.3rem 1rem',
          fontSize: '0.9em',
          lineHeight: 1.25,
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
      <div style={{
        color: colors.darkGray,
        fontSize: '0.7em',
        textTransform: 'uppercase',
        lineHeight: 1.1,
        letterSpacing: '0.03em',
      }}>
        {label}
      </div>
      <div style={{
        color: colors.darkestGray,
        wordBreak: 'break-word',
        whiteSpace: 'pre-wrap',
        lineHeight: 1.25,
      }}>
        {display}
      </div>
      {helperText && (
        <div style={{
          color: colors.darkGray,
          fontSize: '0.7em',
          marginTop: 1,
          lineHeight: 1.15,
        }}>
          {helperText}
        </div>
      )}
    </div>
  )
}