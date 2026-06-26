import type { OmRequest } from '../../services/requestService'
import { hasAllDistrictAccess, type CurrentUser } from '../../lib/roles'

/**
 * Two distinct concepts, deliberately kept apart:
 *
 *   VISIBILITY (security)   = what the user is ALLOWED to see, based on role/scope.
 *                             Applied first. Never bypassable from the UI.
 *
 *   FILTER (UX)             = what the user CHOSE to see, via UI controls.
 *                             Applied second. Safe to clear/reset.
 *
 * Anywhere we render requests, we should run them through
 * applyAllRequestFilters() so we can never accidentally leak
 * a request that the user shouldn't see.
 */

export type RequestFilter = {
  /** Restrict to these districts. Empty/undefined = no filter on district. */
  districts?: string[]

  /** Restrict to these urgencies. Empty/undefined = no filter. */
  urgencies?: string[]

  /** Restrict to these assignment statuses. Empty/undefined = no filter. */
  assignmentStatuses?: string[]

  /** Free-text search across request_id / title. Empty = no filter. */
  search?: string
}

/**
 * VISIBILITY: drop any requests the current user is not allowed to see.
 *
 * Today's rules:
 *  - dev/admin with district '*' → see everything
 *  - internal/contractor → see only requests whose district is in their list
 *  - contractorScope is not yet enforced (placeholder for later)
 */
export function filterRequestsByVisibility(
  requests: OmRequest[],
  user: CurrentUser,
): OmRequest[] {
  if (hasAllDistrictAccess(user)) return requests

  const allowed = new Set(user.districts)
  return requests.filter((r) => r.district != null && allowed.has(r.district))
}

/**
 * FILTER: apply the user's chosen UI filters.
 * All criteria are AND'd. Empty/undefined criteria are skipped.
 */
export function filterRequests(
  requests: OmRequest[],
  filter: RequestFilter,
): OmRequest[] {
  const districts = filter.districts && filter.districts.length > 0
    ? new Set(filter.districts)
    : null

  const urgencies = filter.urgencies && filter.urgencies.length > 0
    ? new Set(filter.urgencies)
    : null

  const assignmentStatuses =
    filter.assignmentStatuses && filter.assignmentStatuses.length > 0
      ? new Set(filter.assignmentStatuses)
      : null

  const searchLower = filter.search?.trim().toLowerCase() ?? ''

  return requests.filter((r) => {
    if (districts && (r.district == null || !districts.has(r.district))) return false
    if (urgencies && (r.urgency == null || !urgencies.has(r.urgency))) return false
    if (
      assignmentStatuses &&
      (r.assignmentStatus == null || !assignmentStatuses.has(r.assignmentStatus))
    ) {
      return false
    }
    if (searchLower) {
      const idMatch = r.requestId?.toLowerCase().includes(searchLower) ?? false
      const titleMatch = r.requestTitle?.toLowerCase().includes(searchLower) ?? false
      if (!idMatch && !titleMatch) return false
    }
    return true
  })
}

/**
 * Convenience composite: visibility first, then UI filter.
 * Always prefer this in view code so the order is never wrong.
 */
export function applyAllRequestFilters(
  requests: OmRequest[],
  user: CurrentUser,
  filter: RequestFilter,
): OmRequest[] {
  const visible = filterRequestsByVisibility(requests, user)
  return filterRequests(visible, filter)
}