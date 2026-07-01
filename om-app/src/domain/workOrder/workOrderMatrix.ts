/**
 * Field-edit matrix data for sde.om_workorder.
 *
 * This is the executable form of FIELD_EDIT_MATRIX.md (WO section).
 * Mirror of src/domain/request/requestMatrix.ts — same conventions.
 *
 * Status keys must match the codes in the om_workorder_status domain.
 * Fields not listed here are treated as 'hidden' by the lookup function.
 *
 * To tweak a rule: edit the cell. No other code changes needed.
 * To add a new role: edit src/lib/roles.ts — only edit cells here if
 * the new role needs an explicit override on a specific cell.
 */

import type { FieldEditMatrix, FieldRule } from '../../lib/fieldEditMatrix'

/**
 * The status codes for om_workorder (from the om_workorder_status domain).
 */
const STATUSES = [
  'Draft',
  'Open',
  'Assigned',
  'Scheduled',
  'In Progress',
  'On Hold',
  'Completed',
  'Canceled',
  'Closed',
] as const

function sameAcross(
  statuses: readonly string[],
  rule: FieldRule,
): Record<string, FieldRule> {
  return Object.fromEntries(statuses.map((s) => [s, rule]))
}

const ALL_STATUSES = STATUSES
const ACTIVE_STATUSES = STATUSES.filter(
  (s) => s !== 'Canceled' && s !== 'Closed',
)
const TERMINAL_STATUSES = ['Canceled', 'Closed'] as const

// Pre-completion = states before work is finished. Schedule + Assignment
// fields are editable here; locked once the WO completes/closes/cancels.
const PRE_COMPLETION = [
  'Draft', 'Open', 'Assigned', 'Scheduled', 'In Progress', 'On Hold',
] as const

const AUTO_EVERYWHERE: Record<string, FieldRule> = sameAcross(ALL_STATUSES, {
  default: 'auto',
})

const READ_ONLY_EVERYWHERE: Record<string, FieldRule> = sameAcross(
  ALL_STATUSES,
  { default: 'R' },
)

// ============================================================================
// THE MATRIX
// ============================================================================

export const workOrderMatrix: FieldEditMatrix = {
  // --- Classification -------------------------------------------------------
  // T2+ edits across all pre-completion. Read-only once Completed/terminal.

  work_order_title: {
    ...sameAcross(PRE_COMPLETION, {
      minRole: 'tier2Triager',
      roleOverrides: { tier1Triager: 'R' },
      default: 'R',
    }),
    Completed: { default: 'R' },
    ...sameAcross(TERMINAL_STATUSES, { default: 'R' }),
  },

  work_order_type: {
    ...sameAcross(PRE_COMPLETION, {
      minRole: 'tier2Triager',
      roleOverrides: { tier1Triager: 'R' },
      default: 'R',
    }),
    Completed: { default: 'R' },
    ...sameAcross(TERMINAL_STATUSES, { default: 'R' }),
  },

  scope_of_work: {
    ...sameAcross(PRE_COMPLETION, {
      minRole: 'tier2Triager',
      roleOverrides: { tier1Triager: 'R' },
      default: 'R',
    }),
    Completed: { default: 'R' },
    ...sameAcross(TERMINAL_STATUSES, { default: 'R' }),
  },

  // --- Status ---------------------------------------------------------------
  // T2+ owns status transitions. The WO transitions util already gates WHICH
  // statuses are valid — this gate is just WHO can change it at all.

  work_order_status: {
    ...sameAcross(PRE_COMPLETION, {
      minRole: 'tier2Triager',
      roleOverrides: { tier1Triager: 'R' },
      default: 'R',
    }),
    Completed: { minRole: 'tier2Triager', default: 'R' }, // → Closed transition
    ...sameAcross(TERMINAL_STATUSES, { default: 'R' }),
  },

  // --- Urgency --------------------------------------------------------------
  // Derived in SQL from attached requests — always R, never directly edited.
  urgency: READ_ONLY_EVERYWHERE,

  // --- District -------------------------------------------------------------
  // Set at WO create from the source request; never edited here.
  district: AUTO_EVERYWHERE,

  // --- Assignment -----------------------------------------------------------
  // T2+ owns assignment; T1 can read. Locked after completion.

  assigned_to_name: {
    ...sameAcross(PRE_COMPLETION, {
      minRole: 'tier2Triager',
      roleOverrides: { tier1Triager: 'R' },
      default: 'R',
    }),
    Completed: { default: 'R' },
    ...sameAcross(TERMINAL_STATUSES, { default: 'R' }),
  },

  assigned_to_email: {
    ...sameAcross(PRE_COMPLETION, {
      minRole: 'tier2Triager',
      roleOverrides: { tier1Triager: 'R' },
      default: 'R',
    }),
    Completed: { default: 'R' },
    ...sameAcross(TERMINAL_STATUSES, { default: 'R' }),
  },

  assigned_team: {
    ...sameAcross(PRE_COMPLETION, {
      minRole: 'tier2Triager',
      roleOverrides: { tier1Triager: 'R' },
      default: 'R',
    }),
    Completed: { default: 'R' },
    ...sameAcross(TERMINAL_STATUSES, { default: 'R' }),
  },

  // --- Schedule (intentions) ------------------------------------------------
  // T2+ sets scheduled dates pre-completion. Locked after.

  scheduled_start_date: {
    ...sameAcross(PRE_COMPLETION, {
      minRole: 'tier2Triager',
      roleOverrides: { tier1Triager: 'R' },
      default: 'R',
    }),
    Completed: { default: 'R' },
    ...sameAcross(TERMINAL_STATUSES, { default: 'R' }),
  },

  scheduled_end_date: {
    ...sameAcross(PRE_COMPLETION, {
      minRole: 'tier2Triager',
      roleOverrides: { tier1Triager: 'R' },
      default: 'R',
    }),
    Completed: { default: 'R' },
    ...sameAcross(TERMINAL_STATUSES, { default: 'R' }),
  },

  // --- Schedule (actuals, auto-stamped) -------------------------------------
  // Stamped by the panel's STATUS_DATE_STAMPS logic today, SQL trigger later.
  actual_start_date: AUTO_EVERYWHERE,
  actual_end_date:   AUTO_EVERYWHERE,
  completed_date:    AUTO_EVERYWHERE,
  closed_date:       AUTO_EVERYWHERE,
  canceled_date:     AUTO_EVERYWHERE,

  // --- Effort / Cost --------------------------------------------------------
  // T2+ owns; T1 read; locked after completion.

  estimated_hours: {
    ...sameAcross(PRE_COMPLETION, {
      minRole: 'tier2Triager',
      roleOverrides: { tier1Triager: 'R' },
      default: 'R',
    }),
    Completed: { default: 'R' },
    ...sameAcross(TERMINAL_STATUSES, { default: 'R' }),
  },

  actual_hours: {
    ...sameAcross(PRE_COMPLETION, {
      minRole: 'tier2Triager',
      roleOverrides: { tier1Triager: 'R' },
      default: 'R',
    }),
    Completed: { default: 'R' },
    ...sameAcross(TERMINAL_STATUSES, { default: 'R' }),
  },

  estimated_cost: {
    ...sameAcross(PRE_COMPLETION, {
      minRole: 'tier2Triager',
      roleOverrides: { tier1Triager: 'R' },
      default: 'R',
    }),
    Completed: { default: 'R' },
    ...sameAcross(TERMINAL_STATUSES, { default: 'R' }),
  },

  actual_cost: {
    ...sameAcross(PRE_COMPLETION, {
      minRole: 'tier2Triager',
      roleOverrides: { tier1Triager: 'R' },
      default: 'R',
    }),
    Completed: { default: 'R' },
    ...sameAcross(TERMINAL_STATUSES, { default: 'R' }),
  },

  // --- Completion Notes -----------------------------------------------------
  // Hidden until the work actually starts. T1+ can document as work
  // progresses (field staff documenting). Locked after Closed/Canceled.

  completion_notes: {
    ...sameAcross(['Draft', 'Open', 'Assigned', 'Scheduled'], { default: 'hidden' }),
    'In Progress': { minRole: 'tier1Triager', default: 'R' },
    'On Hold':     { minRole: 'tier1Triager', default: 'R' },
    Completed:     { minRole: 'tier2Triager', default: 'R' },
    ...sameAcross(TERMINAL_STATUSES, { default: 'R' }),
  },

  // --- Cancellation ---------------------------------------------------------
  // Hidden until canceled; R-only after. Mirrors request side.

  cancellation_reason: {
    ...sameAcross(ACTIVE_STATUSES, { default: 'hidden' }),
    Canceled: { default: 'R' },
    Closed:   { default: 'hidden' },
  },

  // --- Identity (auto-stamped on insert) -----------------------------------
  work_order_id: AUTO_EVERYWHERE,

  // --- Soft delete (programAdmin+ only, via admin action) -------------------
  deleted:      READ_ONLY_EVERYWHERE,
  deleted_date: AUTO_EVERYWHERE,
  deleted_by:   AUTO_EVERYWHERE,

  // --- System-managed -------------------------------------------------------
  GlobalID:         AUTO_EVERYWHERE,
  OBJECTID:         AUTO_EVERYWHERE,
  created_user:     AUTO_EVERYWHERE,
  created_date:     AUTO_EVERYWHERE,
  last_edited_user: AUTO_EVERYWHERE,
  last_edited_date: AUTO_EVERYWHERE,
}