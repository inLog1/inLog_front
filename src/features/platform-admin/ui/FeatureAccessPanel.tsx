import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import type { AppDispatch } from '../../../app/store/store'
import {
  platformAdminApi,
  useCreateAdminFeatureProfileMutation,
  useGetAdminFeatureProfilesQuery,
  useGetAdminFeaturesQuery,
  useGetAdminUsersQuery,
  useUpdateAdminFeatureProfileMutation,
} from '../../../entities/platform-admin/model/platformAdminSlice'
import type { AdminUser, FeatureProfile } from '../../../entities/platform-admin/model/types'
import { selectUser } from '../../../entities/user/model/selectors'
import { errorsHandler } from '../../../shared/lib/errors-handler'
import { cn } from '../../../shared/lib/utils'
import { Button } from '../../../shared/ui/button'
import { Card } from '../../../shared/ui/card'
import { Switch } from '../../../shared/ui/switch'
import {
  bulkAudiencesForActor,
  isInBulkAudience,
  type BulkAudience,
} from '../model/featureAccessPolicy'
import {
  AUDIENCE_PROFILE_NAMES,
  readUserFeatures,
  syncFeatureAssignments,
  toggledFeatureMap,
  uniformFeatureMap,
} from '../model/featureProfileActions'
import { featureHintKey, featureIcon, orderFeatureKeys } from './featureAccessMeta'

export function FeatureAccessPanel() {
  const { t } = useTranslation()
  const actor = useSelector(selectUser)
  const audiences = bulkAudiencesForActor(actor?.role)
  const enabled = audiences.length > 0
  const { data: catalog = [], isLoading: isCatalogLoading, isError: isCatalogError } = useGetAdminFeaturesQuery(
    undefined,
    { skip: !enabled },
  )
  const {
    data: profiles = [],
    isLoading: isProfilesLoading,
    isError: isProfilesError,
    refetch: refetchProfiles,
  } = useGetAdminFeatureProfilesQuery(undefined, { skip: !enabled })
  const { users, isLoading: isUsersLoading } = useAllAdminUsers(enabled)
  const [createProfile] = useCreateAdminFeatureProfileMutation()
  const [updateProfile] = useUpdateAdminFeatureProfileMutation()
  const [pending, setPending] = useState<Map<number, string[] | null> | null>(null)
  const [saving, setSaving] = useState(false)

  if (!enabled) return null

  const descriptionKey = audiences.length > 1
    ? 'admin-page.feature-access.description-super'
    : 'admin-page.feature-access.description-admin'
  const isLoading = isCatalogLoading || isProfilesLoading || isUsersLoading
  const isError = isCatalogError || isProfilesError

  const saveAssignments = async (
    overrides: Map<number, string[] | null>,
    preferredName: string,
  ) => {
    setPending(overrides)
    setSaving(true)
    try {
      await syncFeatureAssignments(overrides, profiles, { createProfile, updateProfile }, preferredName)
      await refetchProfiles()
      setPending(null)
    } catch (error) {
      setPending(null)
      errorsHandler(error, t)
    } finally {
      setSaving(false)
    }
  }

  const featuresOf = (userId: number) => {
    if (pending?.has(userId)) return pending.get(userId) ?? null
    return readUserFeatures(userId, profiles, catalog)
  }

  return (
    <>
      <div>
        <h3 className="text-lg font-semibold tracking-tight">{t('admin-page.feature-access.title')}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{t(descriptionKey)}</p>
      </div>
      <Card className="shrink-0 overflow-hidden shadow-sm">
        {isLoading ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">{t('admin-page.loading')}</p>
        ) : isError ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">{t('admin-page.feature-access.load-error')}</p>
        ) : catalog.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">{t('admin-page.feature-access.empty')}</p>
        ) : (
          <div className={cn('grid', audiences.length > 1 && 'md:grid-cols-2')}>
            {audiences.map((audience, index) => (
              <AudienceColumn
                key={audience}
                audience={audience}
                users={users}
                catalog={catalog}
                profiles={profiles}
                featuresOf={featuresOf}
                saving={saving}
                divided={index === 0 && audiences.length > 1}
                onSave={saveAssignments}
              />
            ))}
          </div>
        )}
      </Card>
    </>
  )
}

function AudienceColumn({
  audience,
  users,
  catalog,
  profiles,
  featuresOf,
  saving,
  divided,
  onSave,
}: {
  audience: BulkAudience
  users: AdminUser[]
  catalog: string[]
  profiles: FeatureProfile[]
  featuresOf: (userId: number) => string[] | null
  saving: boolean
  divided: boolean
  onSave: (overrides: Map<number, string[] | null>, preferredName: string) => Promise<void>
}) {
  const { t } = useTranslation()
  const targets = users.filter((user) => isInBulkAudience(audience, user.role))
  const targetIds = targets.map((user) => user.id)
  const openFeatures = (userId: number) => featuresOf(userId) ?? catalog
  const everyFeatureOpen = targets.length > 0 && targets.every((user) => openFeatures(user.id).length === catalog.length)

  const openCount = (feature: string) =>
    targets.filter((user) => openFeatures(user.id).includes(feature)).length

  const featureEnabled = (feature: string) => openCount(feature) > 0

  return (
    <section
      className={cn(
        'min-w-0 px-2 py-2',
        divided && 'border-b border-border md:border-b-0 md:border-r',
      )}
    >
      <div className="flex items-center justify-between gap-3 px-2 py-1.5">
        <div className="min-w-0">
          <div className="text-sm font-medium">{t(`admin-page.feature-access.audiences.${audience}`)}</div>
          <div className="text-xs text-muted-foreground">
            {t(`admin-page.feature-access.audience-hint.${audience}`)}
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 shrink-0 px-2 text-xs text-muted-foreground"
          disabled={saving || targets.length === 0}
          onClick={() => {
            void onSave(
              uniformFeatureMap(targetIds, everyFeatureOpen ? [] : null),
              AUDIENCE_PROFILE_NAMES[audience],
            )
          }}
        >
          {t(everyFeatureOpen ? 'admin-page.feature-access.disable-all' : 'admin-page.feature-access.enable-all')}
        </Button>
      </div>

      {targets.length === 0 ? (
        <p className="px-2 py-3 text-sm text-muted-foreground">
          {t(audience === 'admin' ? 'admin-page.feature-access.empty-admin' : 'admin-page.feature-access.empty-member')}
        </p>
      ) : (
        <ul>
          {orderFeatureKeys(catalog).map((feature) => {
            const Icon = featureIcon(feature)
            const opened = openCount(feature)
            const checked = featureEnabled(feature)
            const hint = featureHintKey(feature, audience)
            const label = t(`admin-page.feature-access.features.${feature}`, { defaultValue: feature })
            const statusKey = opened === targets.length
              ? 'admin-page.feature-access.status-all'
              : opened === 0
                ? 'admin-page.feature-access.status-none'
                : 'admin-page.feature-access.status-mixed'

            return (
              <li key={feature}>
                <div className="flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted/60">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm leading-tight">{label}</div>
                    <div className="mt-0.5 text-xs leading-tight text-muted-foreground">
                      {t(statusKey, { open: opened, total: targets.length })}
                      {hint ? ` · ${t(hint)}` : ''}
                    </div>
                  </div>
                  <Switch
                    checked={checked}
                    disabled={saving}
                    onCheckedChange={(value) => {
                      void onSave(
                        toggledFeatureMap(targetIds, feature, value, profiles, catalog),
                        AUDIENCE_PROFILE_NAMES[audience],
                      )
                    }}
                    aria-label={`${t(`admin-page.feature-access.audiences.${audience}`)}: ${label}`}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function useAllAdminUsers(enabled: boolean) {
  const dispatch = useDispatch<AppDispatch>()
  const firstPage = useGetAdminUsersQuery({ limit: 100, offset: 0 }, { skip: !enabled })
  const [rest, setRest] = useState<AdminUser[]>([])

  useEffect(() => {
    const first = firstPage.data
    if (!enabled || !first || first.results.length >= first.count) {
      setRest([])
      return
    }

    let cancelled = false
    const load = async () => {
      const collected: AdminUser[] = []
      let offset = first.results.length
      while (offset < first.count) {
        const request = dispatch(
          platformAdminApi.endpoints.getAdminUsers.initiate({ limit: 100, offset }),
        )
        const page = await request.unwrap()
        request.unsubscribe()
        collected.push(...page.results)
        if (page.results.length === 0) break
        offset += page.results.length
      }
      if (!cancelled) setRest(collected)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [dispatch, enabled, firstPage.data])

  return {
    users: [...(firstPage.data?.results ?? []), ...rest],
    isLoading: firstPage.isLoading,
    isError: firstPage.isError,
  }
}
