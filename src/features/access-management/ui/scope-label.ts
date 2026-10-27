import type { TFunction } from 'i18next'
import type { AccessScope } from '../../../entities/access'

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
