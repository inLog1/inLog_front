import type { TFunction } from 'i18next'
import type { AccessScope } from '../../../entities/access'
import type { AccessOrganizationOption } from '../../../entities/access/model/directory'

export type AccessOrganizationLabel = Pick<AccessOrganizationOption, 'shortName' | 'fullName'>

export function accessOrganizationDisplayName(
  organization: AccessOrganizationLabel | undefined,
  id: number,
  t: TFunction,
): string {
  if (!organization) return t('access.scope.organization', { id })
  const fullName = organization.fullName?.trim()
  const shortName = organization.shortName?.trim()
  return fullName || shortName || t('access.scope.organization', { id })
}

export function scopeKey(scope: AccessScope): string {
  if (scope.type === 'corporation') return `corporation:${scope.corporationId}`
  if (scope.type === 'organization') return `organization:${scope.corporationId}:${scope.organizationId}`
  if (scope.type === 'project') return `project:${scope.corporationId}:${scope.organizationId}:${scope.projectId}`
  return `own:${scope.userId}`
}

export function roleDefinitionLabel(
  scope: AccessScope,
  organizations: readonly AccessOrganizationOption[],
  t: TFunction,
  organizationIds: readonly number[] = [],
): string {
  if (scope.type === 'corporation') return t('access.scope.all-organizations')
  if (scope.type === 'organization' || scope.type === 'project') {
    const ids = organizationIds.length > 0 ? organizationIds : [scope.organizationId]
    const names = ids.map((id) => accessOrganizationDisplayName(
      organizations.find((item) => item.id === id),
      id,
      t,
    ))
    return names.join(', ')
  }
  return scopeLabel(scope, organizations, [], t)
}

export function scopeLabel(
  scope: AccessScope,
  organizations: readonly AccessOrganizationOption[],
  projects: readonly { id: number; name: string }[],
  t: TFunction,
): string {
  if (scope.type === 'corporation') return t('access.scope.corporation')
  if (scope.type === 'organization') {
    return accessOrganizationDisplayName(
      organizations.find((item) => item.id === scope.organizationId),
      scope.organizationId,
      t,
    )
  }
  if (scope.type === 'project') {
    return projects.find((item) => item.id === scope.projectId)?.name
      ?? t('access.scope.project', { id: scope.projectId })
  }
  return t('access.scope.own')
}
