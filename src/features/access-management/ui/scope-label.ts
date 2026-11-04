import type { TFunction } from 'i18next'
import type { AccessScope } from '../../../entities/access'

export function scopeKey(scope: AccessScope): string {
  if (scope.type === 'corporation') return `corporation:${scope.corporationId}`
  if (scope.type === 'organization') return `organization:${scope.corporationId}:${scope.organizationId}`
  if (scope.type === 'project') return `project:${scope.corporationId}:${scope.organizationId}:${scope.projectId}`
  return `own:${scope.userId}`
}

export function roleDefinitionLabel(
  scope: AccessScope,
  organizations: readonly { id: number; shortName: string }[],
  t: TFunction,
): string {
  if (scope.type === 'corporation') return t('access.scope.all-organizations')
  if (scope.type === 'organization') {
    return organizations.find((item) => item.id === scope.organizationId)?.shortName
      ?? t('access.scope.organization', { id: scope.organizationId })
  }
  return scopeLabel(scope, organizations, [], t)
}

export function scopeLabel(
  scope: AccessScope,
  organizations: readonly { id: number; shortName: string }[],
  projects: readonly { id: number; name: string }[],
  t: TFunction,
): string {
  if (scope.type === 'corporation') return t('access.scope.corporation')
  if (scope.type === 'organization') {
    return organizations.find((item) => item.id === scope.organizationId)?.shortName
      ?? t('access.scope.organization', { id: scope.organizationId })
  }
  if (scope.type === 'project') {
    return projects.find((item) => item.id === scope.projectId)?.name
      ?? t('access.scope.project', { id: scope.projectId })
  }
  return t('access.scope.own')
}
