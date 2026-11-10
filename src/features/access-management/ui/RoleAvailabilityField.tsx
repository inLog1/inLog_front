import { useId, useRef } from 'react'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import type { AccessCreatableScope, AccessScope } from '../../../entities/access'
import { Label } from '../../../shared/ui/label'
import { RadioGroup, RadioGroupItem } from '../../../shared/ui/radio-group'
import { OrganizationMultiSelect } from './OrganizationMultiSelect'
import type { RoleArea } from './role-area'
import { accessOrganizationDisplayName } from './scope-label'

type RoleAvailabilityFieldProps = {
  scopes: readonly AccessCreatableScope[]
  organizations: readonly { id: number; shortName: string }[]
  value: RoleArea
  onChange: (area: RoleArea) => void
  preferredOrganizationId?: number | null
  disabled?: boolean
  locked?: boolean
}

export function RoleAvailabilityField({
  scopes,
  organizations,
  value,
  onChange,
  preferredOrganizationId = null,
  disabled = false,
  locked = false,
}: RoleAvailabilityFieldProps) {
  const { t } = useTranslation()
  const baseId = useId()
  const corporation = scopes.find((item) => item.scope.type === 'corporation') ?? null
  const organizationScopes = organizationChoices(scopes, value)
  const inactive = disabled || locked
  const selectedIds = value.kind === 'organizations'
    ? value.scopes.flatMap((scope) => scope.type === 'organization' ? [scope.organizationId] : [])
    : []
  const lastOrganizationIds = useRef<number[]>(selectedIds.length > 0
    ? selectedIds
    : preferredOrganizationId != null ? [preferredOrganizationId] : [])

  const scopesFor = (ids: readonly number[]): AccessScope[] => {
    const chosen = ids.flatMap((id) => {
      const match = organizationScopes.find((item) => item.scope.type === 'organization' && item.scope.organizationId === id)
      return match ? [match.scope] : []
    })
    return chosen
  }

  const chooseOrganizations = (ids: number[]) => {
    const next = scopesFor(ids.length > 0 ? ids : fallbackIds())
    if (next.length === 0) {
      onChange({ kind: 'organizations', scopes: [] })
      return
    }
    lastOrganizationIds.current = next.flatMap((scope) => scope.type === 'organization' ? [scope.organizationId] : [])
    onChange({ kind: 'organizations', scopes: next })
  }

  const fallbackIds = () => {
    const remembered = lastOrganizationIds.current.filter((id) =>
      organizationScopes.some((item) => item.scope.type === 'organization' && item.scope.organizationId === id),
    )
    if (remembered.length > 0) return remembered
    if (preferredOrganizationId != null && organizationScopes.some((item) => item.scope.type === 'organization' && item.scope.organizationId === preferredOrganizationId)) {
      return [preferredOrganizationId]
    }
    const first = organizationScopes.find((item) => item.scope.type === 'organization')
    return first?.scope.type === 'organization' ? [first.scope.organizationId] : []
  }

  const choose = (next: string) => {
    if (inactive) return
    if (next === 'corporation' && corporation) onChange({ kind: 'corporation', scope: corporation.scope })
    if (next === 'organizations') chooseOrganizations(selectedIds.length > 0 ? selectedIds : fallbackIds())
  }

  const options = organizationScopes.flatMap((item) => {
    if (item.scope.type !== 'organization') return []
    return [{ id: item.scope.organizationId, shortName: organizationName(item.scope, organizations, t) }]
  })

  return (
    <fieldset className="grid min-w-0 gap-3" disabled={disabled}>
      <legend className="text-sm">{t('access.availability.title')}</legend>
      {locked ? <p className="text-sm text-foreground">{t('access.availability.locked')}</p> : null}
      <RadioGroup value={value.kind} onValueChange={choose} disabled={inactive} className="gap-3">
        <div className="grid gap-1">
          <div className="flex items-start gap-2">
            <RadioGroupItem
              value="corporation"
              id={`${baseId}-corporation`}
              disabled={inactive || !corporation}
              className="mt-0.5"
            />
            <Label htmlFor={`${baseId}-corporation`} className="font-normal">
              {t('access.availability.corporation')}
            </Label>
          </div>
          <p className="pl-6 text-xs text-muted-foreground">{t('access.availability.corporation-help')}</p>
          {!corporation ? <p className="pl-6 text-xs text-muted-foreground">{t('access.availability.corporation-denied')}</p> : null}
        </div>
        <div className="grid gap-2">
          <div className="flex items-start gap-2">
            <RadioGroupItem
              value="organizations"
              id={`${baseId}-organizations`}
              disabled={inactive || organizationScopes.length === 0}
              className="mt-0.5"
            />
            <Label htmlFor={`${baseId}-organizations`} className="font-normal">
              {t('access.availability.organization')}
            </Label>
          </div>
          <div className="grid gap-1.5 pl-6">
            {organizationScopes.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t('access.availability.no-organization')}</p>
            ) : (
              <OrganizationMultiSelect
                options={options}
                value={value.kind === 'organizations' ? selectedIds : []}
                disabled={inactive}
                onChange={(ids) => {
                  lastOrganizationIds.current = ids
                  onChange({ kind: 'organizations', scopes: scopesFor(ids) })
                }}
              />
            )}
            {organizationScopes.length > 0 ? (
              <p className="text-xs text-muted-foreground">
                {value.kind === 'organizations' && selectedIds.length === 0
                  ? t('access.availability.choose-at-least-one')
                  : t('access.availability.organization-help')}
              </p>
            ) : null}
          </div>
        </div>
      </RadioGroup>
    </fieldset>
  )
}

function organizationChoices(scopes: readonly AccessCreatableScope[], value: RoleArea): AccessCreatableScope[] {
  const organizations = scopes.filter((item) => item.scope.type === 'organization')
  if (value.kind !== 'organizations') return organizations
  const missing = value.scopes.filter((scope) =>
    scope.type === 'organization'
    && !organizations.some((item) => item.scope.type === 'organization' && item.scope.organizationId === scope.organizationId),
  )
  return [
    ...missing.map((scope) => ({ scope, delegableGrantIds: [] as string[], canDelegateFurther: false })),
    ...organizations,
  ]
}

function organizationName(
  scope: AccessScope,
  organizations: readonly { id: number; shortName: string; fullName?: string }[],
  t: TFunction,
): string {
  if (scope.type !== 'organization') return ''
  return accessOrganizationDisplayName(
    organizations.find((item) => item.id === scope.organizationId),
    scope.organizationId,
    t,
  )
}
