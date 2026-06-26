/**
 * Request status derivation.
 *
 * Status is never directly editable in the app — it's derived from
 * field values + workflow actions. This module is the single source of
 * truth for those derivations.
 *
 * The lifecycle (from FIELD_EDIT_MATRIX.md):
 *
 *   Anonymous insert                  → New
 *   Signed-in insert                  → Draft
 *   "Complete Triage" manual action   → Triaged (then derives below)
 *   requires_design = No              → Ready for Work Order
 *   requires_design = Yes,
 *     design_status != Complete       → In Design
 *   requires_design = Yes,
 *     design_status = Complete        → Ready for Work Order
 *   Attached to WO                    → Assigned to Work Order
 *   Cancel action                     → Canceled (terminal)
 *   Move to MI/CP action              → Closed (terminal)
 *
 * Note: SQL trigger stamps the *_date fields when it sees status change.
 * This module just decides what the status should be.
 */

import { deriveStatus, type DerivationRule } from '../../lib/statusDerivation'

/** Status codes from the om_request_status domain. */
export type RequestStatus =
  | 'New'
  | 'Draft'
  | 'Triaged'
  | 'In Design'
  | 'Ready for Work Order'
  | 'Assigned to Work Order'
  | 'Canceled'
  | 'Closed'

/**
 * Minimal context for status derivation. Intentionally narrow — we
 * only depend on the fields that actually drive status. Callers can
 * pass a full OmRequest; structural typing means it'll fit.
 */
export type RequestStatusContext = {
  requires_design?: 'Yes' | 'No' | null
  design_status?: 'Not Started' | 'In Progress' | 'Complete' | null
  assigned_work_order_globalid?: string | null
}

// ---------------------------------------------------------------------------
// Post-triage derivation
// ---------------------------------------------------------------------------
//
// Called after "Complete Triage" runs. Assumes the request was just moved
// from Draft/New → Triaged. Returns the next status based on design fields.
//
// Rules ordered most-specific first. The "no design needed" rule is the
// natural fallback for the common case.

const POST_TRIAGE_RULES: DerivationRule<RequestStatusContext, RequestStatus>[] = [
  {
    name: 'design-required-and-incomplete',
    when: (r) =>
      r.requires_design === 'Yes' && r.design_status !== 'Complete',
    then: 'In Design',
  },
  {
    name: 'design-required-and-complete',
    when: (r) =>
      r.requires_design === 'Yes' && r.design_status === 'Complete',
    then: 'Ready for Work Order',
  },
  {
    name: 'no-design-required',
    when: (r) => r.requires_design === 'No',
    then: 'Ready for Work Order',
  },
]

/**
 * Given a freshly-triaged request, derive whether it goes to
 * In Design or Ready for Work Order.
 *
 * Fallback is 'Triaged' — meaning "we don't have enough info to decide
 * yet" (e.g., requires_design wasn't set). UI should treat this as a
 * validation error and keep the user on the triage form.
 */
export function derivePostTriageStatus(
  ctx: RequestStatusContext,
): RequestStatus {
  return deriveStatus(POST_TRIAGE_RULES, ctx, 'Triaged')
}

// ---------------------------------------------------------------------------
// In-Design progression
// ---------------------------------------------------------------------------
//
// Called whenever design_status changes on a request currently In Design.
// Promotes to Ready for Work Order when design wraps up.

const IN_DESIGN_RULES: DerivationRule<RequestStatusContext, RequestStatus>[] = [
  {
    name: 'design-complete',
    when: (r) => r.design_status === 'Complete',
    then: 'Ready for Work Order',
  },
]

/**
 * Given an In-Design request whose design_status just changed, derive
 * the new status. Returns 'In Design' if not yet complete.
 */
export function deriveInDesignStatus(
  ctx: RequestStatusContext,
): RequestStatus {
  return deriveStatus(IN_DESIGN_RULES, ctx, 'In Design')
}

// ---------------------------------------------------------------------------
// Intake status
// ---------------------------------------------------------------------------
//
// Called at create time. Determines whether the new record starts as New
// (anonymous) or Draft (signed-in).

export function deriveIntakeStatus(isAnonymous: boolean): RequestStatus {
  return isAnonymous ? 'New' : 'Draft'
}

// ---------------------------------------------------------------------------
// Workflow-action statuses
// ---------------------------------------------------------------------------
//
// These aren't derivations — they're the deterministic outcomes of
// explicit workflow actions. Exported as constants so callers don't
// have to remember the exact string codes.

export const STATUS_ASSIGNED_TO_WO: RequestStatus = 'Assigned to Work Order'
export const STATUS_CANCELED: RequestStatus = 'Canceled'
export const STATUS_CLOSED: RequestStatus = 'Closed'

// ---------------------------------------------------------------------------
// Helpers for UI gating
// ---------------------------------------------------------------------------

const TERMINAL: ReadonlySet<RequestStatus> = new Set(['Canceled', 'Closed'])
const ACTIVE: ReadonlySet<RequestStatus> = new Set([
  'New',
  'Draft',
  'Triaged',
  'In Design',
  'Ready for Work Order',
  'Assigned to Work Order',
])

/** True if the request is in a terminal status (no further transitions). */
export function isTerminal(status: RequestStatus): boolean {
  return TERMINAL.has(status)
}

/** True if the request is in an active (non-terminal) status. */
export function isActive(status: RequestStatus): boolean {
  return ACTIVE.has(status)
}

/** True if the request is past triage (Triaged or anything after). */
export function isPostTriage(status: RequestStatus): boolean {
  return (
    status === 'Triaged' ||
    status === 'In Design' ||
    status === 'Ready for Work Order' ||
    status === 'Assigned to Work Order' ||
    status === 'Closed'
    // Canceled deliberately excluded — a canceled request was never "completed triage"
    // in the workflow sense; it was killed.
  )
}