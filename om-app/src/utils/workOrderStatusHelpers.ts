/**
 * Lifecycle rules for work_order_status.
 *
 * The full WO status domain (from the feature service):
 *   Draft, Open, Assigned, Scheduled, In Progress, On Hold,
 *   Completed, Canceled, Closed
 *
 *
 *   Draft ──► Open ──► Assigned ──► Scheduled ──► In Progress ──► Completed ──► Closed
 *                │         │             │             │              ▲
 *                │         │             │             │              │
 *                └─────────┴─────────────┴───► On Hold ◄──────────────┘
 *
 *   Canceled can come from any non-terminal state.
 *   Closed and Canceled are TERMINAL — no transitions out.
 *
 * Notes:
 *  - `On Hold` can fall back to any active state, so users can resume
 *     work that was paused for any reason.
 *  - This is just the UI guardrail. The SQL side can enforce stricter
 *     rules later if we want server-side validation.
 */

const WO_TRANSITIONS: Record<string, string[]> = {
  Draft:         ['Open', 'Canceled'],
  Open:          ['Assigned', 'On Hold', 'Canceled'],
  Assigned:      ['Scheduled', 'In Progress', 'On Hold', 'Canceled'],
  Scheduled:     ['In Progress', 'On Hold', 'Canceled'],
  'In Progress': ['On Hold', 'Completed', 'Canceled'],
  'On Hold':     ['Open', 'Assigned', 'Scheduled', 'In Progress', 'Canceled'],
  Completed:     ['Closed'],
  // Canceled and Closed are terminal — no transitions out
}

/**
 * Return the list of statuses the WO panel will offer as choices,
 * given the current saved status. ALWAYS includes the current status
 * itself so the dropdown can render the existing value without forcing
 * a change.
 */
export function getAllowedWorkOrderTransitions(currentStatus: string | null): string[] {
  if (!currentStatus) {
    return [
      'Draft', 'Open', 'Assigned', 'Scheduled', 'In Progress',
      'On Hold', 'Completed', 'Canceled', 'Closed',
    ]
  }
  const next = WO_TRANSITIONS[currentStatus] ?? []
  return Array.from(new Set([currentStatus, ...next]))
}

/** True if the user is allowed to change status at all from `currentStatus`. */
export function canEditWorkOrderStatus(currentStatus: string | null): boolean {
  if (!currentStatus) return true
  return (WO_TRANSITIONS[currentStatus]?.length ?? 0) > 0
}