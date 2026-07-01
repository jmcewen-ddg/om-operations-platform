// Orchestrates the "recompute a work order's urgency from its attached
// requests" flow. Sits above services in the dependency graph so we
// avoid any circular imports:
//
//   workOrderService  ◀── recomputeUrgency ──▶ requestService
//
// Neither service knows about the other. Both are imported here, wired
// together, and exposed as a single async operation. Call this AFTER
// any request assignment/unassignment commits.
//
// Semantics:
//   - Empty attached list → WO urgency set to NULL
//   - Otherwise → max(Immediate > Emergency > Standard)

import { getRequestUrgenciesForWorkOrder } from '../../services/requestService'
import { writeWorkOrderUrgency } from '../../services/workOrderService'
import { computeMaxUrgency } from './workOrderUrgency'

/**
 * Recompute a work order's urgency from its currently-attached,
 * non-deleted requests, and persist the result.
 *
 * @param workOrderObjectId - OBJECTID of the WO (for the write)
 * @param workOrderGlobalId - GlobalID of the same WO (for the request query)
 */
export async function recomputeWorkOrderUrgency(
  workOrderObjectId: number,
  workOrderGlobalId: string,
): Promise<void> {
  if (!workOrderObjectId) {
    throw new Error('recomputeWorkOrderUrgency: workOrderObjectId is required')
  }
  if (!workOrderGlobalId) {
    throw new Error('recomputeWorkOrderUrgency: workOrderGlobalId is required')
  }

  // 1. Query just the urgencies of attached, non-deleted requests
  const urgencies = await getRequestUrgenciesForWorkOrder(workOrderGlobalId)

  // 2. Compute the max. computeMaxUrgency() expects OmRequest[]; wrap
  //    the flat urgency list as minimal shape-compatible objects.
  const newUrgency = computeMaxUrgency(
    urgencies.map((u) => ({ urgency: u })) as any,
  )

  // 3. Persist
  await writeWorkOrderUrgency(workOrderObjectId, newUrgency)

  console.log(
    `[recomputeWorkOrderUrgency] WO OBJECTID=${workOrderObjectId} → urgency=${newUrgency ?? 'NULL'} (from ${urgencies.length} attached request(s))`,
  )
}