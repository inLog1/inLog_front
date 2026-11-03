import type { CorporateKind, CorporateOverviewOrganization, CorporatePersonnelRow } from '../../../entities/personnel/model/overview'

export type CorporateKindFilter = 'all' | 'laboratory' | 'customer'

export function matchesKind(kind: CorporateKind, filter: CorporateKindFilter): boolean {
  return filter === 'all' || kind === filter
}

function includes(value: string, needle: string): boolean {
  return value.toLowerCase().includes(needle)
}

export function organizationVisible(organization: CorporateOverviewOrganization, query: string, kind: CorporateKindFilter): boolean {
  if (!matchesKind(organization.kind, kind)) return false
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  return includes(organization.fullName, needle)
    || includes(organization.shortName, needle)
    || includes(organization.address, needle)
}

export function personnelVisible(row: CorporatePersonnelRow, query: string, kind: CorporateKindFilter): boolean {
  if (!matchesKind(row.organizationKind, kind)) return false
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  const roles = row.roles?.map((role) => role.displayName).join(' ') ?? ''
  return includes(row.name, needle)
    || includes(row.email, needle)
    || includes(row.position, needle)
    || includes(row.department, needle)
    || includes(roles, needle)
    || includes(row.organizationName, needle)
    || includes(row.organizationShortName, needle)
}
