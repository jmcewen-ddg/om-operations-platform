/**
 * Role + visibility scoping for the OM Operations Platform.
 *
 * Role model spec: see FIELD_EDIT_MATRIX.md (Role Model section).
 *
 * Real role assignment will eventually come from ArcGIS Portal groups
 * (or a user-role table) via getCurrentUser(). Until then, the stub
 * returns a fully-scoped Super Admin so the app behaves normally
 * during development.
 *
 * IMPORTANT: visibility logic lives in domain/<entity>/<entity>Filters.ts.
 * This file only defines roles, scope shape, and the current-user lookup.
 * Permission logic lives in lib/permissions.ts.
 */

/**
 * The full role enumeration for OM Operations Platform.
 *
 * Internal (DDG):
 *   - superAdmin:      developer / database admin; full system + schema
 *   - programAdmin:    full record/assignment control; no schema
 *   - tier2Triager:    all Tier 1 powers + MI/CP assignment, Design flag,
 *                      urgency escalation, cancel/close
 *   - tier1Triager:    intake verification, Standard urgency, create requests,
 *                      advance status (no cancel/close)
 *   - fieldInspector:  CE&I — create inspections; read-only on requests/WOs
 *
 * External — credentialed:
 *   - designer:        placeholder; lifecycle TBD
 *   - contractor:      see WOs assigned to them + attached requests (read);
 *                      update contractor-progress portion of WO
 *   - fieldReporter:   submit requests with extended fields; credentialed
 *
 * External — anonymous:
 *   - public:          create-only via public intake form; no read access
 */
export type Role =
  | 'superAdmin'
  | 'programAdmin'
  | 'tier2Triager'
  | 'tier1Triager'
  | 'fieldInspector'
  | 'designer'
  | 'contractor'
  | 'fieldReporter'
  | 'public'

/**
 * Cumulative-rank order for "X and above" checks.
 * Higher number = more privilege.
 *
 * Internal roles only — external roles aren't on this ladder because
 * their permissions aren't a strict superset of anything below them
 * (e.g., a contractor isn't "more than" a triager, they're a different axis).
 */
export const INTERNAL_ROLE_RANK: Record<Role, number> = {
  superAdmin:     100,
  programAdmin:    90,
  tier2Triager:    50,
  tier1Triager:    40,
  fieldInspector:  20,
  // External roles get 0 — not on the internal ladder.
  designer:         0,
  contractor:       0,
  fieldReporter:    0,
  public:           0,
}

/** True if `role` is an internal DDG role (anything on the cumulative ladder). */
export function isInternal(role: Role): boolean {
  return INTERNAL_ROLE_RANK[role] > 0
}

/** True if `role` is at least `minimum` on the internal ladder. */
export function atLeast(role: Role, minimum: Role): boolean {
  return INTERNAL_ROLE_RANK[role] >= INTERNAL_ROLE_RANK[minimum]
}

export type CurrentUser = {
  username: string
  role: Role

  /**
   * Districts this user is allowed to see/edit.
   * - Internal roles: their district(s), or ['*'] for all (typical for
   *   programAdmin/superAdmin; triagers default to ['*'] today but the
   *   model supports scoping them later without a schema change).
   * - contractor: only districts where they're contracted.
   * - public / fieldReporter: not scoped (they only create).
   *
   * Empty array means "no district scope" → see nothing.
   * Use ['*'] to mean "see all districts".
   */
  districts: string[]

  /**
   * Contractor company IDs / WO ownership scope.
   * Used to silo contractor views to only WOs their company owns.
   * Undefined for non-contractor roles.
   */
  contractorScope?: string[]
}

/**
 * Returns the current logged-in user with their role + scope.
 *
 * STUB for now — returns a fully-scoped Super Admin so the app
 * works for everyone while role data isn't wired up yet.
 *
 * When real role data is available, replace the body of this function
 * (e.g. query a Portal group, look up a user-role table, etc.). All
 * call sites already use the returned shape — no other code changes.
 */
export async function getCurrentUser(): Promise<CurrentUser> {
  return {
    username: 'unknown',
    role: 'superAdmin',
    districts: ['*'],
  }
}

/**
 * Convenience: does this user have access to every district?
 * Use sparingly — prefer filtering through requestFilters helpers.
 */
export function hasAllDistrictAccess(user: CurrentUser): boolean {
  return user.districts.includes('*')
}