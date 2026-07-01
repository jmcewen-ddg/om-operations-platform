// Pure logic for computing the max urgency across a set of requests.
// Used server-side by recomputeWorkOrderUrgency() and could be used
// client-side for live-derived displays.
//
// Urgency ranking (high → low):
//   Immediate  (3)  → most urgent
//   Emergency  (2)
//   Standard   (1)  → least urgent
//   anything else → 0 (unranked / unknown)
//
// When the input list is empty, returns null — meaning "no urgency
// applies because no requests are attached." The caller decides how
// to render that (e.g., "No Requests Assigned" fallback).

import type { OmRequest } from '../../services/requestService'

export type Urgency = 'Immediate' | 'Emergency' | 'Standard'

export const URGENCY_RANK: Record<string, number> = {
  Immediate: 3,
  Emergency: 2,
  Standard: 1,
}

export function computeMaxUrgency(requests: OmRequest[]): Urgency | null {
  if (requests.length === 0) return null

  let bestRank = 0
  let bestUrgency: Urgency | null = null

  for (const r of requests) {
    const rank = URGENCY_RANK[r.urgency ?? ''] ?? 0
    if (rank > bestRank) {
      bestRank = rank
      bestUrgency = r.urgency as Urgency
    }
  }

  return bestUrgency
}