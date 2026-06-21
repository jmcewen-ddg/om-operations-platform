import { getArcGISTokenForUrl } from './arcgisAuth'

/**
 * Generic Esri applyEdits result shape for a single feature edit.
 */
export type ApplyEditsResult = {
  objectId: number
  globalId?: string | null
  success: boolean
  error?: { code: number; description: string }
}

type ApplyEditsResponse = {
  addResults?: ApplyEditsResult[]
  updateResults?: ApplyEditsResult[]
  deleteResults?: ApplyEditsResult[]
  // Esri also sometimes returns a top-level error
  error?: { code: number; message: string; details?: string[] }
}

type ApplyEditsArgs = {
  /** Feature layer URL, e.g. https://.../FeatureServer/0  (NO trailing /applyEdits) */
  layerUrl: string
  adds?: Array<{ attributes: Record<string, unknown>; geometry?: unknown }>
  updates?: Array<{ attributes: Record<string, unknown>; geometry?: unknown }>
  deletes?: number[] // array of OBJECTIDs
}

/**
 * POST to <layerUrl>/applyEdits with token attached.
 * Throws if the HTTP call fails, if Esri returns a top-level error,
 * or if any individual edit result reports success=false.
 */
export async function applyEdits({
  layerUrl,
  adds,
  updates,
  deletes,
}: ApplyEditsArgs): Promise<ApplyEditsResponse> {
  const token = await getArcGISTokenForUrl(layerUrl)

  const body = new URLSearchParams()
  body.set('f', 'json')
  body.set('token', token)
  if (adds?.length) body.set('adds', JSON.stringify(adds))
  if (updates?.length) body.set('updates', JSON.stringify(updates))
  if (deletes?.length) body.set('deletes', JSON.stringify(deletes))
  // Roll back the entire batch if any single edit fails:
  body.set('rollbackOnFailure', 'true')

  const res = await fetch(`${layerUrl}/applyEdits`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!res.ok) {
    throw new Error(`applyEdits HTTP ${res.status}: ${res.statusText}`)
  }

  const json = (await res.json()) as ApplyEditsResponse

  // Esri sometimes returns 200 OK with an error object in the body. Trust nothing.
  if (json.error) {
    throw new Error(
      `applyEdits error ${json.error.code}: ${json.error.message}` +
        (json.error.details?.length ? ` — ${json.error.details.join('; ')}` : ''),
    )
  }

  const allResults = [
    ...(json.addResults ?? []),
    ...(json.updateResults ?? []),
    ...(json.deleteResults ?? []),
  ]
  const failures = allResults.filter((r) => !r.success)
  if (failures.length) {
    const messages = failures
      .map((f) => f.error?.description ?? `OBJECTID ${f.objectId} failed`)
      .join('; ')
    throw new Error(`applyEdits partial failure: ${messages}`)
  }

  return json
}