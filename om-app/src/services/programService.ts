import { getArcGISTokenForUrl } from './arcgisAuth'
import { programLinks, type ProgramTarget } from '../config/programLinks'

export interface ProgramOption {
  target: ProgramTarget
  objectId: number
  globalId: string
  name: string
  description: string | null
}

interface ArcGISFeature<TAttributes> {
  attributes: TAttributes
}

interface ArcGISQueryResponse<TAttributes> {
  features?: ArcGISFeature<TAttributes>[]
  error?: {
    code?: number
    message?: string
    details?: string[]
  }
}

interface MaintenanceInitiativeAttributes {
  OBJECTID: number
  GlobalID: string
  maintenance_initiative: string
  mi_description: string | null
}

interface CapitalProjectAttributes {
  OBJECTID: number
  GlobalID: string
  capital_project: string
  cp_description: string | null
}

async function queryFeatureLayer<TAttributes>(
  layerUrl: string,
): Promise<ArcGISQueryResponse<TAttributes>> {
  const token = await getArcGISTokenForUrl(layerUrl)

  const params = new URLSearchParams({
    f: 'json',
    where: '1=1',
    outFields: '*',
    returnGeometry: 'false',
    orderByFields: 'OBJECTID ASC',
    token,
  })

  const response = await fetch(`${layerUrl}/query?${params.toString()}`)

  if (!response.ok) {
    throw new Error(`Feature layer query failed: ${response.status} ${response.statusText}`)
  }

  const data = (await response.json()) as ArcGISQueryResponse<TAttributes>

  if (data.error) {
    const details = data.error.details?.length
      ? ` ${data.error.details.join(' ')}`
      : ''

    throw new Error(
      data.error.message
        ? `${data.error.message}${details}`
        : 'ArcGIS feature layer query returned an error',
    )
  }

  return data
}

export async function getMaintenanceInitiatives(): Promise<ProgramOption[]> {
  const target: ProgramTarget = 'maintenanceInitiative'
  const layerUrl = programLinks[target].serviceUrl

  const data = await queryFeatureLayer<MaintenanceInitiativeAttributes>(layerUrl)

  return (data.features ?? []).map((feature) => {
    const attrs = feature.attributes

    return {
      target,
      objectId: attrs.OBJECTID,
      globalId: attrs.GlobalID,
      name: attrs.maintenance_initiative,
      description: attrs.mi_description,
    }
  })
}

export async function getCapitalProjects(): Promise<ProgramOption[]> {
  const target: ProgramTarget = 'capitalProject'
  const layerUrl = programLinks[target].serviceUrl

  const data = await queryFeatureLayer<CapitalProjectAttributes>(layerUrl)

  return (data.features ?? []).map((feature) => {
    const attrs = feature.attributes

    return {
      target,
      objectId: attrs.OBJECTID,
      globalId: attrs.GlobalID,
      name: attrs.capital_project,
      description: attrs.cp_description,
    }
  })
}

export async function getProgramOptions(
  target: ProgramTarget,
): Promise<ProgramOption[]> {
  if (target === 'maintenanceInitiative') {
    return getMaintenanceInitiatives()
  }

  return getCapitalProjects()
}