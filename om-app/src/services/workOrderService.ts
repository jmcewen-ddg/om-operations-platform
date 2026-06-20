import FeatureLayer from '@arcgis/core/layers/FeatureLayer'
import { arcgisConfig } from '../config/arcgis'
import Graphic from '@arcgis/core/Graphic'

export type OmWorkOrder = {
  objectId: number
  globalId: string | null    // ← was string | undefined
  workOrderId: string | null
  district: string | null
  workOrderStatus: string | null
  priority: string | null
  workOrderTitle: string | null
  workOrderDescription: string | null
}

// const WORK_ORDER_LAYER_URL = 'https://gis.ddgpc.com/arcgis/rest/services/25-1755_OLHC/OM_Work_Order/FeatureServer/0'
//const WORK_ORDER_ASSIGNMENT_URL = 'https://gis.ddgpc.com/arcgis/rest/services/25-1755_OLHC/OM_Work_Order/FeatureServer/1'
//const WORK_ORDER_LABOR_URL = 'https://gis.ddgpc.com/arcgis/rest/services/25-1755_OLHC/OM_Work_Order/FeatureServer/2'
//const WORK_ORDER_MATERIAL_URL = 'https://gis.ddgpc.com/arcgis/rest/services/25-1755_OLHC/OM_Work_Order/FeatureServer/3'
//const WORK_ORDER_NOTE_URL = 'https://gis.ddgpc.com/arcgis/rest/services/25-1755_OLHC/OM_Work_Order/FeatureServer/4'
//const WORK_ORDER_STATUS_HISTORY_URL = 'https://gis.ddgpc.com/arcgis/rest/services/25-1755_OLHC/OM_Work_Order/FeatureServer/5'

const workOrderLayer = new FeatureLayer({
  url: arcgisConfig.services.workOrders,
})

function normalizeGuid(g: string | null | undefined): string | null {
  if (!g) return null
  return g.replace(/[{}]/g, '').toUpperCase()
}

export async function getWorkOrders(): Promise<OmWorkOrder[]> {
  const query = workOrderLayer.createQuery()

  query.where = "deleted IS NULL OR deleted = 'No'"
  query.outFields = ['*']
  query.returnGeometry = false
  query.num = 10

  const result = await workOrderLayer.queryFeatures(query)

  return result.features.map((feature) => {
    const attributes = feature.attributes

    console.log('Work order attributes:', attributes)

    return {
      objectId: attributes.OBJECTID,
      globalId: normalizeGuid(attributes.GlobalID ?? attributes.globalid ?? attributes.GLOBALID),
      workOrderId: attributes.work_order_id,
      district: attributes.district,
      workOrderStatus: attributes.work_order_status,
      priority: attributes.priority,
      workOrderTitle: attributes.work_order_title,
      workOrderDescription: attributes.work_order_description,
    }
  })
}

export async function createWorkOrder(params: {
  work_order_id: string
  district: string
  priority?: string
}): Promise<{ objectId: number; globalId: string }> {
  const attributes = {
    work_order_id: 'PENDING',
    district: params.district,
    work_order_status: 'Draft',
    priority: params.priority ?? 'N/A',
  }

  // applyEdits() handles auth via IdentityManager — no manual token plumbing

let result
try {
  result = await workOrderLayer.applyEdits({
    addFeatures: [new Graphic({ attributes })],
  })
} catch (err: any) {
  console.error('applyEdits threw:', err)
  console.error('  err.message:', err?.message)
  console.error('  err.details:', err?.details)
  console.error('  err.details.messages:', err?.details?.messages)
  console.error('  err.details.message:', err?.details?.message)
  console.error('  full JSON:', JSON.stringify(err, null, 2))
  throw new Error(
    err?.details?.messages?.join('; ') ??
    err?.details?.message ??
    err?.message ??
    'applyEdits failed.'
  )
}

console.log('applyEdits raw result:', result)
const addResult = result.addFeatureResults?.[0]
if (!addResult || addResult.error) {
  console.error('createWorkOrder failed. Full result:', result)
  console.error('addResult.error:', addResult?.error)
  throw new Error(
    addResult?.error?.message ??
    addResult?.error?.details?.join('; ') ??
    'Failed to create work order.'
  )
}


  // Triggers have fired; re-query the new row to grab the assigned GlobalID + work_order_id
  const query = workOrderLayer.createQuery()
  query.where = `OBJECTID = ${addResult.objectId}`
  query.outFields = ['OBJECTID', 'GlobalID', 'work_order_id']
  query.returnGeometry = false

  const queryResult = await workOrderLayer.queryFeatures(query)
  const feature = queryResult.features[0]
  const globalId =
    normalizeGuid(
      feature?.attributes?.GlobalID ??
      feature?.attributes?.globalid ??
      feature?.attributes?.GLOBALID
    ) ?? ''

  console.log('Created work order:', {
    objectId: addResult.objectId,
    globalId,
    workOrderId: feature?.attributes?.work_order_id,
  })

  return {
    objectId: addResult.objectId as number,
    globalId,
  }
}
export async function softDeleteWorkOrder(objectId: number): Promise<void> {
  // Soft delete = set `deleted = 'Yes'`. The record stays in the DB; admin views
  // can still see it. Hard deletes are not allowed anywhere in this system.
  //
  // NOTE: `deleted_date` and `deleted_by` exist on the table but are not stamped
  // here yet — ArcGIS editor tracking already captures who/when on every edit.
  // Promote to explicit stamping when admin-deleted views need to distinguish
  // delete events from other edits.

  const attributes = {
    OBJECTID: objectId,
    deleted: 'Yes',
  }

  let result
  try {
    result = await workOrderLayer.applyEdits({
      updateFeatures: [new Graphic({ attributes })],
    })
  } catch (err: any) {
    console.error('softDeleteWorkOrder applyEdits threw:', err)
    throw new Error(
      err?.details?.messages?.join('; ') ??
      err?.details?.message ??
      err?.message ??
      'Failed to delete work order.'
    )
  }

  const updateResult = result.updateFeatureResults?.[0]
  if (!updateResult || updateResult.error) {
    console.error('softDeleteWorkOrder failed. Full result:', result)
    throw new Error(
      updateResult?.error?.message ??
      'Failed to delete work order.'
    )
  }
}