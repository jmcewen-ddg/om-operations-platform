/**
 * RoleSwitcher — dev/UAT-only UI affordance for impersonating other roles.
 *
 * Renders an anchored panel in the top-left of the viewport with one button
 * per Role. The currently effective role is highlighted; clicking another
 * role calls setRoleOverride() on UserContext, which flips effectiveUser.role
 * and triggers a re-render so every can() / atLeast() check in the tree
 * reflects the new perspective.
 *
 * Gated by VITE_ROLE_SWITCHER. When the flag is anything other than the
 * literal string "true" at build time, the component short-circuits to
 * null and the minifier tree-shakes the rest out of the bundle.
 *
 * Override lives in React state only — a page refresh wipes it, which is
 * intentional: testers should always start from their real identity.
 *
 * NOT a security boundary. The override only changes what the UI shows;
 * real authorization lives server-side (SQL triggers, feature service
 * permissions, etc.). See the Step 3 discussion in the project notes
 * for the threat-model rationale.
 */

import { useActualUser, useRoleOverride, useUser } from '../../lib/userContext'
import type { Role } from '../../lib/roles'
import { colors } from '../../theme'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

/**
 * Display order + labels for every role. Order is intentional: internal
 * roles first (descending privilege), then external credentialed, then
 * anonymous. Matches the mental model in FIELD_EDIT_MATRIX.md.
 */
const ROLES: ReadonlyArray<{ role: Role; label: string }> = [
  { role: 'superAdmin',     label: 'Super Admin' },
  { role: 'programAdmin',   label: 'Program Admin' },
  { role: 'tier2Triager',   label: 'Tier 2 Triager' },
  { role: 'tier1Triager',   label: 'Tier 1 Triager' },
  // Hidden from the switcher for now — these roles won't be users of
  // the internal app in the foreseeable future. Leave the entries in
  // ROLE_COLORS / ROLE_TEXT_COLORS / the Role type so re-enabling is
  // just uncommenting these lines.
  // { role: 'fieldInspector', label: 'Field Inspector' },
  { role: 'designer',       label: 'Designer' },
  { role: 'contractor',     label: 'Contractor' },
  // { role: 'fieldReporter',  label: 'Field Reporter' },
  // { role: 'public',         label: 'Public' },
]

/**
 * Per-role button background. Deterministic so testers build muscle memory
 * (e.g., "the blue one is always Tier 2"). All colors come from the brand
 * palette in theme.ts.
 */
const ROLE_COLORS: Record<Role, string> = {
  superAdmin:     colors.darkestGray,
  programAdmin:   colors.blue,
  tier2Triager:   colors.orange,
  tier1Triager:   colors.darkGray,
  fieldInspector: colors.gray,
  designer:       colors.blue,
  contractor:     colors.orange,
  fieldReporter:  colors.darkGray,
  public:         colors.lightGray,
}

/** Text color for each role button — picked for contrast against ROLE_COLORS. */
const ROLE_TEXT_COLORS: Record<Role, string> = {
  superAdmin:     colors.white,
  programAdmin:   colors.white,
  tier2Triager:   colors.darkestGray,
  tier1Triager:   colors.white,
  fieldInspector: colors.darkestGray,
  designer:       colors.white,
  contractor:     colors.darkestGray,
  fieldReporter:  colors.white,
  public:         colors.darkestGray,
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RoleSwitcher() {
  // Hard gate: env flag must be the literal string "true". When false,
  // this early return is statically dead and the rest of the module gets
  // tree-shaken out of the production bundle.
  if (import.meta.env.VITE_ROLE_SWITCHER !== 'true') return null

  const effectiveUser = useUser()
  const actualUser = useActualUser()
  const { roleOverride, setRoleOverride } = useRoleOverride()

  const isOverriding = roleOverride !== null
  const activeRole = effectiveUser.role

  return (
    <div style={panelStyle} role="region" aria-label="Role switcher (dev/UAT only)">
      <div style={headerStyle}>Role Switcher</div>

      <div style={buttonColumnStyle}>
        {ROLES.map(({ role, label }) => {
          const isActive = role === activeRole
          return (
            <button
              key={role}
              type="button"
              onClick={() => {
                // Clicking the actual role clears the override rather than
                // setting a redundant one. Keeps "is overriding?" honest.
                if (role === actualUser.role) setRoleOverride(null)
                else setRoleOverride(role)
              }}
              style={{
                ...roleButtonBase,
                background: isActive ? colors.green : ROLE_COLORS[role],
                color: isActive ? colors.darkestGray : ROLE_TEXT_COLORS[role],
                fontWeight: isActive ? 800 : 600,
                outline: isActive ? `2px solid ${colors.darkestGray}` : 'none',
                cursor: isActive ? 'default' : 'pointer',
              }}
              aria-pressed={isActive}
              title={isActive ? `Currently viewing as ${label}` : `Switch to ${label}`}
            >
              {label}
            </button>
          )
        })}
      </div>

      {isOverriding && (
        <button
          type="button"
          onClick={() => setRoleOverride(null)}
          style={resetButtonStyle}
          title={`Revert to your real role (${actualUser.role})`}
        >
          Reset to actual
        </button>
      )}

<div style={footerStyle}>
        {isOverriding ? (
          <>
            <div>Impersonating.</div>
            <div>Actual: <strong>{actualUser.role}</strong></div>
          </>
        ) : (
          <>Actual role</>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Styles (kept local — this is a dev tool, doesn't need to live in theme.ts)
// ---------------------------------------------------------------------------

const panelStyle: React.CSSProperties = {
  position: 'fixed',
  top: 12,
  left: 12,
  zIndex: 9999, // float over the sticky page header (zIndex 100)
  background: colors.white,
  border: `2px dashed ${colors.orange}`,
  borderRadius: 6,
  padding: '0.6rem 0.7rem',
  boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
  fontFamily: 'system-ui, sans-serif',
  fontSize: '0.8rem',
  minHeight: 300,
  minWidth: 200,
}

const headerStyle: React.CSSProperties = {
  fontWeight: 800,
  fontSize: '0.75rem',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: colors.darkestGray,
  marginBottom: '0.5rem',
  textAlign: 'center',
}

const buttonColumnStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
}

const roleButtonBase: React.CSSProperties = {
  border: 'none',
  borderRadius: 4,
  padding: '0.3rem 0.5rem',
  fontSize: '0.78rem',
  textAlign: 'center',
  transition: 'transform 0.05s ease-in-out',
}

const resetButtonStyle: React.CSSProperties = {
  marginTop: 6,
  width: '100%',
  background: 'transparent',
  border: `1px solid ${colors.darkGray}`,
  color: colors.darkestGray,
  borderRadius: 4,
  padding: '0.25rem 0.5rem',
  fontSize: '0.75rem',
  cursor: 'pointer',
}

const footerStyle: React.CSSProperties = {
  marginTop: 6,
  fontSize: '0.7rem',
  color: colors.darkGray,
  textAlign: 'center',
}
