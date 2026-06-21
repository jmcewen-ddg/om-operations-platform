import { colors } from '../theme'

type Option = { code: string; name: string }

type BaseProps = {
  label: string
  wide?: boolean
  disabled?: boolean
  helperText?: string
}

type TextProps     = BaseProps & { type: 'text';     value: string | null; onChange: (v: string | null) => void; maxLength?: number }
type TextareaProps = BaseProps & { type: 'textarea'; value: string | null; onChange: (v: string | null) => void; maxLength?: number; rows?: number }
type NumberProps   = BaseProps & { type: 'number';   value: number | null; onChange: (v: number | null) => void; step?: number; min?: number; max?: number }
type DateProps     = BaseProps & { type: 'date';     value: number | null; onChange: (v: number | null) => void }
type SelectProps   = BaseProps & { type: 'select';   value: string | null; onChange: (v: string | null) => void; options: Option[]; placeholder?: string }

export type EditableFieldProps =
  | TextProps | TextareaProps | NumberProps | DateProps | SelectProps

const labelStyle: React.CSSProperties = {
  color: colors.darkGray,
  fontSize: '0.75em',
  textTransform: 'uppercase',
}

const inputStyle = (disabled?: boolean): React.CSSProperties => ({
  width: '100%',
  padding: '0.3rem 0.4rem',
  border: `1px solid ${colors.gray}`,
  borderRadius: 4,
  background: disabled ? colors.lightestGray : colors.white,
  color: colors.darkestGray,
  fontSize: '0.95em',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
})

export function EditableField(props: EditableFieldProps) {
  const { label, wide, disabled, helperText } = props

  return (
    <div style={{ gridColumn: wide ? '1 / -1' : 'auto' }}>
      <div style={labelStyle}>{label}</div>
      {renderInput(props)}
      {helperText && (
        <div style={{ color: colors.darkGray, fontSize: '0.72em', marginTop: 2 }}>
          {helperText}
        </div>
      )}
    </div>
  )

  function renderInput(p: EditableFieldProps) {
    switch (p.type) {
      case 'text':
        return (
          <input
            type="text"
            value={p.value ?? ''}
            disabled={disabled}
            maxLength={p.maxLength}
            onChange={(e) => p.onChange(e.target.value === '' ? null : e.target.value)}
            style={inputStyle(disabled)}
          />
        )

      case 'textarea':
        return (
          <textarea
            value={p.value ?? ''}
            disabled={disabled}
            maxLength={p.maxLength}
            rows={p.rows ?? 3}
            onChange={(e) => p.onChange(e.target.value === '' ? null : e.target.value)}
            style={{ ...inputStyle(disabled), resize: 'vertical' }}
          />
        )

      case 'number':
        return (
          <input
            type="number"
            value={p.value ?? ''}
            disabled={disabled}
            step={p.step}
            min={p.min}
            max={p.max}
            onChange={(e) => {
              const raw = e.target.value
              if (raw === '') return p.onChange(null)
              const n = Number(raw)
              p.onChange(Number.isFinite(n) ? n : null)
            }}
            style={inputStyle(disabled)}
          />
        )

      case 'date': {
        // <input type="date"> wants YYYY-MM-DD; we store epoch ms.
        const iso = p.value ? new Date(p.value).toISOString().slice(0, 10) : ''
        return (
          <input
            type="date"
            value={iso}
            disabled={disabled}
            onChange={(e) => {
              const raw = e.target.value
              if (!raw) return p.onChange(null)
              // Treat as UTC midnight to avoid tz drift in the stored timestamp
              const ms = Date.parse(`${raw}T00:00:00Z`)
              p.onChange(Number.isFinite(ms) ? ms : null)
            }}
            style={inputStyle(disabled)}
          />
        )
      }

      case 'select':
        return (
          <select
            value={p.value ?? ''}
            disabled={disabled}
            onChange={(e) => p.onChange(e.target.value === '' ? null : e.target.value)}
            style={inputStyle(disabled)}
          >
            <option value="">{p.placeholder ?? '— choose —'}</option>
            {p.options.map((opt) => (
              <option key={opt.code} value={opt.code}>
                {opt.name}
              </option>
            ))}
          </select>
        )
    }
  }
}