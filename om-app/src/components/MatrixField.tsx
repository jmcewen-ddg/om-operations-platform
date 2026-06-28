import type { ReactNode } from 'react'
import { getAccessLevel } from '../lib/fieldEditMatrix'
import { useMatrixFieldContext } from '../lib/matrixFieldContext'
import { EditableField } from './EditableField'
import { colors } from '../theme'

/**
 * Matrix-aware field renderer. Looks up the (field, status, role) cell in
 * the active matrix and decides what to render:
 *
 *   hidden                   → renders nothing (returns null)
 *   R / auto / create        → renders read-only display
 *   RW (and panel isEditing) → renders <EditableField>
 *   RW (panel not editing)   → renders read-only display
 *
 * Callers pass the field config once; they don't have to think about who
 * the user is or what status the record is in.
 */

type CommonProps = {
  fieldKey: string
  label: string
  /** Live value (from draft or saved record). MatrixField doesn't care which. */
  value: string | number | null
  /** Make the field span both grid columns in the section layout. */
  wide?: boolean
  /** Small text below the field (rendering note, validation hint, etc.). */
  helperText?: string
  /**
   * Optional formatter for read-only display. Useful for dates that are
   * stored as epoch ms but should be shown as "11/15/2025, 3:42 PM".
   * Falls back to String(value) if not provided.
   */
  formatValue?: (value: string | number | null) => ReactNode
}

type TextProps = CommonProps & {
  type: 'text'
  onChange: (val: string | null) => void
  maxLength?: number
}

type TextareaProps = CommonProps & {
  type: 'textarea'
  onChange: (val: string | null) => void
  maxLength?: number
  rows?: number
}

type NumberProps = CommonProps & {
  type: 'number'
  onChange: (val: number | null) => void
  step?: number
  min?: number
  max?: number
}

type SelectProps = CommonProps & {
  type: 'select'
  onChange: (val: string | null) => void
  options: { code: string; name: string }[]
  disabled?: boolean
}

type DateProps = CommonProps & {
  type: 'date'
  onChange: (val: number | null) => void
}

export type MatrixFieldProps =
  | TextProps
  | TextareaProps
  | NumberProps
  | SelectProps
  | DateProps

export function MatrixField(props: MatrixFieldProps) {
  const { matrix, role, status, isEditing } = useMatrixFieldContext()
  const level = getAccessLevel(matrix, props.fieldKey, status, role)

  // Hidden: not surfaced at all.
  if (level === 'hidden') return null

  // Editable input only when (a) user has write access AND (b) panel is editing.
  const showEditableInput = isEditing && level === 'RW'

  if (showEditableInput) {
    switch (props.type) {
      case 'text':
        return (
          <EditableField
            type="text"
            label={props.label}
            value={props.value as string | null}
            onChange={props.onChange}
            wide={props.wide}
            helperText={props.helperText}
            maxLength={props.maxLength}
          />
        )
      case 'textarea':
        return (
          <EditableField
            type="textarea"
            label={props.label}
            value={props.value as string | null}
            onChange={props.onChange}
            wide={props.wide}
            helperText={props.helperText}
            maxLength={props.maxLength}
            rows={props.rows}
          />
        )
      case 'number':
        return (
          <EditableField
            type="number"
            label={props.label}
            value={props.value as number | null}
            onChange={props.onChange}
            wide={props.wide}
            helperText={props.helperText}
            step={props.step}
            min={props.min}
            max={props.max}
          />
        )
      case 'select':
        return (
          <EditableField
            type="select"
            label={props.label}
            value={props.value as string | null}
            options={props.options}
            onChange={props.onChange}
            wide={props.wide}
            helperText={props.helperText}
            disabled={props.disabled}
          />
        )
      case 'date':
        return (
          <EditableField
            type="date"
            label={props.label}
            value={props.value as number | null}
            onChange={props.onChange}
            wide={props.wide}
            helperText={props.helperText}
          />
        )
    }
  }

  // Read-only display path. Used for: R, auto, create, AND for RW when the
  // panel isn't in edit mode (so the field still shows but as plain text).
  const display =
    props.value === null || props.value === undefined || props.value === ''
      ? '—'
      : props.formatValue
        ? props.formatValue(props.value)
        : String(props.value)

  return (
    <div style={{ gridColumn: props.wide ? '1 / -1' : 'auto' }}>
      <div
        style={{
          color: colors.darkGray,
          fontSize: '0.75em',
          textTransform: 'uppercase',
        }}
      >
        {props.label}
      </div>
      <div
        style={{
          color: colors.darkestGray,
          wordBreak: 'break-word',
          whiteSpace: 'pre-wrap',
        }}
      >
        {display}
      </div>
      {props.helperText && (
        <div
          style={{
            color: colors.darkGray,
            fontSize: '0.72em',
            marginTop: 2,
          }}
        >
          {props.helperText}
        </div>
      )}
    </div>
  )
}