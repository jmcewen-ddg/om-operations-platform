const REQUEST_FEATURE_SERVER =
  'https://gis.ddgpc.com/arcgis/rest/services/25-1755_OLHC/OM_Request/FeatureServer'
const WORK_ORDER_FEATURE_SERVER =
  'https://gis.ddgpc.com/arcgis/rest/services/25-1755_OLHC/OM_Work_Order/FeatureServer'
const MI_CP_FEATURE_SERVER = 
  'https://gis.ddgpc.com/arcgis/rest/services/25-1755_OLHC/OLHC_MaintInit_CapProj/FeatureServer'

export const arcgisConfig = {
  portalUrl: 'https://gis.ddgpc.com/portal',

  appId: 'SDhYEVH3UjsAV2tF',

  services: {
    // ---- OM Request feature service ----
    requests:              `${REQUEST_FEATURE_SERVER}/0`,
    requestNotes:          `${REQUEST_FEATURE_SERVER}/2`,
    requestStatusHistory:  `${REQUEST_FEATURE_SERVER}/3`,
    requestDocuments:      `${REQUEST_FEATURE_SERVER}/4`,

    // ---- OM Work Order feature service ----
    workOrders:            `${WORK_ORDER_FEATURE_SERVER}/0`,
    workOrderAssignments:  `${WORK_ORDER_FEATURE_SERVER}/1`,
    workOrderLabor:        `${WORK_ORDER_FEATURE_SERVER}/2`,
    workOrderMaterials:    `${WORK_ORDER_FEATURE_SERVER}/3`,
    workOrderNotes:        `${WORK_ORDER_FEATURE_SERVER}/4`,
    workOrderStatusHistory:`${WORK_ORDER_FEATURE_SERVER}/5`,

    // ---- OLHC Maintenance Initiatives & Capital Projects feature service ----
    maintenanceInitiativeLayerUrl: `${MI_CP_FEATURE_SERVER}/0`,
    capitalProjectLayerUrl:        `${MI_CP_FEATURE_SERVER}/1`,
  },
} as const