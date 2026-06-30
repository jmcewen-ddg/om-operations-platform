import { useEffect, useMemo, useState } from 'react'
import type { OmRequest } from '../services/requestService'
import { colors } from '../theme'
import { RequestRow } from './RequestRow'

/**
 * Tab list for the Unassigned Requests view. Order = request lifecycle
 * (left-to-right): pre-triage → triage → post-triage → ready to assign.
 *
 * Only 'Ready for Work Order' rows are selectable for WO assignment;
 * see RequestRow `selectable` prop. App.tsx hides the assign-action
 * buttons unless this tab is active (via onActiveTabChange).
 */
const TABS = [
  'New',
  'Draft',
  'Triaged',
  'Needs Correction',
  'In Design',
  'Ready for Work Order',
] as const

export type RequestStatusTab = (typeof TABS)[number]

/** Only rows in this status get checkboxes + count toward assignment. */
export const SELECTABLE_TAB: RequestStatusTab = 'Ready for Work Order'

type Props = {
  /** Unfiltered list of unassigned requests. Tabs subdivide by status. */
  requests: OmRequest[]
  selectedRequestIds: number[]
  onToggleSelect: (objectId: number) => void
  onOpenRequest: (request: OmRequest) => void
  /** Bubbles up the active tab so App.tsx can show/hide assign buttons. */
  onActiveTabChange?: (tab: RequestStatusTab) => void
}

export function RequestStatusTabs({
  requests,
  selectedRequestIds,
  onToggleSelect,
  onOpenRequest,
  onActiveTabChange,
}: Props) {
  // ---- Group requests by status ----------------------------------------
  // Memoized: only re-buckets when the source list changes. Each bucket
  // is also pre-sorted oldest-first (longest-waiting on top).
  const buckets = useMemo(() => {
    const byStatus = new Map<RequestStatusTab, OmRequest[]>()
    for (const tab of TABS) byStatus.set(tab, [])
    for (const req of requests) {
      const status = req.status as RequestStatusTab
      if (byStatus.has(status)) byStatus.get(status)!.push(req)
      // Requests with unknown status (shouldn't happen for unassigned)
      // are silently dropped from the tabs — they'd belong in a future
      // "All / Other" bucket if we ever need one.
    }
    for (const tab of TABS) {
      byStatus.get(tab)!.sort(
        (a, b) => (a.createdDate ?? 0) - (b.createdDate ?? 0),
      )
    }
    return byStatus
  }, [requests])

  // ---- Active tab state -----------------------------------------------
  // Initial active tab = first tab with items, falling back to first tab.
  const [activeTab, setActiveTab] = useState<RequestStatusTab>(() => {
    return TABS.find((t) => (buckets.get(t)?.length ?? 0) > 0) ?? TABS[0]
  })

  // Notify parent when active tab changes (so it can show/hide buttons).
  useEffect(() => {
    onActiveTabChange?.(activeTab)
  }, [activeTab, onActiveTabChange])

  const visibleRequests = buckets.get(activeTab) ?? []

  return (
    <div>
      {/* ===== Tab strip ===== */}
      <div
        role="tablist"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 2,
          borderBottom: `2px solid ${colors.lightGray}`,
          marginTop: '0.5rem',
        }}
      >
        {TABS.map((tab) => {
          const count = buckets.get(tab)?.length ?? 0
          const isActive = activeTab === tab
          const isEmpty = count === 0
          return (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '0.4rem 0.75rem',
                background: isActive ? colors.white : 'transparent',
                color: isEmpty && !isActive ? colors.darkGray : colors.darkestGray,
                border: `1px solid ${isActive ? colors.lightGray : 'transparent'}`,
                borderBottom: isActive
                  ? `2px solid ${colors.white}`
                  : '2px solid transparent',
                borderRadius: '4px 4px 0 0',
                marginBottom: -2,
                cursor: 'pointer',
                fontWeight: isActive ? 700 : 500,
                opacity: isEmpty && !isActive ? 0.6 : 1,
                fontSize: '0.9em',
              }}
            >
              {tab} ({count})
            </button>
          )
        })}
      </div>

      {/* ===== Active tab body ===== */}
      <div style={{ padding: '0.5rem 0' }}>
        {visibleRequests.length === 0 ? (
          <em style={{ color: colors.darkGray, fontSize: '0.9em' }}>
            No requests in this status.
          </em>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {visibleRequests.map((req) => (
              <RequestRow
                key={req.objectId}
                request={req}
                selectable={activeTab === SELECTABLE_TAB}
                isSelected={selectedRequestIds.includes(req.objectId)}
                onToggleSelect={onToggleSelect}
                onOpenRequest={onOpenRequest}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}