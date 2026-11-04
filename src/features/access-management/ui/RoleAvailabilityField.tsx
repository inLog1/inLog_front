import { useId, useRef } from 'react'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import type { AccessCreatableScope, AccessScope } from '../../../entities/access'
import { Label } from '../../../shared/ui/label'
import { RadioGroup, RadioGroupItem } from '../../../shared/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../shared/ui/select'
import { scopeKey } from './scope-label'

type RoleAvailabilityFieldProps = {
  scopes: readonly AccessCreatableScope[]
  organizations: readonly { id: number; shortName: string }[]
  value: AccessScope | null
  onChange: (scope: AccessScope) => void
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
  const kind = value?.type === 'corporation' ? 'corporation' : value?.type === 'organization' ? 'organization' : ''
  const selectedOrgKey = value?.type === 'organization' ? scopeKey(value) : ''
  const inactive = disabled || locked
  const lastOrganizationId = useRef<number | null>(value?.type === 'organization' ? value.organizationId : null)

  const chooseOrganization = (organizationId: number | null) => {
    const current = organizationId == null
      ? undefined
      : organizationScopes.find((item) => item.scope.type === 'organization' && item.scope.organizationId === organizationId)
    const fallback = current ?? organizationScopes[0]
    if (!fallback || fallback.scope.type !== 'organization') return
    lastOrganizationId.current = fallback.scope.organizationId
    onChange(fallback.scope)
  }

  const choose = (next: string) => {
    if (inactive) return
    if (next === 'corporation' && corporation) onChange(corporation.scope)
    if (next === 'organization') chooseOrganization(lastOrganizationId.current ?? preferredOrganizationId)
  }

  return (
    <fieldset className="grid min-w-0 gap-3" disabled={disabled}>
      <legend className="text-sm">{t('access.availability.title')}</legend>
      {locked ? <p className="text-sm text-foreground">{t('access.availability.locked')}</p> : null}
      <RadioGroup value={kind || undefined} onValueChange={choose} disabled={inactive} className="gap-3">
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
              value="organization"
              id={`${baseId}-organization`}
              disabled={inactive || organizationScopes.length === 0}
              className="mt-0.5"
            />
            <Label htmlFor={`${baseId}-organization`} className="font-normal">
              {t('access.availability.organization')}
            </Label>
          </div>
          <div className="pl-6">
            {organizationScopes.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t('access.availability.no-organization')}</p>
            ) : (
              <Select
                value={kind === 'organization' && selectedOrgKey ? selectedOrgKey : undefined}
                disabled={inactive || kind !== 'organization'}
                onValueChange={(key) => {
                  const match = organizationScopes.find((item) => scopeKey(item.scope) === key)
                  if (match?.scope.type === 'organization') chooseOrganization(match.scope.organizationId)
                }}
              >
                <SelectTrigger aria-label={t('access.availability.organization-placeholder')}>
                  <SelectValue placeholder={t('access.availability.organization-placeholder')} />
                </SelectTrigger>
                <SelectContent>
                  {organizationScopes.map((item) => (
                    <SelectItem key={scopeKey(item.scope)} value={scopeKey(item.scope)}>
                      {organizationName(item.scope, organizations, t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      </RadioGroup>
    </fieldset>
  )
}

function organizationChoices(scopes: readonly AccessCreatableScope[], value: AccessScope | null): AccessCreatableScope[] {
  const organizations = scopes.filter((item) => item.scope.type === 'organization')
  if (value?.type !== 'organization') return organizations
  if (organizations.some((item) => scopeKey(item.scope) === scopeKey(value))) return organizations
  return [{ scope: value, delegableGrantIds: [], canDelegateFurther: false }, ...organizations]
}

function organizationName(
  scope: AccessScope,
  organizations: readonly { id: number; shortName: string }[],
  t: TFunction,
): string {
  if (scope.type !== 'organization') return ''
  return organizations.find((item) => item.id === scope.organizationId)?.shortName
    ?? t('access.scope.organization', { id: scope.organizationId })
}
