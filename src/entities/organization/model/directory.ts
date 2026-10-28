/** Minimum label for a project or a create target when organizations.read is absent. */
export type OrganizationContextMinimum = {
  id: number
  shortName: string
}

export type DirectoryOrganization = {
  id: number
  fullName: string
  shortName: string
  address: string
  kind: 'laboratory' | 'customer'
  revision: number
  canUpdate: boolean
}

export type DirectoryProject = {
  id: number
  name: string
  reservoir: string
  organizationId: number
  revision: number
  canUpdate: boolean
  organization: OrganizationContextMinimum
}

export type OrganizationDirectory = {
  /** True only when the installation has no organizations. It is not a count. */
  corporationEmpty: boolean
  /** True when organizations exist and none of them are readable. The count is not included. */
  organizationsHidden: boolean
  createOrganization: boolean
  organizations: DirectoryOrganization[]
  projects: DirectoryProject[]
  projectCreateTargets: OrganizationContextMinimum[]
  projectsConcealedOrganizationIds: number[]
}

type WireDirectory = {
  corporation_empty?: boolean
  organizations_hidden?: boolean
  create_organization?: boolean
  organizations?: Array<{
    id: number
    full_name?: string
    short_name?: string
    address?: string
    kind?: 'laboratory' | 'customer'
    revision?: number
    can_update?: boolean
  }>
  projects?: Array<{
    id: number
    name?: string
    reservoir?: string
    organization_id: number
    revision?: number
    can_update?: boolean
    organization?: { id: number; short_name?: string }
  }>
  project_create_targets?: Array<{ id: number; short_name?: string }>
  projects_concealed_organization_ids?: number[]
}

export function directoryFromWire(response: WireDirectory | null | undefined): OrganizationDirectory {
  const source = response ?? {}
  return {
    corporationEmpty: source.corporation_empty === true,
    organizationsHidden: source.organizations_hidden === true,
    createOrganization: source.create_organization === true,
    organizations: (source.organizations ?? []).map((item) => ({
      id: item.id,
      fullName: item.full_name ?? '',
      shortName: item.short_name ?? '',
      address: item.address ?? '',
      kind: item.kind === 'customer' ? 'customer' : 'laboratory',
      revision: item.revision ?? 1,
      canUpdate: item.can_update === true,
    })),
    projects: (source.projects ?? []).map((item) => ({
      id: item.id,
      name: item.name ?? '',
      reservoir: item.reservoir ?? '',
      organizationId: item.organization_id,
      revision: item.revision ?? 1,
      canUpdate: item.can_update === true,
      organization: {
        id: item.organization?.id ?? item.organization_id,
        shortName: item.organization?.short_name ?? '',
      },
    })),
    projectCreateTargets: (source.project_create_targets ?? []).map((item) => ({
      id: item.id,
      shortName: item.short_name ?? '',
    })),
    projectsConcealedOrganizationIds: source.projects_concealed_organization_ids ?? [],
  }
}
