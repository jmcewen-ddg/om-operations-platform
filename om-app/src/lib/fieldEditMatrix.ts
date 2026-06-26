/**
 * Generic field-edit matrix machinery.
 *
 * Knows nothing about Request or WorkOrder specifically. Domain modules
 * (domain/request/requestMatrix.ts, domain/workOrder/workOrderMatrix.ts)
 * supply the data; this module supplies the lookup function.
 *
 * The matrix structure mirrors FIELD_EDIT_MATRIX.md: for each field,
 * for each status, what access level does each role have?
 */

import { atLeast, type Role } from './roles'

/**
 * What kind of access a role has to a field in a given status.
 *
 *   RW      Read + write
 *   R       Read-only (visible, not editable)
 *   auto    System-managed; no human edits in app (trigger or workflow stamps it)
 *   hidden  Not surfaced in UI at all for this role
 *   create  Editable only at intake/create, never after
 */
export type AccessLevel = 'RW' | 'R' | 'auto' | 'hidden' | 'create'

/**
 * Rule for a single (field, status) cell.
 *
 *   minRole         Minimum internal role required for RW access. Roles at or
 *                   above this rank get RW. Roles below get `default` (or their
 *                   `roleOverrides` entry, if present).
 *   roleOverrides   Explicit access level for specific roles. Wins over minRole
 *                   and default. Use for external roles (contractor, public)
 *                   and for "X can see but not edit" cases (e.g. tier1Triager: 'R'
 *                   when minRole is 'tier2Triager').
 *   default         Access level for any role not covered by minRole or
 *                   roleOverrides. Typically 'hidden' or 'R'.
 */
export type FieldRule = {
  minRole?: Role
  roleOverrides?: Partial<Record<Role, AccessLevel>>
  default: AccessLevel
}

/**
 * Matrix shape: field name → status → rule.
 *
 * Status is a string here (not a union) because Request and WorkOrder have
 * different status domains. Domain modules will type-narrow when they
 * construct their matrix.
 */
export type FieldEditMatrix = {
  [field: string]: {
    [status: string]: FieldRule
  }
}

/**
 * Look up the access level for one (field, status, role) triple.
 *
 * Resolution order:
 *   1. roleOverrides[role]   — explicit win
 *   2. minRole               — if role meets the rank, return 'RW'
 *   3. default               — fallback
 *
 * If the field or status isn't in the matrix, returns 'hidden'. This is the
 * safe default: anything we forgot to spec is off-limits until specced.
 */
export function getAccessLevel(
  matrix: FieldEditMatrix,
  field: string,
  status: string,
  role: Role,
): AccessLevel {
  const rule = matrix[field]?.[status]
  if (!rule) return 'hidden'

  // 1. Explicit role override wins.
  const override = rule.roleOverrides?.[role]
  if (override) return override

  // 2. Min-role check (only meaningful for internal roles on the rank ladder).
  if (rule.minRole && atLeast(role, rule.minRole)) return 'RW'

  // 3. Fall through to default.
  return rule.default
}

/**
 * Convenience: does this role have any kind of edit access to this field?
 * Returns true for 'RW' and 'create' (the two write modes).
 */
export function canEditField(
  matrix: FieldEditMatrix,
  field: string,
  status: string,
  role: Role,
): boolean {
  const level = getAccessLevel(matrix, field, status, role)
  return level === 'RW' || level === 'create'
}

/**
 * Convenience: is this field surfaced to this role at all?
 * Returns false only for 'hidden' — read-only fields are still surfaced.
 */
export function isFieldVisible(
  matrix: FieldEditMatrix,
  field: string,
  status: string,
  role: Role,
): boolean {
  return getAccessLevel(matrix, field, status, role) !== 'hidden'
}