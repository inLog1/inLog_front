import type { CorporateKindFilter } from './corporate-filters'

export type CorporateTab = 'organizations' | 'personnel'
export type { CorporateKindFilter }

const TABS: readonly CorporateTab[] = ['organizations', 'personnel']
const KINDS: readonly CorporateKindFilter[] = ['all', 'laboratory', 'customer']

export type CorporateLocation = {
  tab: CorporateTab
  query: string
  kind: CorporateKindFilter
  personnelOrg: number | null
  employee: string | null
}

const EMPLOYEE_ID = /^[A-Za-z0-9:_-]{1,80}$/

/**
 * Overview location on the corporation screen.
 * `returnUrl` is ignored: only this closed set of parameters is read back.
 * `personnelOrg` is the card's organization, not the workspace `org` parameter.
 */
export function readCorporateLocation(params: URLSearchParams): CorporateLocation {
  const tab = params.get('corpTab')
  const kind = params.get('corpKind')
  const org = params.get('personnelOrg')
  const employee = params.get('employee')
  const personnelOrg = org != null && /^[1-9]\d*$/.test(org) ? Number(org) : null
  return {
    tab: TABS.includes(tab as CorporateTab) ? tab as CorporateTab : 'organizations',
    query: params.get('corpQ') ?? '',
    kind: KINDS.includes(kind as CorporateKindFilter) ? kind as CorporateKindFilter : 'all',
    personnelOrg: Number.isSafeInteger(personnelOrg) ? personnelOrg : null,
    employee: employee === 'new' || (employee != null && EMPLOYEE_ID.test(employee)) ? employee : null,
  }
}

export function writeCorporateLocation(current: URLSearchParams, patch: Partial<CorporateLocation>): URLSearchParams {
  const next = new URLSearchParams(current)
  const location = { ...readCorporateLocation(current), ...patch }
  next.set('corpTab', location.tab)
  if (location.query.trim()) next.set('corpQ', location.query)
  else next.delete('corpQ')
  if (location.kind === 'all') next.delete('corpKind')
  else next.set('corpKind', location.kind)
  if (location.personnelOrg == null) next.delete('personnelOrg')
  else next.set('personnelOrg', String(location.personnelOrg))
  if (location.employee == null) next.delete('employee')
  else next.set('employee', location.employee)
  next.delete('returnUrl')
  return next
}

/** Workspace selection for one organization. Other organizations' project and editor parameters are not copied. */
export function organizationContextSearch(organizationId: number): string {
  const params = new URLSearchParams()
  params.set('org', String(organizationId))
  return params.toString()
}
