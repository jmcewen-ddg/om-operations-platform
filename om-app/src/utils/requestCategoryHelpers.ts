import type { DomainMap } from '../services/domainService'

const CATEGORY_DOMAIN = 'request_category'
const SUBCATEGORY_DOMAIN = 'request_subcategory'

export type DomainOption = { code: string; name: string }

/** All category options (code === name for this domain). */
export function getCategoryOptions(domains: DomainMap): DomainOption[] {
  return domains[CATEGORY_DOMAIN] ?? []
}

/**
 * Subcategory options filtered by selected category.
 * Relies on the naming convention: sub.name === `${categoryCode} - ${subLabel}`
 */
export function getSubcategoryOptions(
  domains: DomainMap,
  categoryCode: string | null | undefined,
): DomainOption[] {
  const all = domains[SUBCATEGORY_DOMAIN] ?? []
  if (!categoryCode) return []
  const prefix = `${categoryCode} - `
  return all.filter((s) => s.name.startsWith(prefix))
}

/**
 * Build the request title from category + subcategory.
 * Returns the sub_category.name as-is (already "Category - Subcategory").
 */
export function buildRequestTitle(
  domains: DomainMap,
  subcategoryCode: string | null | undefined,
): string {
  if (!subcategoryCode) return ''
  const all = domains[SUBCATEGORY_DOMAIN] ?? []
  const match = all.find((s) => s.code === subcategoryCode)
  return match?.name ?? ''
}