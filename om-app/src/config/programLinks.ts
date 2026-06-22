import { arcgisConfig } from './arcgis'

/**
 * Where requests get "moved" to when triagers promote them out of the
 * triage queue. Currently the MI and CP tables don't have proper
 * business-key `id` fields, so we store the related record's GlobalID
 * in `maintenance_initiative_id` / `capital_project_id` on the request.
 *
 * TODO: when the MI/CP tables get real `id` fields (e.g. MI-2026-001),
 *       flip `linkField` to 'id' and update the modal's helper text.
 *
 * TODO: build relationship classes from om_request → these two tables,
 *       then this lookup gets reinforced by Esri's relationship engine.
 */

export type ProgramTarget = 'maintenanceInitiative' | 'capitalProject'

export const programLinks = {
  maintenanceInitiative: {
    label: 'Maintenance Initiative',
    serviceUrl: arcgisConfig.services.maintenanceInitiativeLayerUrl,
    linkField: 'GlobalID' as const,
    requestAssignmentValue: 'Moved to Maintenance Initiative',
    requestIdFieldName: 'maintenance_initiative_globalid' as const,
  },
  capitalProject: {
    label: 'Capital Project',
    serviceUrl: arcgisConfig.services.capitalProjectLayerUrl,
    linkField: 'GlobalID' as const,
    requestAssignmentValue: 'Moved to Capital Projects',
    requestIdFieldName: 'capital_project_globalid' as const,
  },
} as const