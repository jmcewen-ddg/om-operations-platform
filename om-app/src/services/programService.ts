import { arcgisConfig } from '../config/arcgis'

export type ProgramType = 'MI' | 'CP'

export interface ProgramOption {
  type: ProgramType
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
  token: string
): Promise<ArcGISQueryResponse<TAttributes>> {
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
    throw new Error(data.error.message || 'ArcGIS feature layer query returned an error')
  }

  return data
}

export async function getMaintenanceInitiatives(token: string): Promise<ProgramOption[]> {
  const data = await queryFeatureLayer<MaintenanceInitiativeAttributes>(
    arcgisConfig.services.maintenanceInitiativeLayerUrl,
    token
  )

  return (data.features ?? []).map((feature) => {
    const attrs = feature.attributes

    return {
      type: 'MI',
      objectId: attrs.OBJECTID,
      globalId: attrs.GlobalID,
      name: attrs.maintenance_initiative,
      description: attrs.mi_description,
    }
  })
}

export async function getCapitalProjects(token: string): Promise<ProgramOption[]> {
  const data = await queryFeatureLayer<CapitalProjectAttributes>(
    arcgisConfig.services.capitalProjectLayerUrl,
    token
  )

  return (data.features ?? []).map((feature) => {
    const attrs = feature.attributes

    return {
      type: 'CP',
      objectId: attrs.OBJECTID,
      globalId: attrs.GlobalID,
      name: attrs.capital_project,
      description: attrs.cp_description,
    }
  })
}

export async function getProgramOptions(
  type: ProgramType,
  token: string
): Promise<ProgramOption[]> {
  if (type === 'MI') {
    return getMaintenanceInitiatives(token)
  }

  return getCapitalProjects(token)
}