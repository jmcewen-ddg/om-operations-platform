// src/theme.ts
export const colors = {
  white:        '#FFFFFF',
  green:        '#C1D52F',
  darkestGray:  '#474B4F',
  darkGray:     '#7C7B7A',
  gray:         '#C1C5C8',
  lightGray:    '#D3D4CF',
  lightestGray: '#F6F6F6',
  blue:         '#2B7194',
  orange:       '#FFAC0F',
} as const

// Reusable style objects so we don't repeat ourselves
export const styles = {
  page: {
    padding: '1.5rem',
    fontFamily: 'sans-serif',
    background: colors.lightestGray,
    color: colors.darkestGray,
    minHeight: '250vh',
    lineHeight: '3rem'
  } as const,

  card: {
    background: colors.white,
    border: `1px solid ${colors.lightGray}`,
    borderRadius: 6,
    padding: '1rem',
    marginBottom: '0.75rem',
  } as const,

  sectionHeader: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    lineHeight: '1.5rem',
    gap: 12,
    margin: '1.5rem 0 0.75rem',
  } as const,

  h2: {
    margin: 0,
    lineHeight: '1.5rem',
    color: colors.darkestGray,
  } as const,

  h1: {
  margin: 0,
  color: colors.darkestGray,
  textAlign: 'center'
  , lineHeight: '3rem'
} as const,

  primaryButton: {
    background: colors.blue,
    color: colors.white,
    border: 'none',
    borderRadius: 4,
    padding: '0.4rem 0.9rem',
    cursor: 'pointer',
    fontWeight: 600,
  } as const,

  secondaryButton: {
    background: colors.white,
    color: colors.darkestGray,
    border: `1px solid ${colors.gray}`,
    borderRadius: 4,
    padding: '0.3rem 0.7rem',
    cursor: 'pointer',
  } as const,

  successButton: {
    background: colors.green,
    color: colors.darkestGray,
    border: 'none',
    borderRadius: 4,
    padding: '0.5rem 1rem',
    cursor: 'pointer',
    fontWeight: 600,
  } as const,

  disabledButton: {
    background: colors.lightGray,
    color: colors.darkGray,
    border: 'none',
    borderRadius: 4,
    padding: '0.5rem 1rem',
    cursor: 'not-allowed',
  } as const,

  lastUpdated: {
    textAlign: 'center' as const,
    color: colors.darkGray,
    fontSize: '0.85em',
    marginBottom: '1rem',
    fontWeight: '600'
  },

  errorBanner: {
    background: '#fdecea',
    border: `1px solid ${colors.orange}`,
    color: colors.darkestGray,
    padding: '0.5rem 0.75rem',
    borderRadius: 4,
    marginBottom: '0.75rem',
  },

  warningText: {
    color: colors.orange,
    marginTop: '0.5rem',
    fontSize: '0.9em',
  },
}