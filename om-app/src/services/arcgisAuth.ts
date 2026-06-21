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

// ============================================================
// Current-user lookup — used by notes to auto-stamp author info
// ============================================================

let cachedUser:
  | { username: string | null; fullName: string | null; email: string | null }
  | null = null

/**
 * Resolve the logged-in ArcGIS user's name + email by calling Portal's
 * community/users endpoint. Result is cached for the session — if a user
 * updates their profile, they'll see the new info next reload.
 *
 * Returns null fields rather than throwing, so a profile-fetch failure
 * doesn't block writes that depend on this (e.g., adding a note).
 */
export async function getCurrentArcGISUser(): Promise<{
  username: string | null
  fullName: string | null
  email: string | null
}> {
  if (cachedUser) return cachedUser

  // Make sure we have an active credential before reaching for userId/token
  if (!activeCredential) {
    await checkArcGISSignIn()
  }
  if (!activeCredential?.userId || !activeCredential?.token) {
    return { username: null, fullName: null, email: null }
  }

  const username: string = activeCredential.userId

  try {
    const url =
      `${arcgisConfig.portalUrl}/sharing/rest/community/users/` +
      `${encodeURIComponent(username)}?f=json&token=${activeCredential.token}`
    const response = await fetch(url)
    const data = await response.json()
    if (data.error) {
      console.warn('Failed to fetch user profile from Portal:', data.error)
      cachedUser = { username, fullName: null, email: null }
      return cachedUser
    }
    cachedUser = {
      username,
      fullName: data.fullName ?? null,
      email: data.email ?? null,
    }
    return cachedUser
  } catch (err) {
    console.warn('Failed to fetch user profile:', err)
    return { username, fullName: null, email: null }
  }
}