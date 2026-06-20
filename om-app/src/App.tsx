import { useEffect, useState } from 'react'
import {
  getUnassignedRequests,
  getAssignedRequests,
  assignRequestToWorkOrder,
  unassignRequest,
  type OmRequest,
} from './services/requestService'
import { WorkOrderWithRequests } from './components/WorkOrderWithRequests'
import { CreateWorkOrderModal } from './components/CreateWorkOrderModal'
import { loadDomains } from './services/domainService'
import {
  getWorkOrders,
  createWorkOrder,
  softDeleteWorkOrder,
  type OmWorkOrder,
} from './services/workOrderService'
// import { DISTRICTS } from './constants/districts'
import { colors, styles } from './theme'

// ============================================================
// MODULE-LEVEL HELPERS (no React state, just pure functions)
// ============================================================

//const CLOSED_REQUEST_STATUSES = ['Closed', 'Canceled']
const CLOSED_WORK_ORDER_STATUSES = ['Completed', 'Canceled', 'Closed']

const normalize = (g: string | null | undefined) =>
  g ? g.replace(/[{}]/g, '').toUpperCase() : null

//const isRequestModifiable = (req: OmRequest) =>
//  !CLOSED_REQUEST_STATUSES.includes(req.status ?? '')

const isWorkOrderAssignable = (wo: OmWorkOrder) =>
  !CLOSED_WORK_ORDER_STATUSES.includes(wo.workOrderStatus ?? '')

// ============================================================
// COMPONENT — all React state lives in here
// ============================================================

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 5) return 'just now'
  if (seconds < 60) return `${seconds} seconds ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  const hours = Math.floor(minutes / 60)
  return `${hours} hour${hours === 1 ? '' : 's'} ago`
}

export default function App() {
  // ---- State hooks ----
  const [workOrders, setWorkOrders] = useState<OmWorkOrder[]>([])
  const [assignedRequests, setAssignedRequests] = useState<OmRequest[]>([])
  const [unassignedRequests, setUnassignedRequests] = useState<OmRequest[]>([])
  const [selectedRequestIds, setSelectedRequestIds] = useState<number[]>([])
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState<number | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [modalMode, setModalMode] = useState<'standalone' | 'from-selection' | null>(null)
 
  // ---- Data loading ----

async function loadAll() {
  setLoading(true)
  setErrorMessage(null)
  try {
    const [wos, assigned, unassigned, _domains] = await Promise.all([
      getWorkOrders(),
      getAssignedRequests(),
      getUnassignedRequests(),
      loadDomains(),
    ])
    setWorkOrders(wos)
    setAssignedRequests(assigned)
    setUnassignedRequests(unassigned)
    setLastUpdated(new Date())   // ← add this
  } catch (e: any) {
    console.error(e)
    setErrorMessage(e.message ?? 'Failed to load data.')
  } finally {
    setLoading(false)
  }
}

  useEffect(() => {
    loadAll()
  }, [])

// Auto-refresh every 30 seconds
useEffect(() => {
  const interval = setInterval(loadAll, 30000)
  return () => clearInterval(interval)
}, [])

// Refresh when user returns to the tab
useEffect(() => {
  const onFocus = () => loadAll()
  window.addEventListener('focus', onFocus)
  return () => window.removeEventListener('focus', onFocus)
}, [])

  // ---- Handlers ----
  function toggleRequest(objectId: number) {
    setSelectedRequestIds((prev) =>
      prev.includes(objectId)
        ? prev.filter((id) => id !== objectId)
        : [...prev, objectId]
    )
  }

async function handleCreateWorkOrder(districtCode: string) {
  //const result = await createWorkOrder({ district: districtCode })
  const result = await createWorkOrder({ district: districtCode, priority: 'No Requests Assigned', work_order_id: 'PENDING' })
  // If we're in from-selection mode, assign the selected requests to the new WO
  if (modalMode === 'from-selection' && selectedRequestIds.length > 0) {
    for (const reqId of selectedRequestIds) {
      await assignRequestToWorkOrder(reqId, result.objectId)
    }
    setSelectedRequestIds([])
  }
  setModalMode(null)
  await loadAll()
  setSelectedWorkOrderId(result.objectId) // auto-select the new WO
}

  async function handleAssign() {
    if (!selectedWorkOrderId || selectedRequestIds.length === 0) return
    try {
      for (const reqId of selectedRequestIds) {
        await assignRequestToWorkOrder(reqId, selectedWorkOrderId)
      }
      setSelectedRequestIds([])
      await loadAll()
    } catch (e: any) {
      console.error(e)
      setErrorMessage(e.message ?? 'Assign failed.')
    }
  }

  async function handleUnassign(requestObjectId: number) {
    try {
      await unassignRequest(requestObjectId)
      await loadAll()
    } catch (e: any) {
      console.error(e)
      setErrorMessage(e.message ?? 'Unassign failed.')
    }
  }

  async function handleDeleteWorkOrder(workOrder: OmWorkOrder) {
    try {
      // 1. Unassign every request currently attached to this WO so they revert
      //    to the unassigned pool. We do this BEFORE deleting the WO so the
      //    requests don't end up pointing at a soft-deleted parent.
      const attachedRequests = assignedRequests.filter(
        (r) => normalize(r.assignedWorkOrderGlobalId) === normalize(workOrder.globalId)
      )
      for (const req of attachedRequests) {
        await unassignRequest(req.objectId)
      }

      // 2. Soft-delete the work order itself
      await softDeleteWorkOrder(workOrder.objectId)

      // 3. If the deleted WO was selected, clear selection
      if (selectedWorkOrderId === workOrder.objectId) {
        setSelectedWorkOrderId(null)
      }

      // 4. Refresh everything
      await loadAll()
    } catch (e: any) {
      console.error(e)
      setErrorMessage(e.message ?? 'Delete failed.')
      throw e // re-throw so the modal knows to stay open / show working state ended badly
    }
  }

  // ---- Computed flags (derived from state — these can see workOrders etc.) ----
  const assignableWorkOrders = workOrders.filter(isWorkOrderAssignable)
  const noAssignableWorkOrders = assignableWorkOrders.length === 0

  const selectedWo = workOrders.find((w) => w.objectId === selectedWorkOrderId)
  const selectedWoIsAssignable = selectedWo ? isWorkOrderAssignable(selectedWo) : false

  const canAssign =
    !!selectedWorkOrderId &&
    selectedWoIsAssignable &&
    selectedRequestIds.length > 0

    // Districts of selected requests
const selectedRequests = unassignedRequests.filter((r) =>
  selectedRequestIds.includes(r.objectId)
)
const selectedDistricts = Array.from(
  new Set(selectedRequests.map((r) => r.district).filter(Boolean))
) as string[]
const derivedDistrict = selectedDistricts.length === 1 ? selectedDistricts[0] : undefined
const canCreateFromSelection =
  selectedRequestIds.length > 0 && selectedDistricts.length === 1

// ---- JSX ----
return (
  <div style={styles.page}>
    <h1 style={styles.h1}>
      OLHC Operations &amp; Maintenance<br />Work Order &amp; Request Portal
    </h1>

    <div style={styles.lastUpdated}>
      {lastUpdated
        ? `Last updated: ${timeAgo(lastUpdated)} (${lastUpdated.toLocaleTimeString()})`
        : 'Not yet loaded'}
    </div>

    {errorMessage && (
      <div style={styles.errorBanner}>{errorMessage}</div>
    )}
    {loading && (
      <div style={{ textAlign: 'center', color: colors.darkGray }}>Loading…</div>
    )}

    {/* ===== Work Orders ===== */}
    <section>
      <div style={styles.sectionHeader}>
        <h2 style={styles.h2}>Work Orders</h2>
        
<button
  type="button"
  style={styles.primaryButton}
  onClick={() => setModalMode('standalone')}
>
  + New Work Order
</button>

        <button type="button" style={styles.primaryButton} onClick={loadAll} disabled={loading}>
          {loading ? 'Refreshing…' : '🔄 Refresh Work Orders'}
        </button>
      </div>

      {workOrders.length === 0 ? (
        <em style={{ color: colors.darkGray }}>No work orders found.</em>
      ) : (
        workOrders.map((wo) => {
          const reqsForThisWo = assignedRequests.filter(
            (r) => normalize(r.assignedWorkOrderGlobalId) === normalize(wo.globalId)
          )
          const assignable = isWorkOrderAssignable(wo)
          return (
            <WorkOrderWithRequests
              key={wo.objectId}
              workOrder={wo}
              assignedRequests={reqsForThisWo}
              isSelected={selectedWorkOrderId === wo.objectId}
              isAssignable={assignable}
              onSelect={setSelectedWorkOrderId}
              onUnassignRequest={handleUnassign}
              onDeleteWorkOrder={handleDeleteWorkOrder}
            />
          )
        })
      )}
    </section>

    {/* ===== Unassigned Requests ===== */}
    <section>
      <div style={styles.sectionHeader}>
        <h2 style={styles.h2}>Unassigned Requests</h2>
        <button type="button" style={styles.primaryButton} onClick={loadAll} disabled={loading}>
          {loading ? 'Refreshing…' : '🔄 Refresh Requests'}
        </button>
      </div>

      {unassignedRequests.length === 0 ? (
        <em style={{ color: colors.darkGray }}>No unassigned requests.</em>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {unassignedRequests.map((req) => (
            <li key={req.objectId} style={{ padding: '0.25rem 0', color: colors.darkestGray }}>
              <label>
                <input
                  type="checkbox"
                  checked={selectedRequestIds.includes(req.objectId)}
                  onChange={() => toggleRequest(req.objectId)}
                />
                {' '}
                <strong>{req.requestId}</strong>
                {' · '}{req.urgency ?? '—'}
                {' · '}{req.status ?? '—'}
                {' · '}{req.title ?? 'Untitled'}
              </label>
            </li>
          ))}
        </ul>
      )}

      <div style={{ textAlign: 'center', marginTop: '0.75rem' }}>
        <button
          onClick={handleAssign}
          disabled={!canAssign}
          style={canAssign ? styles.successButton : styles.disabledButton}
          title={
            noAssignableWorkOrders
              ? 'No assignable work orders. Create one first.'
              : !selectedWorkOrderId
              ? 'Pick a work order'
              : !selectedWoIsAssignable
              ? 'Selected work order is closed'
              : selectedRequestIds.length === 0
              ? 'Pick at least one request'
              : ''
          }
        >
          Assign Selected to Selected Work Order
        </button>
        
<button
  type="button"
  disabled={!canCreateFromSelection}
  onClick={() => setModalMode('from-selection')}
  style={canCreateFromSelection ? styles.primaryButton : styles.disabledButton}
  title={
    selectedRequestIds.length === 0
      ? 'Select at least one request'
      : selectedDistricts.length > 1
      ? 'Selected requests must all be in the same service area'
      : ''
  }
>
  + Create New Work Order from Selection
</button>

      </div>

      {noAssignableWorkOrders && (
        <div style={styles.warningText}>
          No assignable work orders exist. (Create Work Order coming next.)
        </div>
      )}
    </section>
    
{modalMode && (
  <CreateWorkOrderModal
    mode={modalMode}
    derivedDistrict={derivedDistrict}
    selectedCount={selectedRequestIds.length}
    onCancel={() => setModalMode(null)}
    onConfirm={handleCreateWorkOrder}
  />
)}

  </div>
)
}