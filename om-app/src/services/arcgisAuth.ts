import OAuthInfo from '@arcgis/core/identity/OAuthInfo'
import esriId from '@arcgis/core/identity/IdentityManager'
import { arcgisConfig } from '../config/arcgis'

const oauthInfo = new OAuthInfo({
  appId: arcgisConfig.appId,
  portalUrl: arcgisConfig.portalUrl,
  popup: false,
})

esriId.registerOAuthInfos([oauthInfo])

let activeCredential: any = null

const sharingUrl = `${arcgisConfig.portalUrl}/sharing`

export async function signInToArcGIS() {
  activeCredential = await esriId.getCredential(sharingUrl)
  return activeCredential
}

export async function checkArcGISSignIn() {
  try {
    activeCredential = await esriId.checkSignInStatus(sharingUrl)
    return activeCredential
  } catch {
    activeCredential = null
    return null
  }
}

export function getArcGISToken(): string | null {
  return activeCredential?.token ?? null
}

export async function getArcGISTokenForUrl(resourceUrl: string): Promise<string> {
  if (activeCredential?.token) {
    return activeCredential.token
  }

  activeCredential = await esriId.getCredential(resourceUrl)

  if (!activeCredential?.token) {
    throw new Error('No ArcGIS token available')
  }

  return activeCredential.token
}