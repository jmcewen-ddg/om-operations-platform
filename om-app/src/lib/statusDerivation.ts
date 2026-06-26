/**
 * Generic status-derivation machinery.
 *
 * Domain modules (domain/request/requestStatus.ts,
 * domain/workOrder/workOrderStatus.ts) supply ordered rule lists; this
 * module supplies the evaluator.
 *
 * The pattern:
 *   - Each rule is a (when, then) pair: a predicate over some context
 *     and the status to return if the predicate passes.
 *   - Rules are evaluated in order. First match wins. This is why the
 *     domain modules order their rules carefully (most-specific first,
 *     fallback last).
 *   - If no rule matches, the fallback is returned. The fallback is
 *     the "I have no opinion" answer — usually the input's current status.
 *
 * Pure functions. No I/O, no side effects, no awareness of React or ArcGIS.
 * Safe to call from anywhere — render paths, save handlers, tests.
 */

export type DerivationRule<Ctx, Status> = {
  /** Short label for debugging / logs. */
  name: string
  /** True if this rule applies to the given context. */
  when: (ctx: Ctx) => boolean
  /** The status to assign if `when` returns true. */
  then: Status
}

/**
 * Walk the rules in order, return the `then` of the first whose `when`
 * passes. If none pass, return `fallback`.
 */
export function deriveStatus<Ctx, Status>(
  rules: ReadonlyArray<DerivationRule<Ctx, Status>>,
  ctx: Ctx,
  fallback: Status,
): Status {
  for (const rule of rules) {
    if (rule.when(ctx)) return rule.then
  }
  return fallback
}

/**
 * Debug variant: returns both the derived status and the name of the
 * rule that fired (or null for fallback). Useful in dev tools / logs.
 */
export function deriveStatusWithTrace<Ctx, Status>(
  rules: ReadonlyArray<DerivationRule<Ctx, Status>>,
  ctx: Ctx,
  fallback: Status,
): { status: Status; firedRule: string | null } {
  for (const rule of rules) {
    if (rule.when(ctx)) return { status: rule.then, firedRule: rule.name }
  }
  return { status: fallback, firedRule: null }
}