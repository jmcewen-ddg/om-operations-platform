/**
 * Lifecycle rules for request_status at the TRIAGE step.
 *
 * Triage can move a request along this short path:
 *    Draft / Submitted  →  Triaged  →  Ready for Assignment
 *
 * Triage may ALSO skip "Triaged" and go straight to "Ready for Assignment".
 *
 * Statuses past "Ready for Assignment" (Assigned, In Progress, Closed,
 * Canceled, etc.) are driven by OTHER workflows — assignment to a work
 * order, cancellation flow, closeout — not the triage panel.
 */

const TRIAGE_TRANSITIONS: Record<string, string[]> = {
  Draft:     ['Triaged', 'Ready for Assignment'],
  Submitted: ['Triaged', 'Ready for Assignment'],
  Triaged:   ['Ready for Assignment'],
}

/**
 * Return the list of statuses the triage panel will offer as choices,
 * given the request's current status. ALWAYS includes the current status
 * itself so the dropdown can render the existing value without forcing
 * a change.
 */
export function getAllowedTriageTransitions(currentStatus: string | null): string[] {
  if (!currentStatus) return ['Draft', 'Submitted', 'Triaged', 'Ready for Assignment']
  const next = TRIAGE_TRANSITIONS[currentStatus] ?? []
  // Include the current status so the &lt;select&gt; can show it as the active option
  return Array.from(new Set([currentStatus, ...next]))
}

/** True if the triager is allowed to change status at all from `currentStatus`. */
export function canTriageEditStatus(currentStatus: string | null): boolean {
  if (!currentStatus) return true
  return (TRIAGE_TRANSITIONS[currentStatus]?.length ?? 0) > 0
}
// ============================================================
// Complete Triage helpers
// ============================================================

import type { RequestStatus } from '../domain/request/requestStatus'

/**
 * Statuses from which a triager can run "Complete Triage".
 * Currently only Draft (internal submitter) and New (public intake).
 */
const TRIAGE_ELIGIBLE_STATUSES = new Set<string>(['Draft', 'New'])

/**
 * True if the request's current status is eligible for triage completion.
 * Used by RequestDetailPanel to gate the Complete Triage button (in addition
 * to the role check).
 */
export function canCompleteTriage(currentStatus: string | null): boolean {
  if (!currentStatus) return false
  return TRIAGE_ELIGIBLE_STATUSES.has(currentStatus)
}

/**
 * Given the triager's answer to "Requires Design?" (Yes/No), return the
 * status the request should land in after triage completes.
 *
 * - Yes → "In Design"
 * - No  → "Ready for Work Order"
 *
 * NOTE: This is the "Option A" implementation — single write, the request
 * never physically sits in "Triaged" status. If we want a real pass-through
 * later (so SDE archive shows a Triaged row), do it either by making
 * completeTriage() do two sequential writes, or via a SQL trigger that
 * inserts a synthetic Triaged row when it detects a Draft|New → In Design
 * | Ready for Work Order jump.
 */
export function derivePostTriageStatus(requiresDesign: 'Yes' | 'No'): RequestStatus {
  return requiresDesign === 'Yes' ? 'In Design' : 'Ready for Work Order'
}