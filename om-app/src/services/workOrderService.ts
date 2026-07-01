import FeatureLayer from '@arcgis/core/layers/FeatureLayer'
import { arcgisConfig } from '../config/arcgis'
import Graphic from '@arcgis/core/Graphic'

export type OmWorkOrder = {
  // Identity
  objectId: number
  globalId: string | null
  workOrderId: string | null

  // Classification
  district: string | null
  workOrderType: string | null
  workOrderTitle: string | null
  scopeOfWork: string | null
  urgency: string | null            // ← read-only in UI; derived in SQL
  workOrderStatus: string | null

  // Assignment
  assignedToName: string | null
  assignedToEmail: string | null
  assignedTeam: string | null

  // Schedule
  scheduledStartDate: number | null
  scheduledEndDate: number | null
  actualStartDate: number | null
  actualEndDate: number | null
  completedDate: number | null
  closedDate: number | null
  canceledDate: number | null

  // Effort / cost
  estimatedHours: number | null
  actualHours: number | null
  estimatedCost: number | null
  actualCost: number | null

  // Close-out
  completionNotes: string | null
  cancellationReason: string | null

  // Soft delete
  deleted: string | null
  deletedDate: number | null
  deletedBy: string | null

  // Audit (read-only — set by Esri editor tracking)
  createdUser: string | null
  createdDate: number | null
  lastEditedUser: string | null
  lastEditedDate: number | null
}

/**
 * Maps TS OmWorkOrder field names (camelCase) → REST field names (snake_case).
 * Only EDITABLE fields appear here. System fields (OBJECTID, GlobalID,
 * work_order_id, audit fields, urgency, etc.) are intentionally excluded.
 *
 * Notes on what's NOT here:
 *  - urgency           — derived in SQL from attached requests
 *  - district          — set at create time, shouldn't be editable
 *  - work_order_id     — set by SQL trigger from sequence
 *  - deleted/audit     — system-managed
 */
const FIELD_MAP: Partial<Record<keyof OmWorkOrder, string>> = {
  // Classification
  workOrderTitle:  'work_order_title',
  workOrderType:   'work_order_type',
  scopeOfWork:     'scope_of_work',
  workOrderStatus: 'work_order_status',

  // Assignment
  assignedToName:  'assigned_to_name',
  assignedToEmail: 'assigned_to_email',
  assignedTeam:    'assigned_team',

  // Schedule
  scheduledStartDate: 'scheduled_start_date',
  scheduledEndDate:   'scheduled_end_date',
  actualStartDate:    'actual_start_date',
  actualEndDate:      'actual_end_date',
  completedDate:      'completed_date',
  closedDate:         'closed_date',

  // Effort / cost
  estimatedHours: 'estimated_hours',
  actualHours:    'actual_hours',
  estimatedCost:  'estimated_cost',
  actualCost:     'actual_cost',

  // Close-out
  completionNotes:    'completion_notes',
  cancellationReason: 'cancellation_reason',
  canceledDate: 'canceled_date',
}

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
  //query.num = 1000

  const result = await workOrderLayer.queryFeatures(query)

return result.features.map((feature) => {
    const a = feature.attributes

    return {
      // Identity
      objectId:    a.OBJECTID,
      globalId:    normalizeGuid(a.GlobalID ?? a.globalid ?? a.GLOBALID),
      workOrderId: a.work_order_id ?? null,

      // Classification
      district:        a.district ?? null,
      workOrderType:   a.work_order_type ?? null,
      workOrderTitle:  a.work_order_title ?? null,
      scopeOfWork:     a.scope_of_work ?? null,
      urgency:         a.urgency ?? null,
      workOrderStatus: a.work_order_status ?? null,

      // Assignment
      assignedToName:  a.assigned_to_name ?? null,
      assignedToEmail: a.assigned_to_email ?? null,
      assignedTeam:    a.assigned_team ?? null,

      // Schedule
      scheduledStartDate: a.scheduled_start_date ?? null,
      scheduledEndDate:   a.scheduled_end_date ?? null,
      actualStartDate:    a.actual_start_date ?? null,
      actualEndDate:      a.actual_end_date ?? null,
      completedDate:      a.completed_date ?? null,
      closedDate:         a.closed_date ?? null,

      // Effort / cost
      estimatedHours: a.estimated_hours ?? null,
      actualHours:    a.actual_hours ?? null,
      estimatedCost:  a.estimated_cost ?? null,
      actualCost:     a.actual_cost ?? null,
      canceledDate:       a.canceled_date ?? null,

      // Close-out
      completionNotes:    a.completion_notes ?? null,
      cancellationReason: a.cancellation_reason ?? null,

      // Soft delete
      deleted:     a.deleted ?? null,
      deletedDate: a.deleted_date ?? null,
      deletedBy:   a.deleted_by ?? null,

      // Audit
      createdUser:    a.created_user ?? null,
      createdDate:    a.created_date ?? null,
      lastEditedUser: a.last_edited_user ?? null,
      lastEditedDate: a.last_edited_date ?? null,
    }
  })
}

export async function createWorkOrder(params: {
  work_order_id: string
  district: string
  urgency?: string
}): Promise<{ objectId: number; globalId: string }> {
  const attributes = {
    work_order_id: 'PENDING',
    district: params.district,
    work_order_status: 'Draft',
    urgency: params.urgency ?? 'N/A',
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
/**
 * Update a single om_work_order row.
 *
 * Mirror of updateRequest() in requestService.ts — same pattern: takes an
 * OBJECTID + a partial OmWorkOrder, builds a REST attributes payload from
 * FIELD_MAP, and calls applyEdits.
 *
 * @param objectId - OBJECTID of the row to update (REQUIRED)
 * @param changes  - Partial OmWorkOrder with only the fields you want to change.
 *                   Unknown / unmapped keys are silently ignored.
 *
 * Throws if applyEdits fails or reports success=false.
 */
export async function updateWorkOrder(
  objectId: number,
  changes: Partial<OmWorkOrder>,
): Promise<void> {
  if (!objectId) throw new Error('updateWorkOrder: objectId is required')

  // Build the REST attributes payload: OBJECTID + only the mapped/changed fields.
  const restAttributes: Record<string, unknown> = { OBJECTID: objectId }

  for (const [tsKey, restKey] of Object.entries(FIELD_MAP)) {
    if (Object.prototype.hasOwnProperty.call(changes, tsKey)) {
      const value = changes[tsKey as keyof OmWorkOrder]
      // Send empty strings as null — keeps "clear field" working consistently
      restAttributes[restKey as string] = value === '' ? null : value
    }
  }

  // Sanity check: if nothing besides OBJECTID is in the payload, no-op.
  if (Object.keys(restAttributes).length === 1) {
    console.warn('updateWorkOrder called with no mapped changes — skipping')
    return
  }

  let result
  try {
    result = await workOrderLayer.applyEdits({
      updateFeatures: [new Graphic({ attributes: restAttributes })],
    })
  } catch (err: any) {
    console.error('updateWorkOrder applyEdits threw:', err)
    throw new Error(
      err?.details?.messages?.join('; ') ??
      err?.details?.message ??
      err?.message ??
      'Failed to update work order.'
    )
  }

  const updateResult = result.updateFeatureResults?.[0]
  if (!updateResult || updateResult.error) {
    console.error('updateWorkOrder failed. Full result:', result)
    throw new Error(updateResult?.error?.message ?? 'Failed to update work order.')
  }
}

/**
 * Cancel a work order: sets work_order_status to "Canceled" and writes
 * the cancellation reason. Used by the Cancel Work Order modal in
 * WorkOrderDetailPanel. Returns the patch that was applied so the caller
 * can merge it into local state.
 *
 * NOTE: Attached requests remain attached — their request_assignment
 * still says "Assigned to Work Order". A future cleanup pass (or SQL
 * trigger) may want to unassign them when the WO is canceled. For now,
 * the matrix shows it as a closed state and operators can manually
 * reassign if needed.
 */
export async function cancelWorkOrder(
  objectId: number,
  reason: string,
): Promise<Partial<OmWorkOrder>> {
  const trimmed = reason.trim()
  if (!trimmed) {
    throw new Error('Cancellation reason is required.')
  }

  const now = Date.now()
  const patch: Partial<OmWorkOrder> = {
    workOrderStatus: 'Canceled',
    cancellationReason: trimmed,
    canceledDate: now,
  }

  await updateWorkOrder(objectId, patch)
  return patch
}