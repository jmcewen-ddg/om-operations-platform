import { getArcGISTokenForUrl } from './arcgisAuth'

function normalizeGuid(g: string | null | undefined): string | null {
  if (!g) return null
  return g.replace(/[{}]/g, '').toUpperCase()
}

export type OmRequest = {
  objectId: number
  requestId: string | null
  district: string | null
  urgency: string | null
  status: string | null
  title: string | null
  assignmentStatus: string | null
  assignedWorkOrderGlobalId: string | null
  assignedWorkOrderId: string | null
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
      objectId: attrs.OBJECTID,
      requestId: attrs.request_id ?? null,
      district: attrs.district ?? null,
      urgency: attrs.urgency ?? null,
      status: attrs.request_status ?? null,
      title: attrs.request_title ?? null,
      assignmentStatus: attrs.request_assignment ?? null,
      assignedWorkOrderGlobalId: normalizeGuid(attrs.assigned_work_order_globalid),
      assignedWorkOrderId: attrs.assigned_work_order_id ?? null,
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
    objectId: attrs.OBJECTID,
    requestId: attrs.request_id ?? null,
    district: attrs.district ?? null,
    urgency: attrs.urgency ?? null,
    status: attrs.request_status ?? null,
    title: attrs.request_title ?? null,
    assignmentStatus: attrs.request_assignment ?? null,
    assignedWorkOrderGlobalId: normalizeGuid(attrs.assigned_work_order_globalid),
    assignedWorkOrderId: attrs.assigned_work_order_id ?? null,
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