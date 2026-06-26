/**
 * Role + visibility scoping for the OM Operations Platform.
 *
 * For now we only model the roles we'll actually use in the near term.
 * Real role assignment will eventually come from ArcGIS Portal groups
 * (or a user-role table) via getCurrentUser(). Until then, the stub
 * returns a fully-scoped internal user so the app behaves normally.
 *
 * IMPORTANT: visibility logic lives in utils/requestFilters.ts. This
 * file only defines roles, scope shape, and the current-user lookup.
 */

export type Role = 'internal' | 'admin' | 'dev' | 'contractor'

export type CurrentUser = {
  username: string
  role: Role

  /**
   * Districts this user is allowed to see/edit.
   * - internal: their district(s)
   * - admin:    all districts (read-everywhere, edit-where-allowed)
   * - dev:      all districts, full access
   * - contractor: only districts where they're contracted (future)
   *
   * Empty array means "no district scope" → see nothing.
   * Use ['*'] to mean "see all districts" (admin/dev shortcut).
   */
  districts: string[]

  /**
   * Future: contractor company IDs / WO ownership scope.
   * Unused for now — wired so contractor logic can be added later
   * without touching the call sites.
   */
  contractorScope?: string[]
}

/**
 * Returns the current logged-in user with their role + scope.
 *
 * STUB for now — returns a fully-scoped internal user so the app
 * works for everyone while role data isn't wired up yet.
 *
 * When real role data is available, replace the body of this function
 * (e.g. query a Portal group, look up a user-role table, etc.). All
 * call sites already use the returned shape — no other code changes.
 */
export async function getCurrentUser(): Promise<CurrentUser> {
  return {
    username: 'unknown',
    role: 'internal',
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