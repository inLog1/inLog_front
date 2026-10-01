/** Role inside one organization or one project. Separate from the platform role. */
export type MembershipRole = 'admin' | 'user'

export type OrganizationCapability =
  | 'rename-organization'
  | 'delete-project'
  | 'remove-member'

export type ProjectCapability =
  | 'rename-project'
  | 'remove-member'

const ORGANIZATION_ADMIN_CAPABILITIES: OrganizationCapability[] = [
  'rename-organization',
  'delete-project',
  'remove-member',
]

const PROJECT_ADMIN_CAPABILITIES: ProjectCapability[] = [
  'rename-project',
  'remove-member',
]

function asMembershipRole(role?: string | null): MembershipRole | undefined {
  if (role === 'admin' || role === 'user') return role
  return undefined
}

/**
 * Until the API returns a membership role, keep the current actions available.
 * When the role is `admin` or `user`, only an organization admin gets these actions.
 */
export function canManageOrganization(
  role: string | null | undefined,
  capability: OrganizationCapability,
) {
  const membership = asMembershipRole(role)
  if (!membership) return true
  return membership === 'admin' && ORGANIZATION_ADMIN_CAPABILITIES.includes(capability)
}

/** Project admin gets the same kinds of actions, limited to that project. */
export function canManageProject(
  role: string | null | undefined,
  capability: ProjectCapability,
) {
  const membership = asMembershipRole(role)
  if (!membership) return true
  return membership === 'admin' && PROJECT_ADMIN_CAPABILITIES.includes(capability)
}
