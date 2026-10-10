import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import { toast } from 'sonner'
import {
  useGetAdminFeatureProfilesQuery,
  useGetAdminFeaturesQuery,
  useCreateAdminFeatureProfileMutation,
  useUpdateAdminFeatureProfileMutation,
  useUpdateAdminUserRoleMutation,
} from '../../../entities/platform-admin/model/platformAdminSlice'
import type { AdminUser } from '../../../entities/platform-admin/model/types'
import { selectUser } from '../../../entities/user/model/selectors'
import { errorsHandler } from '../../../shared/lib/errors-handler'
import type { PlatformRole } from '../../../shared/types/platform-role'
import { Button } from '../../../shared/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../shared/ui/dialog'
import { Input } from '../../../shared/ui/input'
import { Label } from '../../../shared/ui/label'
import { Switch } from '../../../shared/ui/switch'
import {
  applyFeatureToggle,
  canEditUserFeatures,
  readUserAccessDraft,
  saveUserAccess,
} from '../model/featureAccessPolicy'
import { readUserFeatures, syncFeatureAssignments } from '../model/featureProfileActions'
import { featureHintKey, featureIcon, orderFeatureKeys } from './featureAccessMeta'
import { canManageUserRoles, UserRoleSelect } from './UserRoleSelect'
import { PlatformRoleBadge } from './PlatformRoleBadge'

interface UserEditDialogProps {
  user: AdminUser | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function UserEditDialog({ user, open, onOpenChange }: UserEditDialogProps) {
  const { t } = useTranslation()
  const actor = useSelector(selectUser)
  const [name, setName] = useState('')
  const [surname, setSurname] = useState('')
  const [role, setRole] = useState<string>('member')
  const [features, setFeatures] = useState<string[] | null>(null)
  const [formUserId, setFormUserId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const { data: catalog = [], isLoading: isCatalogLoading, isError: isCatalogError } = useGetAdminFeaturesQuery(
    undefined,
    { skip: !open },
  )
  const { data: profiles = [], isLoading: isProfilesLoading } = useGetAdminFeatureProfilesQuery(undefined, {
    skip: !open,
  })
  const [createProfile] = useCreateAdminFeatureProfileMutation()
  const [updateProfile] = useUpdateAdminFeatureProfileMutation()
  const [updateRole] = useUpdateAdminUserRoleMutation()
  const accessReady = open && !isCatalogLoading && !isProfilesLoading

  if (!open && formUserId !== null) {
    setFormUserId(null)
  }

  if (user && accessReady && formUserId !== user.id) {
    const draft = readUserAccessDraft(user.id)
    setFormUserId(user.id)
    setName(draft?.name ?? user.name ?? '')
    setSurname(draft?.surname ?? user.surname ?? '')
    setRole(draft?.role ?? user.role)
    setFeatures(readUserFeatures(user.id, profiles, catalog))
  }

  if (!user) return null

  const canEditRole = canManageUserRoles(actor?.role) && actor?.id !== user.id
  const canEditFeatures = canEditUserFeatures(actor?.role, role)
  const hintAudience = role === 'member' ? 'member' : 'admin'
  const allOpen = features == null

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    try {
      if (canEditRole && role !== user.role) {
        await updateRole({ userId: user.id, role: role as PlatformRole }).unwrap()
      }
      if (canEditFeatures) {
        await syncFeatureAssignments(
          new Map([[user.id, features]]),
          profiles,
          { createProfile, updateProfile },
          `Профиль ${user.id}`,
        )
      }
      saveUserAccess(user.id, {
        name: name.trim(),
        surname: surname.trim(),
        role,
        features,
      })
      toast.success(t('admin-page.user-edit.saved'))
      onOpenChange(false)
    } catch (error) {
      errorsHandler(error, t)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(720px,calc(100vh-2rem))] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('admin-page.user-edit.title')}</DialogTitle>
          <DialogDescription>{t('admin-page.user-edit.description')}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="user-email">{t('admin-page.user-edit.email')}</Label>
            <Input id="user-email" value={user.email} disabled />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="user-name">{t('admin-page.user-edit.name')}</Label>
              <Input
                id="user-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-surname">{t('admin-page.user-edit.surname')}</Label>
              <Input
                id="user-surname"
                value={surname}
                onChange={(event) => setSurname(event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t('admin-page.user-edit.role')}</Label>
            {canEditRole ? (
              <UserRoleSelect
                role={role}
                canManage
                onChange={(nextRole: PlatformRole) => setRole(nextRole)}
              />
            ) : (
              <PlatformRoleBadge role={role} showSuperAdminHint={role === 'super_admin'} />
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label>{t('admin-page.user-edit.access')}</Label>
              {canEditFeatures && !allOpen && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-muted-foreground"
                  onClick={() => setFeatures(null)}
                >
                  {t('admin-page.user-edit.reset')}
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {canEditFeatures
                ? t('admin-page.user-edit.access-hint')
                : t('admin-page.user-edit.access-locked')}
            </p>

            {canEditFeatures && isCatalogLoading && (
              <p className="text-sm text-muted-foreground">{t('admin-page.loading')}</p>
            )}
            {canEditFeatures && isCatalogError && (
              <p className="text-sm text-muted-foreground">{t('admin-page.feature-access.load-error')}</p>
            )}
            {canEditFeatures && !isCatalogLoading && !isCatalogError && catalog.length === 0 && (
              <p className="text-sm text-muted-foreground">{t('admin-page.feature-access.empty')}</p>
            )}
            {canEditFeatures && catalog.length > 0 && (
              <ul className="rounded-lg border border-border bg-muted/30 px-2 py-1">
                {orderFeatureKeys(catalog).map((feature) => {
                  const Icon = featureIcon(feature)
                  const checked = features == null || features.includes(feature)
                  const hint = featureHintKey(feature, hintAudience)
                  const label = t(`admin-page.feature-access.features.${feature}`, { defaultValue: feature })

                  return (
                    <li key={feature} className="flex items-center gap-3 py-1.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                        <Icon className="h-4 w-4" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm leading-tight">{label}</div>
                        {hint && (
                          <div className="mt-0.5 text-xs leading-tight text-muted-foreground">{t(hint)}</div>
                        )}
                      </div>
                      <Switch
                        checked={checked}
                        onCheckedChange={(value) => setFeatures((current) => applyFeatureToggle(current, feature, value, catalog))}
                        aria-label={label}
                      />
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('buttons.cancel')}
            </Button>
            <Button type="submit" disabled={saving || (canEditFeatures && !accessReady)}>
              {t('buttons.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
