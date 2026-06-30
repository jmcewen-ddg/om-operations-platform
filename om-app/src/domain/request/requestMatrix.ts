/**
 * Field-edit matrix data for sde.om_request.
 *
 * This is the executable form of FIELD_EDIT_MATRIX.md. When the spec
 * doc changes, change this file too — and vice versa. The doc is the
 * human-readable spec; this is the machine-readable enforcement.
 *
 * Structure: field name → status → FieldRule
 *
 * Status keys must match the codes in the om_request_status domain.
 * Fields not listed here are treated as 'hidden' by the lookup
 * function (safe default — anything we forgot to spec is off-limits).
 *
 * To tweak a rule: edit the cell. No other code changes needed.
 * To add a new role: usually no edits here — add the role to the
 * Role type and INTERNAL_ROLE_RANK in lib/roles.ts. Only edit cells
 * here if the new role needs an explicit override on a specific cell.
 */

import type { FieldEditMatrix, FieldRule } from '../../lib/fieldEditMatrix'

/**
 * The status codes for om_request (from the om_request_status domain).
 * Kept local as a const so we get autocomplete + typo protection inside
 * this file without leaking the union into lib/.
 */
const STATUSES = [
  'New',
  'Draft',
  'Triaged',
  'In Design',
  'Ready for Work Order',
  'Assigned to Work Order',
  'Canceled',
  'Closed',
  // 'Needs Correction' is in the domain but unused — see open items.
] as const

/**
 * Helper: build a rule that's the same across many statuses.
 * Reduces repetition for the very common "auto everywhere" or
 * "R everywhere terminal" patterns.
 */
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

export const requestMatrix: FieldEditMatrix = {
  // --- Classification -------------------------------------------------------

  request_category: {
    ...sameAcross(['New', 'Draft', 'Triaged', 'In Design', 'Ready for Work Order'], {
      minRole: 'tier1Triager',
      default: 'R',
    }),
    'Assigned to Work Order': { minRole: 'tier2Triager', default: 'R' },
    ...sameAcross(TERMINAL_STATUSES, { default: 'R' }),
  },

  request_subcategory: {
    ...sameAcross(['New', 'Draft', 'Triaged', 'In Design', 'Ready for Work Order'], {
      minRole: 'tier1Triager',
      default: 'R',
    }),
    'Assigned to Work Order': { minRole: 'tier2Triager', default: 'R' },
    ...sameAcross(TERMINAL_STATUSES, { default: 'R' }),
  },

  // Title + description: T1+ refines after intake. Submitter also sets at
  // create — that's handled by the create form, not by an 'editField' check
  // (the create form bypasses status because there is no status yet).
  request_title: {
    ...sameAcross(['New', 'Draft', 'Triaged', 'In Design', 'Ready for Work Order'], {
      minRole: 'tier1Triager',
      default: 'R',
    }),
    'Assigned to Work Order': { minRole: 'tier2Triager', default: 'R' },
    ...sameAcross(TERMINAL_STATUSES, { default: 'R' }),
  },

// Original reporter submission — never editable in the app, never
// visible to the public role (it may contain PII or sensitive context
// the reporter didn't intend to publish). System-set at intake by S123.
request_description: sameAcross(ALL_STATUSES, {
  roleOverrides: { public: 'hidden' },
  default: 'R',
}),

  // --- Urgency --------------------------------------------------------------

  // Anonymous (New): T1+ can set anything. Default hidden = anonymous can't see it.
  // Signed-in (Draft): T2+ can modify; T1 can see but not modify; submitter locked.
  // After triage: T2+ can re-set (escalate/de-escalate); T1 read-only.
  urgency: {
    New: { minRole: 'tier1Triager', default: 'hidden' },
    Draft: {
      minRole: 'tier2Triager',
      roleOverrides: { tier1Triager: 'R' },
      default: 'hidden',
    },
    Triaged: {
      minRole: 'tier2Triager',
      roleOverrides: { tier1Triager: 'R' },
      default: 'R',
    },
    'In Design': {
      minRole: 'tier2Triager',
      roleOverrides: { tier1Triager: 'R' },
      default: 'R',
    },
    'Ready for Work Order': {
      minRole: 'tier2Triager',
      roleOverrides: { tier1Triager: 'R' },
      default: 'R',
    },
    'Assigned to Work Order': {
      minRole: 'tier2Triager',
      roleOverrides: { tier1Triager: 'R' },
      default: 'R',
    },
    ...sameAcross(TERMINAL_STATUSES, { default: 'R' }),
  },

// --- Reporter info (system-set at intake, never edited in app) -----------
  // Provided at point of entry (Survey123 / public form). Locked everywhere,
  // for everyone. BTS corrections happen at the SQL/Pro level, not in the app.

  reporter_name: AUTO_EVERYWHERE,
  reporter_email: AUTO_EVERYWHERE,
  reporter_phone: AUTO_EVERYWHERE,
  reporter_organization: AUTO_EVERYWHERE,
  reporter_type: AUTO_EVERYWHERE,

  // Intake metadata — what channel this came through. Set by the intake
  // form (Survey123, public form, etc.); never edited in the app.
  intake_channel: READ_ONLY_EVERYWHERE,

  // intake_type (Request / Cancellation domain). Visible R-only to all roles
  // — only BTS edits via SQL or Pro.
  intake_type: READ_ONLY_EVERYWHERE,

  // --- Location -------------------------------------------------------------

  // Shape: T1+ edits geometry directly via Maps SDK. T2+ can still edit after
  // triage. Locked at terminal statuses. EVERY shape-derived field below is
  // 'auto' because moving Shape causes them to recalculate (via S123 pulldata
  // today, SQL trigger eventually).
  Shape: {
    ...sameAcross(['New', 'Draft'], { minRole: 'tier1Triager', default: 'R' }),
    ...sameAcross(['Triaged', 'In Design', 'Ready for Work Order', 'Assigned to Work Order'], {
      minRole: 'tier2Triager',
      roleOverrides: { tier1Triager: 'R' },
      default: 'R',
    }),
    ...sameAcross(TERMINAL_STATUSES, { default: 'R' }),
  },

  // Shape-derived — never directly edited by humans in the app.
  original_latitude: AUTO_EVERYWHERE,
  original_longitude: AUTO_EVERYWHERE,
  corrected_latitude: AUTO_EVERYWHERE,
  corrected_longitude: AUTO_EVERYWHERE,
  location_corrected: AUTO_EVERYWHERE,

  // All of these are derived from Shape via spatial lookup at intake (S123
  // pulldata today) and will be recalculated by SQL trigger when Shape moves.
  district: AUTO_EVERYWHERE,
  parish: AUTO_EVERYWHERE,
  municipality: AUTO_EVERYWHERE,
  route_id: AUTO_EVERYWHERE,
  route_name: AUTO_EVERYWHERE,
  milepost: AUTO_EVERYWHERE,
  road_lrsid: AUTO_EVERYWHERE,
  bridge_recall: AUTO_EVERYWHERE,
  nbi_structure_number: AUTO_EVERYWHERE,

  // Free-text supplement — geometry can't capture "behind the white house
  // with the blue mailbox". Stays human-editable T1+.
  location_description: {
    ...sameAcross(['New', 'Draft', 'Triaged', 'In Design', 'Ready for Work Order', 'Assigned to Work Order'], {
      minRole: 'tier1Triager',
      default: 'R',
    }),
    ...sameAcross(TERMINAL_STATUSES, { default: 'R' }),
  },

  // --- Design ---------------------------------------------------------------

  // requires_design: hidden until triage, T2+ sets it at triage, locked after.
  requires_design: {
    ...sameAcross(['New', 'Draft'], { default: 'hidden' }),
    Triaged: { minRole: 'tier2Triager', default: 'R' },
    ...sameAcross(['In Design', 'Ready for Work Order', 'Assigned to Work Order'], {
      default: 'R',
    }),
    ...sameAcross(TERMINAL_STATUSES, { default: 'R' }),
  },

  // design_status: only relevant when requires_design = Yes. T2+ owns it for
  // now; will hand off to Designer Consultant role when that lifecycle is specced.
  design_status: {
    ...sameAcross(['New', 'Draft', 'Triaged'], { default: 'hidden' }),
    'In Design': { minRole: 'tier2Triager', default: 'R' },
    ...sameAcross(['Ready for Work Order', 'Assigned to Work Order'], {
      default: 'R',
    }),
    ...sameAcross(TERMINAL_STATUSES, { default: 'R' }),
  },

  // --- Program move (terminal close path) -----------------------------------
  // Hidden until move action. moveToProgram action gates the transition itself;
  // these fields become visible R-only after the move stamps them.

  maintenance_initiative_globalid: {
    ...sameAcross(ACTIVE_STATUSES, { default: 'hidden' }),
    Closed: { default: 'R' },
    Canceled: { default: 'hidden' },
  },

  capital_project_globalid: {
    ...sameAcross(ACTIVE_STATUSES, { default: 'hidden' }),
    Closed: { default: 'R' },
    Canceled: { default: 'hidden' },
  },

  closed_reason: {
    ...sameAcross(ACTIVE_STATUSES, { default: 'hidden' }),
    Closed: { default: 'R' },
    Canceled: { default: 'hidden' },
  },

  // --- Cancellation ---------------------------------------------------------

  cancellation_reason: {
    ...sameAcross(ACTIVE_STATUSES, { default: 'hidden' }),
    Canceled: { default: 'R' },
    Closed: { default: 'hidden' },
  },

  // --- Assignment (WO attach) -----------------------------------------------
  // request_assignment, assigned_work_order_id, assigned_work_order_globalid:
  // all driven by workflow actions, never directly edited in app.

  request_assignment: AUTO_EVERYWHERE,
  assigned_work_order_id: AUTO_EVERYWHERE,
  assigned_work_order_globalid: AUTO_EVERYWHERE,

  // Free-text context on the assignment — T1+ editable while a WO is attached.
  assignment_notes: {
    ...sameAcross(['New', 'Draft', 'Triaged', 'In Design', 'Ready for Work Order'], {
      default: 'hidden',
    }),
    'Assigned to Work Order': { minRole: 'tier1Triager', default: 'R' },
    ...sameAcross(TERMINAL_STATUSES, { default: 'R' }),
  },

  // --- Notes ----------------------------------------------------------------
// DEPRECATED — single-blob notes on the row. Replaced by the related
// om_request_note table (rendered by RequestNotesSection) which supports
// per-note type + visibility. Hidden everywhere in the app; fields remain
// in the schema for now in case legacy data needs to be inspected. Remove
// from schema after a deprecation window.
public_notes: sameAcross(ALL_STATUSES, { default: 'hidden' }),
internal_notes: sameAcross(ALL_STATUSES, { default: 'hidden' }),

  // --- Lifecycle dates (all auto-stamped by SQL trigger) --------------------

  submitted_date: AUTO_EVERYWHERE,
  triaged_date: AUTO_EVERYWHERE,
  assigned_date: AUTO_EVERYWHERE,
  canceled_date: AUTO_EVERYWHERE,
  closed_date: AUTO_EVERYWHERE,
  due_date: AUTO_EVERYWHERE,

  // --- Identity / sequence (all auto-stamped on insert) ---------------------

  request_id: AUTO_EVERYWHERE,
  request_sequence_year: AUTO_EVERYWHERE,
  request_sequence_number: AUTO_EVERYWHERE,

  // --- Hidden / deprecated / future fields ----------------------------------
  // Listed explicitly so a casual reader knows they're intentionally off.

  priority_score: sameAcross(ALL_STATUSES, { default: 'hidden' }),
  assigned_to_email: sameAcross(ALL_STATUSES, { default: 'hidden' }),
  assigned_to_name: sameAcross(ALL_STATUSES, { default: 'hidden' }),
  assigned_team: sameAcross(ALL_STATUSES, { default: 'hidden' }),

  // --- Soft delete (programAdmin+ only, via admin action — not editField) ---
  // These are surfaced R-only in detail views for audit; the actual flip is
  // through the softDelete action, not field editing.

  deleted: READ_ONLY_EVERYWHERE,
  deleted_date: AUTO_EVERYWHERE,
  deleted_by: AUTO_EVERYWHERE,

  // System-managed (always hidden from edit UI; editor tracking elsewhere).

  GlobalID: AUTO_EVERYWHERE,
  OBJECTID: AUTO_EVERYWHERE,
  created_user: AUTO_EVERYWHERE,
  created_date: AUTO_EVERYWHERE,
  last_edited_user: AUTO_EVERYWHERE,
  last_edited_date: AUTO_EVERYWHERE,
}