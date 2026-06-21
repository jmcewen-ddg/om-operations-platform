import { getArcGISTokenForUrl, getCurrentArcGISUser } from './arcgisAuth'
import { arcgisConfig } from '../config/arcgis'

const REQUEST_NOTE_URL = arcgisConfig.services.requestNotes

export type OmRequestNote = {
  // Identity
  objectId: number
  globalId: string | null
  requestGlobalId: string | null

  // Content
  noteType: string | null
  noteText: string | null
  noteDate: number | null

  // Authorship
  enteredByName: string | null
  enteredByEmail: string | null

  // Soft delete
  deleted: string | null

  // Audit (read-only, Esri editor tracking)
  createdUser: string | null
  createdDate: number | null
  lastEditedUser: string | null
  lastEditedDate: number | null
}

function normalizeGuid(g: string | null | undefined): string | null {
  if (!g) return null
  return g.replace(/[{}]/g, '').toUpperCase()
}

/**
 * Fetch all non-deleted notes for a single request, newest first.
 * Sorted by note_date desc, with created_date as tiebreaker.
 */
export async function getRequestNotes(requestGlobalId: string): Promise<OmRequestNote[]> {
  const token = await getArcGISTokenForUrl(REQUEST_NOTE_URL)
  const cleanGuid = (requestGlobalId ?? '').replace(/[{}]/g, '').toUpperCase()
  if (!cleanGuid) return []

  const params = new URLSearchParams({
    where:
      `request_globalid = '{${cleanGuid}}' AND ` +
      `(deleted IS NULL OR deleted = 'No')`,
    outFields: '*',
    f: 'json',
    token,
  })

  const response = await fetch(`${REQUEST_NOTE_URL}/query?${params.toString()}`)
  const data = await response.json()
  if (data.error) {
    console.error('Request notes query error:', data.error)
    throw new Error(data.error.message ?? 'Failed to query request notes')
  }

  const notes: OmRequestNote[] = (data.features ?? []).map((feature: any) => {
    const a = feature.attributes ?? {}
    return {
      objectId: a.OBJECTID,
      globalId: normalizeGuid(a.GlobalID),
      requestGlobalId: normalizeGuid(a.request_globalid),
      noteType: a.note_type ?? null,
      noteText: a.note_text ?? null,
      noteDate: a.note_date ?? null,
      enteredByName: a.entered_by_name ?? null,
      enteredByEmail: a.entered_by_email ?? null,
      deleted: a.deleted ?? null,
      createdUser: a.created_user ?? null,
      createdDate: a.created_date ?? null,
      lastEditedUser: a.last_edited_user ?? null,
      lastEditedDate: a.last_edited_date ?? null,
    }
  })

  notes.sort((a, b) => {
    const aT = a.noteDate ?? a.createdDate ?? 0
    const bT = b.noteDate ?? b.createdDate ?? 0
    return bT - aT
  })

  return notes
}

export type AddRequestNoteInput = {
  requestGlobalId: string
  noteType: string
  noteText: string
  noteDate: number  // epoch ms
}

/**
 * Insert a new note. Author info is auto-populated from the logged-in
 * ArcGIS user via Portal's community/users endpoint.
 *
 * Future: a SQL trigger should stamp entered_by_* server-side and we
 * can stop sending them from the client.
 */
export async function addRequestNote(input: AddRequestNoteInput): Promise<void> {
  const token = await getArcGISTokenForUrl(REQUEST_NOTE_URL)
  const user = await getCurrentArcGISUser()
  const cleanGuid = input.requestGlobalId.replace(/[{}]/g, '').toUpperCase()

  const adds = [
    {
      attributes: {
        request_globalid: `{${cleanGuid}}`,
        note_type: input.noteType,
        note_text: input.noteText,
        note_date: input.noteDate,
        entered_by_name: user.fullName ?? user.username,
        entered_by_email: user.email,
        deleted: 'No',
      },
    },
  ]

  const editParams = new URLSearchParams({
    f: 'json',
    token,
    adds: JSON.stringify(adds),
  })

  const response = await fetch(`${REQUEST_NOTE_URL}/applyEdits`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: editParams.toString(),
  })
  const data = await response.json()
  if (data.error) {
    console.error('Add request note error:', data.error)
    throw new Error(data.error.message ?? 'Failed to add note')
  }
  const result = data.addResults?.[0]
  if (!result?.success) {
    console.error('Add request note non-success:', data)
    throw new Error(result?.error?.description ?? 'Failed to add note')
  }
}

/**
 * Soft-delete a note by setting deleted = 'Yes'. Honors the system-wide
 * "no hard deletes" rule. Admins can still see soft-deleted notes via
 * a separate admin view (future).
 */
export async function softDeleteRequestNote(objectId: number): Promise<void> {
  const token = await getArcGISTokenForUrl(REQUEST_NOTE_URL)

  const updates = [
    {
      attributes: {
        OBJECTID: objectId,
        deleted: 'Yes',
      },
    },
  ]

  const editParams = new URLSearchParams({
    f: 'json',
    token,
    updates: JSON.stringify(updates),
  })

  const response = await fetch(`${REQUEST_NOTE_URL}/applyEdits`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: editParams.toString(),
  })
  const data = await response.json()
  if (data.error) {
    console.error('Soft delete note error:', data.error)
    throw new Error(data.error.message ?? 'Failed to delete note')
  }
  const result = data.updateResults?.[0]
  if (!result?.success) {
    console.error('Soft delete note non-success:', data)
    throw new Error(result?.error?.description ?? 'Failed to delete note')
  }
}