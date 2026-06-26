/**
 * Permission checks for the OM Operations Platform.
 *
 * One `can()` function per spec. Reads from:
 *   - The internal-role rank ladder (lib/roles.ts) for action-based checks
 *   - The field-edit matrix (lib/fieldEditMatrix.ts) for field-level checks
 *
 * Action-based checks (cancel, moveToProgram, completeTriage, etc.) are
 * gated by minimum role rank. Field-level checks (editField) delegate to
 * the matrix lookup.
 *
 * To add a new action: extend the Action type + add a case in `can()`.
 * To tweak who can do an action: change the minimum role in the case.
 * To tweak field-level rules: edit the domain matrix data, not this file.
 */

import { atLeast, type CurrentUser, type Role } from './roles'
import { canEditField, type FieldEditMatrix } from './fieldEditMatrix'

/** What the user is trying to do. */
export type Action =
  | 'view'                    // see the resource at all
  | 'create'                  // create a new resource
  | 'editField'               // edit a specific field (requires `field` arg)
  | 'completeTriage'          // request-only: T1+ runs the triage-complete derivation
  | 'assignToWorkOrder'       // request-only: attach request to a WO
  | 'unassignFromWorkOrder'   // request-only: detach from WO
  | 'moveToProgram'           // request-only: move to MI/CP (closes with reason)
  | 'cancel'                  // request-only: cancel with reason
  | 'submitToContractor'      // WO-only: flip status, trigger PA notification
  | 'softDelete'              // admin: soft-delete the resource

export type ResourceType = 'request' | 'workOrder'

export type CanContext = {
  /** Required for `editField`. The field being checked. */
  field?: string
  /** Required for any status-aware check. The resource's current status. */
  status?: string
  /**
   * Required for `editField`. The matrix to consult. Domain modules pass
   * their own matrix in (requestMatrix, workOrderMatrix).
   */
  matrix?: FieldEditMatrix
}

/**
 * Minimum role required for each action, per resource.
 *
 * `null` means the action is not applicable to that resource (e.g.,
 * 'completeTriage' on a workOrder).
 *
 * External roles are handled as overrides below, not on this ladder.
 */
const MIN_ROLE_FOR_ACTION: Record<
  ResourceType,
  Partial<Record<Action, Role | null>>
> = {
  request: {
    view:                    'fieldInspector',  // anyone internal can view
    create:                  'tier1Triager',
    completeTriage:          'tier1Triager',
    assignToWorkOrder:       'tier1Triager',
    unassignFromWorkOrder:   'tier1Triager',
    moveToProgram:           'tier2Triager',
    cancel:                  'tier2Triager',
    softDelete:              'programAdmin',
  },
  workOrder: {
    view:                    'fieldInspector',
    create:                  'tier1Triager',
    submitToContractor:      'tier1Triager',     // tweak if needed
    softDelete:              'programAdmin',
    completeTriage:          null,               // not a WO concept
    assignToWorkOrder:       null,
    unassignFromWorkOrder:   null,
    moveToProgram:           null,
    cancel:                  'tier2Triager',
  },
}

/**
 * Can this user perform this action on this resource type?
 *
 * Field-level checks (`action === 'editField'`) delegate to the matrix.
 * All other actions are gated by the MIN_ROLE_FOR_ACTION table.
 *
 * External roles (contractor, public, fieldReporter, designer) are not
 * on the internal rank ladder, so they fail every internal action check
 * unless explicitly overridden here.
 */
export function can(
  user: CurrentUser,
  action: Action,
  resource: ResourceType,
  ctx: CanContext = {},
): boolean {
  // --- External role special cases (handle before the generic ladder) ---
  if (user.role === 'public') {
    // Public can only create requests (via the anonymous intake form).
    return action === 'create' && resource === 'request'
  }

  if (user.role === 'fieldReporter') {
    // Field reporter can only create requests (with extended fields).
    return action === 'create' && resource === 'request'
  }

  if (user.role === 'contractor') {
    // Contractor can view requests (R-only, on their WO) and view+edit
    // assigned WOs (limited to progress-update fields). Field-level
    // detail is enforced by the matrix.
    if (action === 'view') return true
    if (action === 'editField' && resource === 'workOrder') {
      // Defer to matrix for which fields they can actually touch.
      return checkEditField(user.role, ctx)
    }
    return false
  }

  if (user.role === 'fieldInspector') {
    // CE&I: read-only on requests and WOs. Inspections are handled
    // separately (not via this permission function for now).
    return action === 'view'
  }

  if (user.role === 'designer') {
    // Placeholder — lifecycle TBD. For now, view-only on requests.
    return action === 'view' && resource === 'request'
  }

  // --- Internal roles: use the rank ladder ---

  // editField always defers to the matrix.
  if (action === 'editField') {
    return checkEditField(user.role, ctx)
  }

  const minRole = MIN_ROLE_FOR_ACTION[resource][action]
  if (minRole === null || minRole === undefined) return false

  return atLeast(user.role, minRole)
}

/**
 * Does this user have edit access to *any* field at the given status?
 *
 * Walks the matrix once. Returns true on the first field that grants
 * write access (RW or create). Useful for gating "Edit" / "Open form"
 * entry points where we don't yet know which field the user will edit.
 *
 * This is the matrix-driven equivalent of an `isInternal && !isTerminal`
 * heuristic — except it stays correct as the matrix evolves. If you
 * add a new role with edit rights at a "terminal" status, or remove
 * edit rights from a previously-editable status, this function adjusts
 * automatically with no code changes here.
 */
export function canEditAnyField(
  user: CurrentUser,
  resource: ResourceType,
  matrix: FieldEditMatrix,
  status: string,
): boolean {
  for (const field of Object.keys(matrix)) {
    if (can(user, 'editField', resource, { field, status, matrix })) {
      return true
    }
  }
  return false
}

/**
 * Helper: delegate a field-edit check to the supplied matrix.
 * Returns false if required ctx is missing (defensive — better to deny
 * than to fall through to a permissive default).
 */
function checkEditField(role: Role, ctx: CanContext): boolean {
  if (!ctx.matrix || !ctx.field || !ctx.status) return false
  return canEditField(ctx.matrix, ctx.field, ctx.status, role)
}