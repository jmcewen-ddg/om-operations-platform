import { useCallback, useEffect, useMemo, useState } from 'react'
import { colors } from '../theme'
import {
  getMovedRequests,
  returnRequestToUnassigned,
  type OmRequest,
} from '../services/requestService'
import {
  getMaintenanceInitiatives,
  getCapitalProjects,
  type ProgramOption,
} from '../services/programService'
import { getCurrentUser, type CurrentUser } from '../lib/roles'
import { applyAllRequestFilters } from '../domain/request/requestFilters'
import { ProgramAssignmentsGroup } from './ProgramAssignmentsGroup'
import { ReturnToUnassignedModal } from './ReturnToUnassignedModal'
import { programLinks, type ProgramTarget } from '../config/programLinks'

type Props = {
  /** Forwarded to rows: lets the parent app open the request detail panel. */
  onSelectRequest?: (request: OmRequest) => void

  /** Highlights the row matching this id. */
  selectedRequestObjectId?: number | null
}

// Strip braces and uppercase so MI/CP GlobalIDs and request *_globalid values match.
function normalizeGuid(g: string | null | undefined): string | null {
  if (!g) return null
  return g.replace(/[{}]/g, '').toUpperCase()
}

type ReturnDialogState = {
  request: OmRequest
  fromTarget: ProgramTarget
  fromProgramName: string
} | null

export function ProgramAssignmentsView({
  onSelectRequest,
  selectedRequestObjectId,
}: Props) {
  // ---- Data ----
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [mis, setMis] = useState<ProgramOption[]>([])
  const [cps, setCps] = useState<ProgramOption[]>([])
  const [movedRequests, setMovedRequests] = useState<OmRequest[]>([])

  // ---- UI ----
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [returnDialog, setReturnDialog] = useState<ReturnDialogState>(null)

  // ---- Load ----
  const loadAll = useCallback(async () => {
    setLoading(true)
    setErrorMessage(null)
    try {
      const [user, miList, cpList, moved] = await Promise.all([
        getCurrentUser(),
        getMaintenanceInitiatives(),
        getCapitalProjects(),
        getMovedRequests(),
      ])
      setCurrentUser(user)
      setMis(miList)
      setCps(cpList)
      setMovedRequests(moved)
    } catch (err) {
      console.error(err)
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to load program assignments.',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  // ---- Visibility-filter the moved requests ----
  // No UI filter yet — pass an empty filter object. The district dropdown will
  // hook into this same path when we add it.
  const visibleRequests = useMemo(() => {
    if (!currentUser) return []
    return applyAllRequestFilters(movedRequests, currentUser, {})
  }, [currentUser, movedRequests])

  // ---- Group requests under their parent MI / CP via GlobalID ----
  const { miRequestMap, cpRequestMap, orphanRequests } = useMemo(() => {
    const miMap = new Map<string, OmRequest[]>()
    const cpMap = new Map<string, OmRequest[]>()
    const orphans: OmRequest[] = []

    for (const r of visibleRequests) {
      const miKey = normalizeGuid(r.maintenanceInitiativeGlobalId)
      const cpKey = normalizeGuid(r.capitalProjectGlobalId)

      if (miKey) {
        if (!miMap.has(miKey)) miMap.set(miKey, [])
        miMap.get(miKey)!.push(r)
      } else if (cpKey) {
        if (!cpMap.has(cpKey)) cpMap.set(cpKey, [])
        cpMap.get(cpKey)!.push(r)
      } else {
        orphans.push(r)
      }
    }

    return { miRequestMap: miMap, cpRequestMap: cpMap, orphanRequests: orphans }
  }, [visibleRequests])

  // ---- Return-to-Unassigned flow ----
  function handleReturnClick(request: OmRequest) {
    // Decide which program the request came from.
    let fromTarget: ProgramTarget | null = null
    let fromGuid: string | null = null

    if (request.maintenanceInitiativeGlobalId) {
      fromTarget = 'maintenanceInitiative'
      fromGuid = normalizeGuid(request.maintenanceInitiativeGlobalId)
    } else if (request.capitalProjectGlobalId) {
      fromTarget = 'capitalProject'
      fromGuid = normalizeGuid(request.capitalProjectGlobalId)
    }

    // Look up a friendly program name from the loaded MI/CP lists.
    let fromProgramName = '(unknown)'
    if (fromTarget && fromGuid) {
      const list = fromTarget === 'maintenanceInitiative' ? mis : cps
      const match = list.find((p) => normalizeGuid(p.globalId) === fromGuid)
      if (match) fromProgramName = match.name
    }

    // If we somehow can't determine the source, bail visibly rather than silently.
    if (!fromTarget) {
      console.warn('Return-to-Unassigned: request has no MI or CP set', request)
      setErrorMessage(
        'Cannot return this request: no program assignment found on the record.',
      )
      return
    }

    setReturnDialog({ request, fromTarget, fromProgramName })
  }

  async function handleReturnConfirm({ reason }: { reason: string }) {
    if (!returnDialog) return
    const { request, fromTarget, fromProgramName } = returnDialog

    if (!request.globalId) {
      throw new Error('Request is missing a GlobalID — cannot return.')
    }

    await returnRequestToUnassigned({
      requestObjectId: request.objectId,
      requestGlobalId: request.globalId,
      fromTarget,
      fromProgramName,
      reason,
      triagedDate: request.triagedDate ?? null,
    })

    setReturnDialog(null)
    await loadAll()
  }

  return (
    <section
      style={{
        background: colors.lightestGray,
        padding: '1rem',
        borderRadius: 8,
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '0.75rem',
          gap: '0.75rem',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              color: colors.darkestGray,
              fontSize: '1.1em',
            }}
          >
            Assigned to Maintenance Initiative / Capital Project
          </h2>
          <div style={{ color: colors.darkGray, fontSize: '0.85em' }}>
            Requests moved out of the triage queue and into a program.
            Use “Return to Unassigned” to send one back to the pool.
          </div>
        </div>

        <button
          type="button"
          onClick={loadAll}
          disabled={loading}
          style={{
            background: colors.white,
            color: colors.darkestGray,
            border: `1px solid ${colors.gray}`,
            borderRadius: 4,
            padding: '0.4rem 0.8rem',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1,
            fontWeight: 600,
          }}
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </header>

      {errorMessage && (
        <div
          role="alert"
          style={{
            background: '#fdecea',
            color: '#9B1C1C',
            border: '1px solid #f5c2c0',
            padding: '0.5rem 0.75rem',
            borderRadius: 4,
            marginBottom: '0.75rem',
            fontSize: '0.9em',
          }}
        >
          ⚠️ {errorMessage}
        </div>
      )}

      {/* MAINTENANCE INITIATIVES */}
      <h3
        style={{
          marginTop: '0.5rem',
          marginBottom: '0.5rem',
          color: colors.darkestGray,
          fontSize: '1em',
        }}
      >
        {programLinks.maintenanceInitiative.label}s
      </h3>
      {mis.length === 0 ? (
        <div
          style={{
            color: colors.darkGray,
            fontSize: '0.9em',
            marginBottom: '1rem',
          }}
        >
          No Maintenance Initiatives defined.
        </div>
      ) : (
        mis.map((mi) => {
          const key = normalizeGuid(mi.globalId)
          const reqs = (key && miRequestMap.get(key)) || []
          return (
            <ProgramAssignmentsGroup
              key={mi.globalId}
              programName={mi.name}
              programDescription={mi.description}
              requests={reqs}
              defaultExpanded={reqs.length > 0}
              selectedRequestObjectId={selectedRequestObjectId ?? null}
              onSelectRequest={onSelectRequest}
              onReturnClick={handleReturnClick}
            />
          )
        })
      )}

      {/* CAPITAL PROJECTS */}
      <h3
        style={{
          marginTop: '1.25rem',
          marginBottom: '0.5rem',
          color: colors.darkestGray,
          fontSize: '1em',
        }}
      >
        {programLinks.capitalProject.label}s
      </h3>
      {cps.length === 0 ? (
        <div style={{ color: colors.darkGray, fontSize: '0.9em' }}>
          No Capital Projects defined.
        </div>
      ) : (
        cps.map((cp) => {
          const key = normalizeGuid(cp.globalId)
          const reqs = (key && cpRequestMap.get(key)) || []
          return (
            <ProgramAssignmentsGroup
              key={cp.globalId}
              programName={cp.name}
              programDescription={cp.description}
              requests={reqs}
              defaultExpanded={reqs.length > 0}
              selectedRequestObjectId={selectedRequestObjectId ?? null}
              onSelectRequest={onSelectRequest}
              onReturnClick={handleReturnClick}
            />
          )
        })
      )}

      {/* ORPHANS: moved-status requests with no MI/CP GlobalID (data hygiene case) */}
      {orphanRequests.length > 0 && (
        <>
          <h3
            style={{
              marginTop: '1.25rem',
              marginBottom: '0.5rem',
              color: '#9B1C1C',
              fontSize: '1em',
            }}
          >
            Unlinked (data hygiene)
          </h3>
          <ProgramAssignmentsGroup
            programName="Moved requests without a program link"
            programDescription="These records show a moved-status but have no MI/CP GlobalID set. Investigate in ArcGIS Pro / SQL."
            requests={orphanRequests}
            defaultExpanded
            selectedRequestObjectId={selectedRequestObjectId ?? null}
            onSelectRequest={onSelectRequest}
            onReturnClick={handleReturnClick}
          />
        </>
      )}

      {/* Modal */}
      <ReturnToUnassignedModal
        isOpen={returnDialog !== null}
        requestIdLabel={returnDialog?.request.requestId ?? null}
        fromTarget={returnDialog?.fromTarget ?? null}
        fromProgramName={returnDialog?.fromProgramName ?? null}
        onCancel={() => setReturnDialog(null)}
        onConfirm={handleReturnConfirm}
      />
    </section>
  )
}