import { useEffect, useState } from 'react'
import {
  getWorkOrderNotes,
  addWorkOrderNote,
  softDeleteWorkOrderNote,
  type OmWorkOrderNote,
} from '../services/workOrderNoteService'
import { colors } from '../theme'
import { ConfirmModal } from './ConfirmModal'
import { EditableField } from './EditableField'

// Sourced from the dom_om_note_type domain (shared with request notes).
const NOTE_TYPE_OPTIONS = [
  { code: 'General',      name: 'General' },
  { code: 'Triage',       name: 'Triage' },
  { code: 'Design',       name: 'Design' },
  { code: 'Field',        name: 'Field' },
  { code: 'Closeout',     name: 'Closeout' },
  { code: 'Cancellation', name: 'Cancellation' },
]

type Props = {
  /** Parent work order's GlobalID — drives which notes get loaded. */
  workOrderGlobalId: string | null
  defaultOpen?: boolean
}

export function WorkOrderNotesSection({ workOrderGlobalId, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen)
  const [notes, setNotes] = useState<OmWorkOrderNote[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  // ---- Add-note form state ----
  const [showAddForm, setShowAddForm] = useState(false)
  const [draftType, setDraftType] = useState<string | null>(null)
  const [draftText, setDraftText] = useState<string>('')
  const [draftDate, setDraftDate] = useState<number>(Date.now())
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // ---- Soft-delete confirm state ----
  const [deleteTarget, setDeleteTarget] = useState<OmWorkOrderNote | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Load notes when section opens or the parent WO changes
  useEffect(() => {
    if (!workOrderGlobalId || !open) return
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    getWorkOrderNotes(workOrderGlobalId)
      .then((rows) => { if (!cancelled) setNotes(rows) })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Failed to load notes')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [workOrderGlobalId, open])

  // Reset form when section closes or parent changes
  useEffect(() => {
    setShowAddForm(false)
    setDraftType(null)
    setDraftText('')
    setDraftDate(Date.now())
    setSaveError(null)
  }, [workOrderGlobalId])

  const canSave =
    !!draftType && draftText.trim().length > 0 && !isSaving && !!workOrderGlobalId

  async function handleSaveNote() {
    if (!workOrderGlobalId || !canSave) return
    setIsSaving(true)
    setSaveError(null)
    try {
      await addWorkOrderNote({
        workOrderGlobalId,
        noteType: draftType!,
        noteText: draftText.trim(),
        noteDate: draftDate,
      })
      const fresh = await getWorkOrderNotes(workOrderGlobalId)
      setNotes(fresh)
      setDraftType(null)
      setDraftText('')
      setDraftDate(Date.now())
      setShowAddForm(false)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save note')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      await softDeleteWorkOrderNote(deleteTarget.objectId)
      setNotes((prev) => prev.filter((n) => n.objectId !== deleteTarget.objectId))
      setDeleteTarget(null)
    } catch (err) {
      console.error('Failed to delete note:', err)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <section style={{
      marginBottom: '1rem',
      border: `1px solid ${colors.lightGray}`,
      borderRadius: 6,
      background: colors.white,
    }}>
      <button type="button" onClick={() => setOpen((x) => !x)}
        style={{
          width: '100%', textAlign: 'left',
          background: colors.lightestGray, color: colors.darkestGray,
          border: 'none', padding: '0.5rem 0.75rem',
          fontWeight: 700, cursor: 'pointer', borderRadius: '6px 6px 0 0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
        <span>Notes{notes.length > 0 ? ` (${notes.length})` : ''}</span>
        <span style={{ color: colors.darkGray, fontWeight: 400 }}>{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div style={{ padding: '0.5rem 0.75rem' }}>
          {!showAddForm ? (
            <div style={{ marginBottom: '0.75rem' }}>
              <button type="button" onClick={() => setShowAddForm(true)}
                disabled={!workOrderGlobalId}
                style={{
                  background: colors.blue, color: colors.white,
                  border: 'none', borderRadius: 4,
                  padding: '0.4rem 0.9rem', cursor: 'pointer',
                  fontWeight: 600, fontSize: '0.9em',
                }}>
                + Add Note
              </button>
            </div>
          ) : (
            <div style={{
              marginBottom: '0.75rem',
              padding: '0.75rem',
              background: colors.lightestGray,
              border: `1px solid ${colors.lightGray}`,
              borderRadius: 4,
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem 1rem',
            }}>
              <EditableField type="select" label="Type"
                value={draftType}
                options={NOTE_TYPE_OPTIONS}
                placeholder="— choose a type —"
                onChange={(val) => setDraftType(val)} />
              <EditableField type="date" label="Note Date"
                value={draftDate}
                onChange={(val) => setDraftDate(val ?? Date.now())} />
              <EditableField type="textarea" label="Note" wide
                value={draftText}
                maxLength={4000} rows={3}
                onChange={(val) => setDraftText(val ?? '')} />
              {saveError && (
                <div style={{ gridColumn: '1 / -1', color: '#9B1C1C', fontSize: '0.85em' }} role="alert">
                  ⚠️ {saveError}
                </div>
              )}
              <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" disabled={isSaving}
                  onClick={() => {
                    setShowAddForm(false)
                    setDraftType(null)
                    setDraftText('')
                    setDraftDate(Date.now())
                    setSaveError(null)
                  }}
                  style={{
                    background: colors.white, color: colors.darkestGray,
                    border: `1px solid ${colors.gray}`, borderRadius: 4,
                    padding: '0.35rem 0.8rem',
                    cursor: isSaving ? 'not-allowed' : 'pointer',
                    fontSize: '0.85em',
                  }}>Cancel</button>
                <button type="button" disabled={!canSave} onClick={handleSaveNote}
                  style={{
                    background: canSave ? colors.green : colors.gray,
                    color: canSave ? colors.darkestGray : colors.white,
                    border: 'none', borderRadius: 4,
                    padding: '0.35rem 0.8rem',
                    cursor: canSave ? 'pointer' : 'not-allowed',
                    fontWeight: 600, fontSize: '0.85em',
                  }}>
                  {isSaving ? 'Saving…' : 'Save Note'}
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <div style={{ color: colors.darkGray, fontStyle: 'italic', padding: '0.5rem' }}>Loading…</div>
          ) : loadError ? (
            <div style={{ color: '#9B1C1C', padding: '0.5rem' }} role="alert">⚠️ {loadError}</div>
          ) : notes.length === 0 ? (
            <div style={{ color: colors.darkGray, fontStyle: 'italic', padding: '0.5rem' }}>
              No notes yet.
            </div>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {notes.map((note) => (
                <NoteCard
                  key={note.objectId}
                  note={note}
                  onDelete={() => setDeleteTarget(note)}
                />
              ))}
            </ul>
          )}
        </div>
      )}

      <ConfirmModal
        isOpen={!!deleteTarget}
        title="Delete this note?"
        confirmLabel="Delete Note"
        confirmVariant="danger"
        isWorking={isDeleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        message={
          <>
            <p style={{ margin: '0 0 0.5rem 0' }}>You are about to soft-delete this note.</p>
            <p style={{ margin: 0, color: colors.darkGray, fontSize: '0.9em' }}>
              The note will be hidden from normal views but remain visible to admins.
            </p>
          </>
        }
      />
    </section>
  )
}

function NoteCard({ note, onDelete }: { note: OmWorkOrderNote; onDelete: () => void }) {
  return (
    <li style={{
      borderBottom: `1px solid ${colors.lightestGray}`,
      padding: '0.6rem 0.25rem',
      display: 'grid',
      gridTemplateColumns: '1fr auto',
      gap: '0.5rem',
      alignItems: 'start',
    }}>
      <div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.3rem', flexWrap: 'wrap' }}>
          <span style={{
            display: 'inline-block', background: colors.blue + '33',
            color: colors.darkestGray, padding: '0.1rem 0.55rem',
            borderRadius: 999, fontSize: '0.75em', fontWeight: 600,
          }}>
            {note.noteType ?? '—'}
          </span>
          <span style={{ color: colors.darkGray, fontSize: '0.8em' }}>
            {formatDate(note.noteDate)}
          </span>
          {note.enteredByName && (
            <span style={{ color: colors.darkGray, fontSize: '0.8em' }}>
              · {note.enteredByName}
            </span>
          )}
        </div>
        <div style={{
          color: colors.darkestGray,
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          fontSize: '0.9em',
        }}>
          {note.noteText ?? '—'}
        </div>
      </div>
      <button
        type="button"
        onClick={onDelete}
        title="Delete this note"
        aria-label="Delete this note"
        style={{
          background: 'transparent', border: 'none',
          color: '#B00020', cursor: 'pointer',
          fontSize: '1em', alignSelf: 'start',
          padding: '0.1rem 0.3rem',
        }}>
        🗑️
      </button>
    </li>
  )
}

function formatDate(epochMs: number | null): string {
  if (!epochMs) return '—'
  try { return new Date(epochMs).toLocaleString() } catch { return '—' }
}