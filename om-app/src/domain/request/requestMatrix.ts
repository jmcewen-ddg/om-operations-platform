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

  request_description: {
    ...sameAcross(['New', 'Draft', 'Triaged', 'In Design', 'Ready for Work Order'], {
      minRole: 'tier1Triager',
      default: 'R',
    }),
    'Assigned to Work Order': { minRole: 'tier2Triager', default: 'R' },
    ...sameAcross(TERMINAL_STATUSES, { default: 'R' }),
  },

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

  // --- Requestor info (locked after create, all statuses) -------------------
  // Backdated intake by T1+ is handled by the create form, not editField.

  requestor_name: READ_ONLY_EVERYWHERE,
  requestor_email: READ_ONLY_EVERYWHERE,
  requestor_phone: READ_ONLY_EVERYWHERE,
  requestor_organization: READ_ONLY_EVERYWHERE,

  // --- Location -------------------------------------------------------------

  // Shape: T1+ edits geometry directly via Maps SDK. T2+ can still edit after
  // triage. Locked at terminal statuses.
  Shape: {
    ...sameAcross(['New', 'Draft'], { minRole: 'tier1Triager', default: 'R' }),
    ...sameAcross(['Triaged', 'In Design', 'Ready for Work Order', 'Assigned to Work Order'], {
      minRole: 'tier2Triager',
      roleOverrides: { tier1Triager: 'R' },
      default: 'R',
    }),
    ...sameAcross(TERMINAL_STATUSES, { default: 'R' }),
  },

  // Derived from Shape — never directly edited.
  original_latitude: AUTO_EVERYWHERE,
  original_longitude: AUTO_EVERYWHERE,
  corrected_latitude: AUTO_EVERYWHERE,
  corrected_longitude: AUTO_EVERYWHERE,
  location_corrected: AUTO_EVERYWHERE,

  location_description: {
    ...sameAcross(['New', 'Draft', 'Triaged', 'In Design', 'Ready for Work Order', 'Assigned to Work Order'], {
      minRole: 'tier1Triager',
      default: 'R',
    }),
    ...sameAcross(TERMINAL_STATUSES, { default: 'R' }),
  },

  route_name: {
    ...sameAcross(ACTIVE_STATUSES, { minRole: 'tier1Triager', default: 'R' }),
    ...sameAcross(TERMINAL_STATUSES, { default: 'R' }),
  },

  route_id: {
    ...sameAcross(ACTIVE_STATUSES, { minRole: 'tier1Triager', default: 'R' }),
    ...sameAcross(TERMINAL_STATUSES, { default: 'R' }),
  },

  milepost: {
    ...sameAcross(ACTIVE_STATUSES, { minRole: 'tier1Triager', default: 'R' }),
    ...sameAcross(TERMINAL_STATUSES, { default: 'R' }),
  },

  parish: {
    ...sameAcross(ACTIVE_STATUSES, { minRole: 'tier1Triager', default: 'R' }),
    ...sameAcross(TERMINAL_STATUSES, { default: 'R' }),
  },

  municipality: {
    ...sameAcross(ACTIVE_STATUSES, { minRole: 'tier1Triager', default: 'R' }),
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

  // public_notes: contractor sees R when request is on their WO. Visibility
  // to anonymous submitter is handled by the future status-check page, not here.
  public_notes: {
    ...sameAcross(['New', 'Draft', 'Triaged', 'In Design', 'Ready for Work Order'], {
      minRole: 'tier1Triager',
      default: 'R',
    }),
    'Assigned to Work Order': {
      minRole: 'tier1Triager',
      roleOverrides: { contractor: 'R' },
      default: 'R',
    },
    Canceled: { minRole: 'tier2Triager', default: 'R' },
    Closed: { minRole: 'tier2Triager', default: 'R' },
  },

  // internal_notes: never visible to contractor or public.
  internal_notes: {
    ...sameAcross(['New', 'Draft', 'Triaged', 'In Design', 'Ready for Work Order'], {
      minRole: 'tier1Triager',
      roleOverrides: { contractor: 'hidden', public: 'hidden' },
      default: 'R',
    }),
    'Assigned to Work Order': {
      minRole: 'tier1Triager',
      roleOverrides: { contractor: 'hidden', public: 'hidden' },
      default: 'R',
    },
    Canceled: {
      minRole: 'tier2Triager',
      roleOverrides: { contractor: 'hidden', public: 'hidden' },
      default: 'R',
    },
    Closed: {
      minRole: 'tier2Triager',
      roleOverrides: { contractor: 'hidden', public: 'hidden' },
      default: 'R',
    },
  },

  // --- Lifecycle dates (all auto-stamped by SQL trigger) --------------------

  triaged_date: AUTO_EVERYWHERE,
  assigned_date: AUTO_EVERYWHERE,
  canceled_date: AUTO_EVERYWHERE,
  closed_date: AUTO_EVERYWHERE,

  // --- Identity / sequence (all auto-stamped on insert) ---------------------

  request_id: AUTO_EVERYWHERE,
  request_sequence_year: AUTO_EVERYWHERE,
  request_sequence_number: AUTO_EVERYWHERE,

  // --- Source / submission (locked after create) ----------------------------

  source: READ_ONLY_EVERYWHERE,
  submission_type: READ_ONLY_EVERYWHERE,

  // --- Soft delete (programAdmin+ only, via admin action — not editField) ---
  // These are surfaced R-only in detail views for audit; the actual flip is
  // through the softDelete action, not field editing.

  deleted: READ_ONLY_EVERYWHERE,
  deleted_date: AUTO_EVERYWHERE,
  deleted_by: AUTO_EVERYWHERE,

  // --- Hidden / deprecated fields -------------------------------------------
  // Listed here explicitly so a casual reader can see they're intentionally
  // hidden, not just forgotten. Lookup falls through to 'hidden' for any
  // unlisted field anyway, but this is documentation-by-code.

  district: sameAcross(ALL_STATUSES, { default: 'hidden' }),
  priority_score: sameAcross(ALL_STATUSES, { default: 'hidden' }),
  assigned_to_email: sameAcross(ALL_STATUSES, { default: 'hidden' }),
  assigned_to_name: sameAcross(ALL_STATUSES, { default: 'hidden' }),
  assigned_team: sameAcross(ALL_STATUSES, { default: 'hidden' }),
  due_date: sameAcross(ALL_STATUSES, { default: 'hidden' }),
  submitted_date: sameAcross(ALL_STATUSES, { default: 'hidden' }),
  intake_type: sameAcross(ALL_STATUSES, { default: 'hidden' }),

  // System-managed (always hidden from edit UI; editor tracking elsewhere).

  GlobalID: AUTO_EVERYWHERE,
  OBJECTID: AUTO_EVERYWHERE,
  created_user: AUTO_EVERYWHERE,
  created_date: AUTO_EVERYWHERE,
  last_edited_user: AUTO_EVERYWHERE,
  last_edited_date: AUTO_EVERYWHERE,
}