import { getArcGISTokenForUrl } from './arcgisAuth'

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
  maintenanceInitiativeId: string | null
  capitalProjectId: string | null

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

const REQUEST_LAYER_URL = 'https://gis.ddgpc.com/arcgis/rest/services/25-1755_OLHC/OM_Request/FeatureServer/0'
//const REQUEST_NOTE_URL = 'https://gis.ddgpc.com/arcgis/rest/services/25-1755_OLHC/OM_Request/FeatureServer/2'
//const REQUEST_STATUS_HISTORY_URL = 'https://gis.ddgpc.com/arcgis/rest/services/25-1755_OLHC/OM_Request/FeatureServer/3'
//const RELATED_DOCUMENT_URL = 'https://gis.ddgpc.com/arcgis/rest/services/25-1755_OLHC/OM_Request/FeatureServer/4'
const WORK_ORDER_LAYER_URL = 'https://gis.ddgpc.com/arcgis/rest/services/25-1755_OLHC/OM_Work_Order/FeatureServer/0'
//const WORK_ORDER_ASSIGNMENT_URL = 'https://gis.ddgpc.com/arcgis/rest/services/25-1755_OLHC/OM_Work_Order/FeatureServer/1'
//const WORK_ORDER_LABOR_URL = 'https://gis.ddgpc.com/arcgis/rest/services/25-1755_OLHC/OM_Work_Order/FeatureServer/2'
//const WORK_ORDER_MATERIAL_URL = 'https://gis.ddgpc.com/arcgis/rest/services/25-1755_OLHC/OM_Work_Order/FeatureServer/3'
//const WORK_ORDER_NOTE_URL = 'https://gis.ddgpc.com/arcgis/rest/services/25-1755_OLHC/OM_Work_Order/FeatureServer/4'
//const WORK_ORDER_STATUS_HISTORY_URL = 'https://gis.ddgpc.com/arcgis/rest/services/25-1755_OLHC/OM_Work_Order/FeatureServer/5'

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
      maintenanceInitiativeId: attrs.maintenance_initiative_id ?? null,
      capitalProjectId: attrs.capital_project_id ?? null,

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
      maintenanceInitiativeId: attrs.maintenance_initiative_id ?? null,
      capitalProjectId: attrs.capital_project_id ?? null,

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

export async function assignRequestToWorkOrder(
  requestObjectId: number,
  workOrderObjectId: number
) {
  const token = await getArcGISTokenForUrl(REQUEST_LAYER_URL)

  // 1. Look up the work order's GlobalID + human-readable ID
  const workOrderParams = new URLSearchParams({
  where: `OBJECTID = ${workOrderObjectId}`,
  outFields: 'GlobalID,work_order_id',
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

  return updateData
}

export async function unassignRequest(requestObjectId: number) {
  const token = await getArcGISTokenForUrl(REQUEST_LAYER_URL)

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
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
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
  return updateData
}