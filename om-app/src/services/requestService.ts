import { getArcGISTokenForUrl } from './arcgisAuth'
import { applyEdits } from './arcgisRest'
import { arcgisConfig } from '../config/arcgis'
import { addRequestNote } from './requestNoteService'
import { programLinks, type ProgramTarget } from '../config/programLinks'

/**
 * Maps TS OmRequest field names (camelCase) → REST field names (snake_case).
 * Keep in sync with the OmRequest type and the feature service schema.
 * Only fields that are EDITABLE should appear here. System fields
 * (OBJECTID, GlobalID, created_*, last_edited_*) are intentionally excluded.
 */
const FIELD_MAP: Partial<Record<keyof OmRequest, string>> = {
  // Triage
  requestTitle: 'request_title',
  requestCategory: 'request_category',
  requestSubcategory: 'request_subcategory',
  urgency: 'urgency',
  priorityScore: 'priority_score',
  dueDate: 'due_date',
  triagedDate: 'triaged_date',
  requestDescription: 'request_description',
  publicNotes: 'public_notes',
  internalNotes: 'internal_notes',

  // Location
  district: 'district',
  parish: 'parish',
  municipality: 'municipality',
  routeName: 'route_name',
  routeId: 'route_id',
  milepost: 'milepost',
  originalLatitude: 'original_latitude',
  originalLongitude: 'original_longitude',
  correctedLatitude: 'corrected_latitude',
  correctedLongitude: 'corrected_longitude',
  locationCorrected: 'location_corrected',
  locationDescription: 'location_description',

  // Requestor
  requestorName: 'requestor_name',
  requestorOrganization: 'requestor_organization',
  requestorEmail: 'requestor_email',
  requestorPhone: 'requestor_phone',
  intakeType: 'intake_type',
  source: 'source',

  // Assignment
  assignmentStatus: 'request_assignment',
  assignedWorkOrderId: 'assigned_work_order_id',
  assignedToName: 'assigned_to_name',
  assignedTeam: 'assigned_team',
  assignedToEmail: 'assigned_to_email',
  requiresDesign: 'requires_design',
  designStatus: 'design_status',
  maintenanceInitiativeGlobalId: 'maintenance_initiative_globalid',
  capitalProjectGlobalId: 'capital_project_globalid',
  assignmentNotes: 'assignment_notes',

  // Status & Lifecycle
  status: 'request_status',
  submittedDate: 'submitted_date',
  assignedDate: 'assigned_date',
  canceledDate: 'canceled_date',
  closedDate: 'closed_date',
  cancellationReason: 'cancellation_reason',
  closedReason: 'closed_reason',

  // Soft-delete (admin-only in UI, but mapping is here)
  deleted: 'deleted',
  deletedDate: 'deleted_date',
  deletedBy: 'deleted_by',
}

function normalizeGuid(g: string | null | undefined): string | null {
  if (!g) return null
  return g.replace(/[{}]/g, '').toUpperCase()
}

export type OmRequest = {
  // Identity
  objectId: number
  globalId: string | null
  requestId: string | null

  // Classification
  district: string | null
  intakeType: string | null
  source: string | null
  requestCategory: string | null
  requestSubcategory: string | null
  requestTitle: string | null
  requestDescription: string | null

  // Triage / Priority
  urgency: string | null
  priorityScore: number | null
  dueDate: number | null
  triagedDate: number | null

  // Status & Lifecycle
  status: string | null              // request_status
  submittedDate: number | null
  assignedDate: number | null
  canceledDate: number | null
  closedDate: number | null
  cancellationReason: string | null
  closedReason: string | null

  // Location
  originalLatitude: number | null
  originalLongitude: number | null
  correctedLatitude: number | null
  correctedLongitude: number | null
  locationCorrected: string | null   // "Yes" / "No"
  locationDescription: string | null
  routeName: string | null
  routeId: string | null
  milepost: number | null
  parish: string | null
  municipality: string | null

  // Requestor
  requestorName: string | null
  requestorEmail: string | null
  requestorPhone: string | null
  requestorOrganization: string | null
  submissionType: string | null

  // Assignment
  assignmentStatus: string | null              // request_assignment
  assignedWorkOrderGlobalId: string | null
  assignedWorkOrderId: string | null
  assignmentNotes: string | null
  assignedToName: string | null
  assignedToEmail: string | null
  assignedTeam: string | null
  requiresDesign: string | null
  designStatus: string | null
  maintenanceInitiativeGlobalId: string | null
  capitalProjectGlobalId: string | null

  // Notes
  publicNotes: string | null
  internalNotes: string | null

  // Soft delete
  deleted: string | null
  deletedDate: number | null
  deletedBy: string | null

  // Audit
  createdUser: string | null
  createdDate: number | null
  lastEditedUser: string | null
  lastEditedDate: number | null
}

const REQUEST_LAYER_URL = arcgisConfig.services.requests
const WORK_ORDER_LAYER_URL = arcgisConfig.services.workOrders

export async function getAssignedRequests(): Promise<OmRequest[]> {
  const token = await getArcGISTokenForUrl(REQUEST_LAYER_URL)

  const params = new URLSearchParams({
    where: "request_assignment = 'Assigned to Work Order' AND (deleted IS NULL OR deleted = 'No')",
    outFields: '*',
    returnGeometry: 'false',
    f: 'json',
    token,
  })

  const response = await fetch(`${REQUEST_LAYER_URL}/query?${params.toString()}`)
  const data = await response.json()

  if (data.error) {
    console.error('ArcGIS assigned-request query error:', data.error)
    throw new Error(data.error.message ?? 'Failed to query assigned requests')
  }

  return (data.features ?? []).map((feature: any) => {
    const attrs = feature.attributes ?? {}
    
return {
      // Identity
      objectId: attrs.OBJECTID,
      globalId: normalizeGuid(attrs.GlobalID ?? attrs.globalid ?? attrs.GLOBALID),
      requestId: attrs.request_id ?? null,

      // Classification
      district: attrs.district ?? null,
      intakeType: attrs.intake_type ?? null,
      source: attrs.source ?? null,
      requestCategory: attrs.request_category ?? null,
      requestSubcategory: attrs.request_subcategory ?? null,
      requestTitle: attrs.request_title ?? null,
      requestDescription: attrs.request_description ?? null,

      // Triage
      urgency: attrs.urgency ?? null,
      priorityScore: attrs.priority_score ?? null,
      dueDate: attrs.due_date ?? null,
      triagedDate: attrs.triaged_date ?? null,

      // Status
      status: attrs.request_status ?? null,
      submittedDate: attrs.submitted_date ?? null,
      assignedDate: attrs.assigned_date ?? null,
      canceledDate: attrs.canceled_date ?? null,
      closedDate: attrs.closed_date ?? null,
      cancellationReason: attrs.cancellation_reason ?? null,
      closedReason: attrs.closed_reason ?? null,

      // Location
      originalLatitude: attrs.original_latitude ?? null,
      originalLongitude: attrs.original_longitude ?? null,
      correctedLatitude: attrs.corrected_latitude ?? null,
      correctedLongitude: attrs.corrected_longitude ?? null,
      locationCorrected: attrs.location_corrected ?? null,
      locationDescription: attrs.location_description ?? null,
      routeName: attrs.route_name ?? null,
      routeId: attrs.route_id ?? null,
      milepost: attrs.milepost ?? null,
      parish: attrs.parish ?? null,
      municipality: attrs.municipality ?? null,

      // Requestor
      requestorName: attrs.requestor_name ?? null,
      requestorEmail: attrs.requestor_email ?? null,
      requestorPhone: attrs.requestor_phone ?? null,
      requestorOrganization: attrs.requestor_organization ?? null,
      submissionType: attrs.submission_type ?? null,

      // Assignment
      assignmentStatus: attrs.request_assignment ?? null,
      assignedWorkOrderGlobalId: normalizeGuid(attrs.assigned_work_order_globalid),
      assignedWorkOrderId: attrs.assigned_work_order_id ?? null,
      assignmentNotes: attrs.assignment_notes ?? null,
      assignedToName: attrs.assigned_to_name ?? null,
      assignedToEmail: attrs.assigned_to_email ?? null,
      assignedTeam: attrs.assigned_team ?? null,
      requiresDesign: attrs.requires_design ?? null,
      designStatus: attrs.design_status ?? null,
      maintenanceInitiativeGlobalId: attrs.maintenance_initiative_globalid ?? null,
      capitalProjectGlobalId: attrs.capital_project_globalid ?? null,

      // Notes
      publicNotes: attrs.public_notes ?? null,
      internalNotes: attrs.internal_notes ?? null,

      // Soft delete
      deleted: attrs.deleted ?? null,
      deletedDate: attrs.deleted_date ?? null,
      deletedBy: attrs.deleted_by ?? null,

      // Audit
      createdUser: attrs.created_user ?? null,
      createdDate: attrs.created_date ?? null,
      lastEditedUser: attrs.last_edited_user ?? null,
      lastEditedDate: attrs.last_edited_date ?? null,
    }
  })
}

  export async function getUnassignedRequests() {
  const token = await getArcGISTokenForUrl(REQUEST_LAYER_URL)

  const params = new URLSearchParams({
    where: "request_assignment = 'Unassigned' AND (deleted IS NULL OR deleted <> 'Yes')",
    outFields: '*',
    returnGeometry: 'false',
    f: 'json',
    token,
  })

  const url = `${REQUEST_LAYER_URL}/query?${params.toString()}`

  console.log('Request query URL:', url)

  const response = await fetch(url)

  const data = await response.json()

  if (data.error) {
    console.error('ArcGIS request query error:', data.error)
    throw new Error(data.error.message ?? 'Failed to query requests')
  }

  console.log('Request query result:', data)

  const features = data.features ?? []

  console.log('Mapped request features:', features)

const mappedRequests = features.map((feature: any) => {
  const attrs = feature.attributes ?? {}

return {
      // Identity
      objectId: attrs.OBJECTID,
      globalId: normalizeGuid(attrs.GlobalID ?? attrs.globalid ?? attrs.GLOBALID),
      requestId: attrs.request_id ?? null,

      // Classification
      district: attrs.district ?? null,
      intakeType: attrs.intake_type ?? null,
      source: attrs.source ?? null,
      requestCategory: attrs.request_category ?? null,
      requestSubcategory: attrs.request_subcategory ?? null,
      requestTitle: attrs.request_title ?? null,
      requestDescription: attrs.request_description ?? null,

      // Triage
      urgency: attrs.urgency ?? null,
      priorityScore: attrs.priority_score ?? null,
      dueDate: attrs.due_date ?? null,
      triagedDate: attrs.triaged_date ?? null,

      // Status
      status: attrs.request_status ?? null,
      submittedDate: attrs.submitted_date ?? null,
      assignedDate: attrs.assigned_date ?? null,
      canceledDate: attrs.canceled_date ?? null,
      closedDate: attrs.closed_date ?? null,
      cancellationReason: attrs.cancellation_reason ?? null,
      closedReason: attrs.closed_reason ?? null,

      // Location
      originalLatitude: attrs.original_latitude ?? null,
      originalLongitude: attrs.original_longitude ?? null,
      correctedLatitude: attrs.corrected_latitude ?? null,
      correctedLongitude: attrs.corrected_longitude ?? null,
      locationCorrected: attrs.location_corrected ?? null,
      locationDescription: attrs.location_description ?? null,
      routeName: attrs.route_name ?? null,
      routeId: attrs.route_id ?? null,
      milepost: attrs.milepost ?? null,
      parish: attrs.parish ?? null,
      municipality: attrs.municipality ?? null,

      // Requestor
      requestorName: attrs.requestor_name ?? null,
      requestorEmail: attrs.requestor_email ?? null,
      requestorPhone: attrs.requestor_phone ?? null,
      requestorOrganization: attrs.requestor_organization ?? null,
      submissionType: attrs.submission_type ?? null,

      // Assignment
      assignmentStatus: attrs.request_assignment ?? null,
      assignedWorkOrderGlobalId: normalizeGuid(attrs.assigned_work_order_globalid),
      assignedWorkOrderId: attrs.assigned_work_order_id ?? null,
      assignmentNotes: attrs.assignment_notes ?? null,
      assignedToName: attrs.assigned_to_name ?? null,
      assignedToEmail: attrs.assigned_to_email ?? null,
      assignedTeam: attrs.assigned_team ?? null,
      requiresDesign: attrs.requires_design ?? null,
      designStatus: attrs.design_status ?? null,
      maintenanceInitiativeGlobalId: attrs.maintenance_initiative_globalid ?? null,
      capitalProjectGlobalId: attrs.capital_project_globalid ?? null,

      // Notes
      publicNotes: attrs.public_notes ?? null,
      internalNotes: attrs.internal_notes ?? null,

      // Soft delete
      deleted: attrs.deleted ?? null,
      deletedDate: attrs.deleted_date ?? null,
      deletedBy: attrs.deleted_by ?? null,

      // Audit
      createdUser: attrs.created_user ?? null,
      createdDate: attrs.created_date ?? null,
      lastEditedUser: attrs.last_edited_user ?? null,
      lastEditedDate: attrs.last_edited_date ?? null,
    }
})

console.log('Mapped requests:', mappedRequests)

return mappedRequests
}


export async function getMovedRequests(): Promise<OmRequest[]> {
  const token = await getArcGISTokenForUrl(REQUEST_LAYER_URL)

  const params = new URLSearchParams({
    where:
      "request_assignment IN ('Moved to Maintenance Initiative', 'Moved to Capital Projects') " +
      "AND (deleted IS NULL OR deleted <> 'Yes')",
    outFields: '*',
    returnGeometry: 'false',
    f: 'json',
    token,
  })

  const url = `${REQUEST_LAYER_URL}/query?${params.toString()}`

  const response = await fetch(url)
  const data = await response.json()

  if (data.error) {
    console.error('ArcGIS moved-request query error:', data.error)
    throw new Error(data.error.message ?? 'Failed to query moved requests')
  }

  const features = data.features ?? []

  return features.map((feature: any) => {
    const attrs = feature.attributes ?? {}

    return {
      // Identity
      objectId: attrs.OBJECTID,
      globalId: normalizeGuid(attrs.GlobalID ?? attrs.globalid ?? attrs.GLOBALID),
      requestId: attrs.request_id ?? null,

      // Classification
      district: attrs.district ?? null,
      intakeType: attrs.intake_type ?? null,
      source: attrs.source ?? null,
      requestCategory: attrs.request_category ?? null,
      requestSubcategory: attrs.request_subcategory ?? null,
      requestTitle: attrs.request_title ?? null,
      requestDescription: attrs.request_description ?? null,

      // Triage
      urgency: attrs.urgency ?? null,
      priorityScore: attrs.priority_score ?? null,
      dueDate: attrs.due_date ?? null,
      triagedDate: attrs.triaged_date ?? null,

      // Status
      status: attrs.request_status ?? null,
      submittedDate: attrs.submitted_date ?? null,
      assignedDate: attrs.assigned_date ?? null,
      canceledDate: attrs.canceled_date ?? null,
      closedDate: attrs.closed_date ?? null,
      cancellationReason: attrs.cancellation_reason ?? null,
      closedReason: attrs.closed_reason ?? null,

      // Location
      originalLatitude: attrs.original_latitude ?? null,
      originalLongitude: attrs.original_longitude ?? null,
      correctedLatitude: attrs.corrected_latitude ?? null,
      correctedLongitude: attrs.corrected_longitude ?? null,
      locationCorrected: attrs.location_corrected ?? null,
      locationDescription: attrs.location_description ?? null,
      routeName: attrs.route_name ?? null,
      routeId: attrs.route_id ?? null,
      milepost: attrs.milepost ?? null,
      parish: attrs.parish ?? null,
      municipality: attrs.municipality ?? null,

      // Requestor
      requestorName: attrs.requestor_name ?? null,
      requestorEmail: attrs.requestor_email ?? null,
      requestorPhone: attrs.requestor_phone ?? null,
      requestorOrganization: attrs.requestor_organization ?? null,
      submissionType: attrs.submission_type ?? null,

      // Assignment
      assignmentStatus: attrs.request_assignment ?? null,
      assignedWorkOrderGlobalId: normalizeGuid(attrs.assigned_work_order_globalid),
      assignedWorkOrderId: attrs.assigned_work_order_id ?? null,
      assignmentNotes: attrs.assignment_notes ?? null,
      assignedToName: attrs.assigned_to_name ?? null,
      assignedToEmail: attrs.assigned_to_email ?? null,
      assignedTeam: attrs.assigned_team ?? null,
      requiresDesign: attrs.requires_design ?? null,
      designStatus: attrs.design_status ?? null,
      maintenanceInitiativeGlobalId: attrs.maintenance_initiative_globalid ?? null,
      capitalProjectGlobalId: attrs.capital_project_globalid ?? null,

      // Notes
      publicNotes: attrs.public_notes ?? null,
      internalNotes: attrs.internal_notes ?? null,

      // Soft delete
      deleted: attrs.deleted ?? null,
      deletedDate: attrs.deleted_date ?? null,
      deletedBy: attrs.deleted_by ?? null,

      // Audit
      createdUser: attrs.created_user ?? null,
      createdDate: attrs.created_date ?? null,
      lastEditedUser: attrs.last_edited_user ?? null,
      lastEditedDate: attrs.last_edited_date ?? null,
    }
  })
}

export async function assignRequestToWorkOrder(
  requestObjectId: number,
  workOrderObjectId: number
) {
  const token = await getArcGISTokenForUrl(REQUEST_LAYER_URL)

  // 1. Look up the work order's GlobalID + human-readable ID
const workOrderParams = new URLSearchParams({
  where: `OBJECTID = ${workOrderObjectId}`,
  outFields: 'GlobalID,work_order_id,work_order_status',   // 👈 added work_order_status
  returnGeometry: 'false',
  f: 'json',
  token,
})

const workOrderResponse = await fetch(
  `${WORK_ORDER_LAYER_URL}/query?${workOrderParams.toString()}`
)

const workOrderData = await workOrderResponse.json()

if (workOrderData.error) {
  console.error('ArcGIS work order query error:', workOrderData.error)
  throw new Error(workOrderData.error.message ?? 'Failed to query work order')
}

const workOrderAttrs = workOrderData.features?.[0]?.attributes ?? {}

// ArcGIS can return GlobalID with various casings — check them all
const workOrderGlobalId =
  workOrderAttrs.GlobalID ??
  workOrderAttrs.globalid ??
  workOrderAttrs.GLOBALID ??
  workOrderAttrs.Globalid ??
  null

const workOrderId = workOrderAttrs.work_order_id ?? null

const workOrderStatus = workOrderAttrs.work_order_status ?? null

if (!workOrderGlobalId) {
  console.error('Work order query result:', workOrderData)
  console.error('Work order attributes keys:', Object.keys(workOrderAttrs))
  throw new Error('Could not find selected work order GlobalID')
}


  // 2. Update the request: link to WO + flip assignment status + stamp date
  const updates = [
    {
      attributes: {
        OBJECTID: requestObjectId,
        assigned_work_order_globalid: workOrderGlobalId,
        assigned_work_order_id: workOrderId,
        request_assignment: 'Assigned to Work Order',
        assigned_date: Date.now(),
      },
    },
  ]

  const editParams = new URLSearchParams({
    f: 'json',
    token,
    updates: JSON.stringify(updates),
  })

  const updateResponse = await fetch(`${REQUEST_LAYER_URL}/applyEdits`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: editParams.toString(),
  })

  const updateData = await updateResponse.json()

  if (updateData.error) {
    console.error('ArcGIS request update error:', updateData.error)
    throw new Error(updateData.error.message ?? 'Failed to update request')
  }

  const updateResult = updateData.updateResults?.[0]

  if (!updateResult?.success) {
    console.error('ArcGIS request update result:', updateData)
    throw new Error('Request update failed')
  }

// ---- Business rule: promote a Draft WO to Open on first request assignment.
  //      Future: enforce this server-side via a SQL trigger and remove this block.
  if (workOrderStatus === 'Draft') {
    const woUpdate = [
      {
        attributes: {
          OBJECTID: workOrderObjectId,
          work_order_status: 'Open',
        },
      },
    ]

    const woEditParams = new URLSearchParams({
      f: 'json',
      token,
      updates: JSON.stringify(woUpdate),
    })

    const woUpdateResponse = await fetch(`${WORK_ORDER_LAYER_URL}/applyEdits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: woEditParams.toString(),
    })
    const woUpdateData = await woUpdateResponse.json()

    if (woUpdateData.error) {
      // Don't fail the assignment over the auto-promote — log and continue.
      console.warn('Failed to auto-promote WO from Draft to Open:', woUpdateData.error)
    } else if (!woUpdateData.updateResults?.[0]?.success) {
      console.warn('WO auto-promote returned non-success:', woUpdateData)
    }
  }

  return updateData

}

export async function unassignRequest(requestObjectId: number) {
  const token = await getArcGISTokenForUrl(REQUEST_LAYER_URL)

  // ---- 1. Look up the request so we know which WO it's attached to ----
  const reqLookupParams = new URLSearchParams({
    where: `OBJECTID = ${requestObjectId}`,
    outFields: 'OBJECTID,assigned_work_order_globalid',
    returnGeometry: 'false',
    f: 'json',
    token,
  })
  const reqLookupResponse = await fetch(
    `${REQUEST_LAYER_URL}/query?${reqLookupParams.toString()}`,
  )
  const reqLookupData = await reqLookupResponse.json()
  if (reqLookupData.error) {
    console.error('Request lookup error during unassign:', reqLookupData.error)
    throw new Error(reqLookupData.error.message ?? 'Failed to look up request')
  }
  const reqAttrs = reqLookupData.features?.[0]?.attributes ?? {}
  const woGuidRaw: string | null = reqAttrs.assigned_work_order_globalid ?? null
  const woGuid = woGuidRaw ? woGuidRaw.replace(/[{}]/g, '').toUpperCase() : null

  // ---- 2. If attached to a WO, look up its current status ----
  // We need this both for the lock-on-Closed/Canceled check AND for the
  // revert-to-Draft rule once we know whether this was the last request.
  let workOrderObjectId: number | null = null
  let workOrderStatus: string | null = null

  if (woGuid) {
    const woLookupParams = new URLSearchParams({
      // SDE stores braced GUIDs for GlobalID fields, so match the wrapped form.
      where: `GlobalID = '{${woGuid}}'`,
      outFields: 'OBJECTID,work_order_status',
      returnGeometry: 'false',
      f: 'json',
      token,
    })
    const woLookupResponse = await fetch(
      `${WORK_ORDER_LAYER_URL}/query?${woLookupParams.toString()}`,
    )
    const woLookupData = await woLookupResponse.json()
    if (!woLookupData.error) {
      const woAttrs = woLookupData.features?.[0]?.attributes ?? {}
      workOrderObjectId = woAttrs.OBJECTID ?? null
      workOrderStatus = woAttrs.work_order_status ?? null
    }
  }

  // ---- 3. BLOCK: can't remove requests from a Closed/Canceled WO ----
  if (workOrderStatus === 'Closed' || workOrderStatus === 'Canceled') {
    throw new Error(
      `Cannot unassign request — the work order is ${workOrderStatus}. ` +
      `Closed and canceled work orders are locked.`
    )
  }

  // ---- 4. Update the request: clear the WO link + revert assignment ----
  const updates = [
    {
      attributes: {
        OBJECTID: requestObjectId,
        assigned_work_order_globalid: null,
        assigned_work_order_id: null,
        request_assignment: 'Unassigned',
        assigned_date: null,
      },
    },
  ]

  const editParams = new URLSearchParams({
    f: 'json',
    token,
    updates: JSON.stringify(updates),
  })

  const updateResponse = await fetch(`${REQUEST_LAYER_URL}/applyEdits`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: editParams.toString(),
  })
  const updateData = await updateResponse.json()
  if (updateData.error) {
    console.error('ArcGIS request unassign error:', updateData.error)
    throw new Error(updateData.error.message ?? 'Failed to unassign request')
  }
  const updateResult = updateData.updateResults?.[0]
  if (!updateResult?.success) {
    console.error('ArcGIS request unassign result:', updateData)
    throw new Error('Request unassign failed')
  }

  // ---- 5. Business rule (conservative): if that was the LAST request on the WO
  //         AND the WO is still in Open, revert it to Draft. We do NOT revert
  //         past-Open statuses (Assigned/Scheduled/In Progress/On Hold) because
  //         those reflect work-in-progress, not request-attached state.
  if (workOrderObjectId !== null && workOrderStatus === 'Open' && woGuid) {
    const remainingParams = new URLSearchParams({
      where:
        `assigned_work_order_globalid = '{${woGuid}}' ` +
        `AND (deleted IS NULL OR deleted = 'No')`,
      returnCountOnly: 'true',
      f: 'json',
      token,
    })
    const remainingResponse = await fetch(
      `${REQUEST_LAYER_URL}/query?${remainingParams.toString()}`,
    )
    const remainingData = await remainingResponse.json()

    if (!remainingData.error && remainingData.count === 0) {
      const woUpdate = [
        {
          attributes: {
            OBJECTID: workOrderObjectId,
            work_order_status: 'Draft',
          },
        },
      ]
      const woEditParams = new URLSearchParams({
        f: 'json',
        token,
        updates: JSON.stringify(woUpdate),
      })
      const woUpdateResponse = await fetch(`${WORK_ORDER_LAYER_URL}/applyEdits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: woEditParams.toString(),
      })
      const woUpdateData = await woUpdateResponse.json()
      if (woUpdateData.error) {
        console.warn('Failed to revert WO Open→Draft after last unassign:', woUpdateData.error)
      } else if (!woUpdateData.updateResults?.[0]?.success) {
        console.warn('WO revert returned non-success:', woUpdateData)
      }
    }
  }

  return updateData
}
/**
 * Update a single om_request row.
 *
 * @param objectId - OBJECTID of the row to update (REQUIRED — identifies the row)
 * @param changes  - Partial OmRequest with only the fields you want to change.
 *                   Unknown / unmapped keys are silently ignored.
 *
 * Throws if the REST call fails or applyEdits reports success=false.
 * On success, returns nothing — caller should optimistically apply `changes`
 * locally or re-fetch the row.
 */
export async function updateRequest(
  objectId: number,
  changes: Partial<OmRequest>,
): Promise<void> {
  if (!objectId) {
    throw new Error('updateRequest: objectId is required')
  }

  // Build the REST attributes payload: OBJECTID + only the mapped/changed fields.
  const restAttributes: Record<string, unknown> = { OBJECTID: objectId }

  for (const [tsKey, restKey] of Object.entries(FIELD_MAP)) {
    if (Object.prototype.hasOwnProperty.call(changes, tsKey)) {
      const value = changes[tsKey as keyof OmRequest]
      // Send empty strings as null — keeps clears working consistently.
      restAttributes[restKey as string] = value === '' ? null : value
    }
  }

  // Sanity check: if nothing besides OBJECTID is in the payload, no-op.
  if (Object.keys(restAttributes).length === 1) {
    console.warn('updateRequest called with no mapped changes — skipping')
    return
  }

  await applyEdits({
    layerUrl: REQUEST_LAYER_URL,
    updates: [{ attributes: restAttributes }],
  })
}

/**
 * Cancel a request: sets request_status to "Canceled" and writes the
 * cancellation reason. Used by the Cancel Request modal in
 * RequestDetailPanel. Returns the patch that was applied so the caller
 * can merge it into local state.
 */
export async function cancelRequest(
  objectId: number,
  reason: string,
): Promise<Partial<OmRequest>> {
  const trimmed = reason.trim()
  if (!trimmed) {
    throw new Error('Cancellation reason is required.')
  }

  const now = Date.now()
  const patch: Partial<OmRequest> = {
    status: 'Canceled',
    cancellationReason: trimmed,
    canceledDate: now,
  }

  await updateRequest(objectId, patch)
  return patch
}
/**
 * Complete triage on a request. Single applyEdits write that sets:
 *   - requires_design (Yes/No from the modal)
 *   - status (derived: Yes → "In Design", No → "Ready for Work Order")
 *   - triaged_date (now)
 *
 * Returns the patch so the caller can merge it into local state.
 *
 * TODO (future): if/when SDE archive needs to show a "Triaged" step, either
 * split this into two sequential writes (Triaged → final), or add a SQL
 * trigger that inserts a synthetic Triaged row on the Draft|New → final jump.
 */
export async function completeTriage(
  objectId: number,
  requiresDesign: 'Yes' | 'No',
): Promise<Partial<OmRequest>> {
  const now = Date.now()
  const nextStatus = requiresDesign === 'Yes' ? 'In Design' : 'Ready for Work Order'

  const patch: Partial<OmRequest> = {
    requiresDesign,
    status: nextStatus,
    triagedDate: now,
  }

  await updateRequest(objectId, patch)
  return patch
}

/**
 * Move a request out of triage into either a Maintenance Initiative or a
 * Capital Project. This is a terminal lifecycle event for the request:
 *   - request_assignment  → 'Moved to Maintenance Initiative' or 'Moved to Capital Projects'
 *   - request_status      → 'Closed'
 *   - maintenance_initiative_globalid / capital_project_globalid → the provided link value
 *   - assigned_date       → now (reusing the generic "got assigned to something" field)
 *   - closed_date         → now
 *
 * Also drops a Triage note capturing the move (and the user's reason if given),
 * so the move is visible in the audit trail even before SQL status_history triggers exist.
 *
 * Future: SQL trigger should own the date stamps and assignment-value enforcement.
 * When that lands, strip the client-side date logic from here.
 */
export async function moveRequestToProgram(params: {
  requestObjectId: number
  requestGlobalId: string
  target: ProgramTarget
  programLinkValue: string  // GlobalID for now (see programLinks.ts TODO)
  reason?: string
}): Promise<void> {
  const { requestObjectId, requestGlobalId, target, programLinkValue, reason } = params

  if (!requestObjectId) throw new Error('moveRequestToProgram: requestObjectId is required')
  if (!requestGlobalId) throw new Error('moveRequestToProgram: requestGlobalId is required')
  if (!programLinkValue?.trim()) throw new Error('moveRequestToProgram: programLinkValue is required')

  const link = programLinks[target]
  const now = Date.now()
  const token = await getArcGISTokenForUrl(REQUEST_LAYER_URL)

  // ---- 1. Update the request row ----
  // Build the attributes dynamically so we hit the right *_id field per target.
  const updateAttributes: Record<string, unknown> = {
    OBJECTID: requestObjectId,
    request_assignment: link.requestAssignmentValue,
    request_status: 'Closed',
    assigned_date: now,
    closed_date: now,
  }
  updateAttributes[link.requestIdFieldName] = programLinkValue.trim()

  // Defensive: if the request happened to be on a WO, clear the WO link so
  // nothing thinks it's still attached. (We don't run the full unassign /
  // WO-revert logic here — that's a known follow-up; see backlog.)
  updateAttributes.assigned_work_order_globalid = null
  updateAttributes.assigned_work_order_id = null

  const editParams = new URLSearchParams({
    f: 'json',
    token,
    updates: JSON.stringify([{ attributes: updateAttributes }]),
  })

  const updateResponse = await fetch(`${REQUEST_LAYER_URL}/applyEdits`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: editParams.toString(),
  })
  const updateData = await updateResponse.json()
  if (updateData.error) {
    console.error('moveRequestToProgram update error:', updateData.error)
    throw new Error(updateData.error.message ?? 'Failed to move request')
  }
  const updateResult = updateData.updateResults?.[0]
  if (!updateResult?.success) {
    console.error('moveRequestToProgram non-success:', updateData)
    throw new Error('Failed to move request')
  }

  // ---- 2. Auto-create a Triage note capturing the move ----
  // We don't fail the move if note creation fails — log and continue.
  // The request is already moved; users can add a note manually if needed.
  const baseText = `Moved to ${link.label} ${programLinkValue.trim()}.`
  const noteText = reason?.trim()
    ? `${baseText} Reason: ${reason.trim()}`
    : baseText

  try {
    await addRequestNote({
      requestGlobalId,
      noteType: 'Triage',
      noteText,
      noteDate: now,
    })
  } catch (err) {
    console.warn('moveRequestToProgram: move succeeded but note creation failed:', err)
  }
}

/**
 * Return a previously-moved request back to the unassigned triage pool.
 *
 * This is the inverse of moveRequestToProgram. It is the only supported way
 * to undo a move-to-program action from within the app (admins can otherwise
 * only do it via ArcGIS Pro / SQL).
 *
 * Effects on the request row:
 *   - request_assignment              → 'Unassigned'
 *   - request_status                  → 'Triaged' if triaged_date is set, else 'New'
 *   - maintenance_initiative_globalid → null
 *   - capital_project_globalid        → null
 *   - assigned_date                   → null
 *   - closed_date                     → null
 *   - closed_reason                   → null
 *
 * Also drops a Triage note capturing the return + the user's reason so the
 * action is visible in the audit trail.
 *
 * Future: SQL trigger should own date stamps and assignment-value enforcement.
 * When that lands, strip the client-side logic from here.
 */
export async function returnRequestToUnassigned(params: {
  requestObjectId: number
  requestGlobalId: string
  fromTarget: ProgramTarget
  fromProgramName: string  // human-readable label for the note (e.g. "Vegetation Maintenance")
  reason: string           // required
  triagedDate: number | null
}): Promise<void> {
  const {
    requestObjectId,
    requestGlobalId,
    fromTarget,
    fromProgramName,
    reason,
    triagedDate,
  } = params

  if (!requestObjectId) {
    throw new Error('returnRequestToUnassigned: requestObjectId is required')
  }
  if (!requestGlobalId) {
    throw new Error('returnRequestToUnassigned: requestGlobalId is required')
  }
  if (!reason?.trim()) {
    throw new Error('returnRequestToUnassigned: reason is required')
  }

  const link = programLinks[fromTarget]
  const now = Date.now()
  const restoredStatus = triagedDate ? 'Triaged' : 'New'

  // ---- 1. Update the request row ----
  const updateAttributes: Record<string, unknown> = {
    OBJECTID: requestObjectId,
    request_assignment: 'Unassigned',
    request_status: restoredStatus,
    assigned_date: null,
    closed_date: null,
    closed_reason: null,
  }
  // Clear whichever program link field was set
  updateAttributes[link.requestIdFieldName] = null

  const token = await getArcGISTokenForUrl(REQUEST_LAYER_URL)

  const editParams = new URLSearchParams({
    f: 'json',
    token,
    updates: JSON.stringify([{ attributes: updateAttributes }]),
  })

  const updateResponse = await fetch(`${REQUEST_LAYER_URL}/applyEdits`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: editParams.toString(),
  })
  const updateData = await updateResponse.json()
  if (updateData.error) {
    console.error('returnRequestToUnassigned update error:', updateData.error)
    throw new Error(updateData.error.message ?? 'Failed to return request to unassigned')
  }
  const updateResult = updateData.updateResults?.[0]
  if (!updateResult?.success) {
    console.error('returnRequestToUnassigned non-success:', updateData)
    throw new Error('Failed to return request to unassigned')
  }

  // ---- 2. Auto-create a Triage note capturing the return ----
  const noteText =
    `Returned to Unassigned from ${link.label}: ${fromProgramName}. ` +
    `Reason: ${reason.trim()}`

  try {
    await addRequestNote({
      requestGlobalId,
      noteType: 'Triage',
      noteText,
      noteDate: now,
    })
  } catch (err) {
    console.warn(
      'returnRequestToUnassigned: return succeeded but note creation failed:',
      err,
    )
  }
}