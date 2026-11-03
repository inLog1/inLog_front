export type CorporateKind = 'laboratory' | 'customer'

export type CorporatePersonnelActions = {
  update: boolean
  archive: boolean
  openOrganization: boolean
}

export type CorporateOverviewOrganization = {
  id: number
  fullName: string
  shortName: string
  address: string
  kind: CorporateKind
  revision: number
  canUpdate: boolean
  canDelete: boolean
  /** Null when personnel of this organization cannot be read. Zero is a real empty list. */
  employeeCount: number | null
}

export type CorporateCreateTarget = {
  id: number
  fullName: string
  shortName: string
  kind: CorporateKind
}

export type CorporatePersonnelRow = {
  employeeId: string
  organizationId: number
  revision: number
  name: string
  email: string
  position: string
  /** Null when role names are hidden. An empty list means no assignment is visible. */
  roles: { id: string; displayName: string }[] | null
  organizationName: string
  organizationShortName: string
  organizationKind: CorporateKind
  actions: CorporatePersonnelActions
}

export type CorporateOverview = {
  corporationEmpty: boolean
  createOrganization: boolean
  organizationCount: number
  personnelCount: number
  organizations: CorporateOverviewOrganization[]
  createTargets: CorporateCreateTarget[]
  personnel: CorporatePersonnelRow[]
}

function kindOf(value: unknown): CorporateKind {
  return value === 'customer' ? 'customer' : 'laboratory'
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function positiveId(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null
}

function actionsOf(value: unknown): CorporatePersonnelActions {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  return {
    update: source.update === true,
    archive: source.archive === true,
    openOrganization: source.openOrganization === true,
  }
}

function rolesOf(value: unknown): CorporatePersonnelRow['roles'] {
  if (value == null) return null
  if (!Array.isArray(value)) return null
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const role = item as Record<string, unknown>
    if (typeof role.id !== 'string' || typeof role.displayName !== 'string') return []
    return [{ id: role.id, displayName: role.displayName }]
  })
}

export function parseCorporateOverview(response: unknown): CorporateOverview {
  const source = response && typeof response === 'object' ? response as Record<string, unknown> : {}
  const organizations = Array.isArray(source.organizations) ? source.organizations.flatMap((item): CorporateOverviewOrganization[] => {
    if (!item || typeof item !== 'object') return []
    const row = item as Record<string, unknown>
    const id = positiveId(row.id)
    if (id == null) return []
    const employeeCount = typeof row.employeeCount === 'number' && Number.isInteger(row.employeeCount) && row.employeeCount >= 0
      ? row.employeeCount
      : null
    return [{
      id,
      fullName: text(row.fullName),
      shortName: text(row.shortName),
      address: text(row.address),
      kind: kindOf(row.kind),
      revision: typeof row.revision === 'number' && Number.isInteger(row.revision) && row.revision > 0 ? row.revision : 1,
      canUpdate: row.canUpdate === true,
      canDelete: row.canDelete === true,
      employeeCount,
    }]
  }) : []
  const createTargets = Array.isArray(source.createTargets) ? source.createTargets.flatMap((item): CorporateCreateTarget[] => {
    if (!item || typeof item !== 'object') return []
    const row = item as Record<string, unknown>
    const id = positiveId(row.id)
    if (id == null) return []
    return [{
      id,
      fullName: text(row.fullName),
      shortName: text(row.shortName),
      kind: kindOf(row.kind),
    }]
  }) : []
  const personnel = Array.isArray(source.personnel) ? source.personnel.flatMap((item): CorporatePersonnelRow[] => {
    if (!item || typeof item !== 'object') return []
    const row = item as Record<string, unknown>
    const organizationId = positiveId(row.organizationId)
    if (organizationId == null || typeof row.employeeId !== 'string' || !row.employeeId) return []
    return [{
      employeeId: row.employeeId,
      organizationId,
      revision: typeof row.revision === 'number' && Number.isInteger(row.revision) && row.revision > 0 ? row.revision : 1,
      name: text(row.name),
      email: text(row.email),
      position: text(row.position),
      roles: rolesOf(row.roles),
      organizationName: text(row.organizationName),
      organizationShortName: text(row.organizationShortName),
      organizationKind: kindOf(row.organizationKind),
      actions: actionsOf(row.actions),
    }]
  }) : []
  return {
    corporationEmpty: source.corporationEmpty === true,
    createOrganization: source.createOrganization === true,
    organizationCount: organizations.length,
    personnelCount: personnel.length,
    organizations,
    createTargets,
    personnel,
  }
}
