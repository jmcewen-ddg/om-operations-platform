
import { getArcGISTokenForUrl } from './arcgisAuth'

// ============================================================
// Types
// ============================================================

export type CodedValue = {
  code: string | number
  name: string
}

export type DomainMap = Record<string, CodedValue[]>

// ============================================================
// Service URLs to scan for domains
// ============================================================
// Add any feature service layer here whose field domains we want available
// in the app. Domains are merged by field name across all sources.
// If the same field name exists in multiple services with different domains,
// the LAST one loaded wins — so put the canonical source last.

const DOMAIN_SOURCES: string[] = [
  'https://gis.ddgpc.com/arcgis/rest/services/25-1755_OLHC/OM_Request/FeatureServer/0',
  'https://gis.ddgpc.com/arcgis/rest/services/25-1755_OLHC/OM_Request/FeatureServer/2',
  'https://gis.ddgpc.com/arcgis/rest/services/25-1755_OLHC/OM_Request/FeatureServer/3',
  'https://gis.ddgpc.com/arcgis/rest/services/25-1755_OLHC/OM_Request/FeatureServer/4',
  'https://gis.ddgpc.com/arcgis/rest/services/25-1755_OLHC/OM_Work_Order/FeatureServer/0',
  'https://gis.ddgpc.com/arcgis/rest/services/25-1755_OLHC/OM_Work_Order/FeatureServer/1',
  'https://gis.ddgpc.com/arcgis/rest/services/25-1755_OLHC/OM_Work_Order/FeatureServer/2',
  'https://gis.ddgpc.com/arcgis/rest/services/25-1755_OLHC/OM_Work_Order/FeatureServer/3',
  'https://gis.ddgpc.com/arcgis/rest/services/25-1755_OLHC/OM_Work_Order/FeatureServer/4',
  'https://gis.ddgpc.com/arcgis/rest/services/25-1755_OLHC/OM_Work_Order/FeatureServer/5',
  'https://gis.ddgpc.com/arcgis/rest/services/25-1755_OLHC/OLHC_MaintInit_CapProj/FeatureServer/0',
  'https://gis.ddgpc.com/arcgis/rest/services/25-1755_OLHC/OLHC_MaintInit_CapProj/FeatureServer/1'
]

// ============================================================
// Internal cache
// ============================================================

let cachedDomains: DomainMap | null = null
let loadingPromise: Promise<DomainMap> | null = null

// ============================================================
// Public API
// ============================================================

/**
 * Load all domains from the configured service URLs.
 * Safe to call multiple times — subsequent calls return the cached result.
 * Concurrent calls during the initial load share the same in-flight promise.
 */
export async function loadDomains(): Promise<DomainMap> {
  if (cachedDomains) return cachedDomains
  if (loadingPromise) return loadingPromise

  loadingPromise = fetchAllDomains()
    .then((domains) => {
      cachedDomains = domains
      loadingPromise = null
      return domains
    })
    .catch((err) => {
      loadingPromise = null
      throw err
    })

  return loadingPromise
}

/**
 * Get the coded-value list for a field. Returns [] if the domain isn't loaded
 * yet or doesn't exist on the field. Callers should ensure loadDomains() has
 * resolved before they need real data (typically in App.tsx's loadAll()).
 */
export function getDomain(fieldName: string): CodedValue[] {
  if (!cachedDomains) return []
  return cachedDomains[fieldName] ?? []
}

/**
 * For testing / dev-only: clear the cache so the next loadDomains() re-fetches.
 */
export function clearDomainCache(): void {
  cachedDomains = null
  loadingPromise = null
}

// ============================================================
// Internals
// ============================================================

async function fetchAllDomains(): Promise<DomainMap> {
  const result: DomainMap = {}

  for (const url of DOMAIN_SOURCES) {
    try {
      const token = await getArcGISTokenForUrl(url)
      const params = new URLSearchParams({ f: 'json', token })
      const response = await fetch(`${url}?${params.toString()}`)
      const data = await response.json()

      if (data.error) {
        console.warn(`Domain fetch failed for ${url}:`, data.error)
        continue
      }

      const fields: any[] = data.fields ?? []
      for (const field of fields) {
        const dom = field.domain
        if (dom?.type === 'codedValue' && Array.isArray(dom.codedValues)) {
          result[field.name] = dom.codedValues.map((cv: any) => ({
            code: cv.code,
            name: cv.name,
          }))
        }
      }
    } catch (err) {
      console.warn(`Domain fetch threw for ${url}:`, err)
    }
  }

  console.log('[domainService] Loaded domains:', Object.keys(result))
  return result
}
