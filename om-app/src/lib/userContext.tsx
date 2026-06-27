/**
 * User identity context for the OM Operations Platform.
 *
 * Loads the current user once via getCurrentUser() and provides them
 * to the rest of the tree. Today getCurrentUser() returns a stub; when
 * real Portal SSO + app user store lands, only that function changes —
 * every consumer of useUser() keeps working unchanged.
 *
 * Why a context instead of calling getCurrentUser() per component:
 *   - getCurrentUser() is async; calling it per-render is awkward and
 *     creates inconsistent renders across the tree.
 *   - Most components need the user synchronously to decide visibility,
 *     gating, etc. A context provides that.
 *   - Centralizing the load lets the provider own the loading + error UI,
 *     so consumers can always assume "user is ready."
 */


import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { getCurrentUser, type CurrentUser, type Role } from './roles'
import { colors } from '../theme'


// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

/**
 * Internal context value. Consumers don't see this directly — they go
 * through useUser() / useUserOrNull(), which unwrap to a plain CurrentUser.
 */
type UserContextValue =
  | { state: 'loading' }
  | { state: 'error'; error: Error }
  | {
      state: 'ready'
      /** The real signed-in user, untouched by any override. */
      actualUser: CurrentUser
      /**
       * The user as the rest of the app should see them. When a role
       * override is active (dev/UAT only), `effectiveUser.role` is the
       * overridden role; otherwise it equals `actualUser`.
       *
       * Consumers calling useUser() get this — so existing permission
       * checks (can(user.role, ...), atLeast(user.role, ...)) automatically
       * respect the override with no call-site changes.
       */
      effectiveUser: CurrentUser
      /** Current override, or null when not overriding. */
      roleOverride: Role | null
      /** Set or clear the override. Pass null to clear. */
      setRoleOverride: (role: Role | null) => void
    }

const UserContext = createContext<UserContextValue | null>(null)

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

type UserProviderProps = {
  children: ReactNode
  /** Optional: render this while loading. Default: a centered "Loading…" message. */
  loadingFallback?: ReactNode
  /** Optional: render this on error. Default: a centered error message with retry hint. */
  errorFallback?: (error: Error, retry: () => void) => ReactNode
}

/**
 * Loads the current user once on mount, then provides them to the tree.
 * Renders its own loading/error fallbacks so children can assume "ready."
 *
 * Wrap your app root in <UserProvider>...</UserProvider>.
 */
export function UserProvider({
  children,
  loadingFallback,
  errorFallback,
}: UserProviderProps) {
// Inner state: just the load result. We split out override into its
  // own state so toggling the override doesn't re-fire the load effect.
  type LoadState =
    | { state: 'loading' }
    | { state: 'error'; error: Error }
    | { state: 'ready'; actualUser: CurrentUser }

  const [load, setLoad] = useState<LoadState>({ state: 'loading' })
  const [roleOverride, setRoleOverrideState] = useState<Role | null>(null)

  // Reload key — incrementing forces the effect to re-run, used by the
  // error-state retry button.
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoad({ state: 'loading' })
    getCurrentUser()
      .then((user) => {
        if (!cancelled) setLoad({ state: 'ready', actualUser: user })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const error =
          err instanceof Error ? err : new Error(String(err ?? 'Unknown error'))
        setLoad({ state: 'error', error })
      })
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  // Stable setter for the override. Memoized so context consumers
  // don't re-render just because the provider re-rendered.
  const setRoleOverride = useCallback((role: Role | null) => {
    setRoleOverrideState(role)
  }, [])

  // Build the public context value. effectiveUser is the actual user
  // with role swapped when an override is active.
  const value: UserContextValue = useMemo(() => {
    if (load.state === 'loading') return { state: 'loading' }
    if (load.state === 'error') return { state: 'error', error: load.error }
    const effectiveUser: CurrentUser =
      roleOverride === null
        ? load.actualUser
        : { ...load.actualUser, role: roleOverride }
    return {
      state: 'ready',
      actualUser: load.actualUser,
      effectiveUser,
      roleOverride,
      setRoleOverride,
    }
  }, [load, roleOverride, setRoleOverride])

  if (value.state === 'loading') {
    return <>{loadingFallback ?? <DefaultLoadingFallback />}</>
  }

  if (value.state === 'error') {
    const retry = () => setReloadKey((k) => k + 1)
    return (
      <>
        {errorFallback?.(value.error, retry) ?? (
          <DefaultErrorFallback error={value.error} onRetry={retry} />
        )}
      </>
    )
  }

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Returns the current user. Throws if called outside a <UserProvider>,
 * which catches integration bugs at dev time rather than silently returning
 * undefined.
 *
 * The provider only renders children when state === 'ready', so this hook
 * is always safe to call unconditionally inside the tree — no loading
 * checks needed at the call site.
 */
export function useUser(): CurrentUser {
  const ctx = useContext(UserContext)
  if (ctx === null) {
    throw new Error(
      'useUser() must be called inside a <UserProvider>. ' +
        'Wrap your app root with <UserProvider>...</UserProvider>.',
    )
  }
  // Provider only mounts children once state === 'ready'. This invariant
  // is enforced above and is the reason useUser() can return a plain
  // CurrentUser instead of a discriminated union.
  if (ctx.state !== 'ready') {
    throw new Error(
      `useUser() called while context state is "${ctx.state}". ` +
        'This should never happen — provider should not render children ' +
        'in loading/error states.',
    )
  }
  return ctx.effectiveUser
}

/**
 * Variant that returns null instead of throwing. Useful for components
 * that legitimately need to render before the user is available
 * (rare — most components should use useUser()).
 */
export function useUserOrNull(): CurrentUser | null {
  const ctx = useContext(UserContext)
  if (ctx === null || ctx.state !== 'ready') return null
  return ctx.effectiveUser
}
/**
 * Returns the *actual* signed-in user, ignoring any dev/UAT role override.
 * Use this only when you specifically need the real identity — e.g., the
 * RoleSwitcher displaying "actual role: superAdmin", or audit logging.
 * For permission checks, use useUser().
 */
export function useActualUser(): CurrentUser {
  const ctx = useContext(UserContext)
  if (ctx === null) {
    throw new Error(
      'useActualUser() must be called inside a <UserProvider>.',
    )
  }
  if (ctx.state !== 'ready') {
    throw new Error(
      `useActualUser() called while context state is "${ctx.state}".`,
    )
  }
  return ctx.actualUser
}

/**
 * Returns the current role override (or null) and a setter to change it.
 * Intended for the dev/UAT RoleSwitcher — production code shouldn't need this.
 *
 * The override lives in React state only, so a page refresh always
 * resets to the actual signed-in user's role.
 */
export function useRoleOverride(): {
  roleOverride: Role | null
  setRoleOverride: (role: Role | null) => void
} {
  const ctx = useContext(UserContext)
  if (ctx === null) {
    throw new Error(
      'useRoleOverride() must be called inside a <UserProvider>.',
    )
  }
  if (ctx.state !== 'ready') {
    throw new Error(
      `useRoleOverride() called while context state is "${ctx.state}".`,
    )
  }
  return { roleOverride: ctx.roleOverride, setRoleOverride: ctx.setRoleOverride }
}

// ---------------------------------------------------------------------------
// Default fallbacks
// ---------------------------------------------------------------------------

function DefaultLoadingFallback() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        color: colors.darkGray,
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      Loading user…
    </div>
  )
}

function DefaultErrorFallback({
  error,
  onRetry,
}: {
  error: Error
  onRetry: () => void
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        gap: '0.75rem',
        color: colors.darkestGray,
        fontFamily: 'system-ui, sans-serif',
        padding: '1rem',
        textAlign: 'center',
      }}
    >
      <div style={{ fontWeight: 700 }}>Couldn't load your user.</div>
      <div style={{ color: colors.darkGray, maxWidth: 480, fontSize: '0.9em' }}>
        {error.message}
      </div>
      <button
        type="button"
        onClick={onRetry}
        style={{
          background: colors.blue,
          color: colors.white,
          border: 'none',
          borderRadius: 4,
          padding: '0.4rem 0.9rem',
          cursor: 'pointer',
          fontWeight: 600,
        }}
      >
        Retry
      </button>
    </div>
  )
}