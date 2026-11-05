import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import {
  useCreateAccessAssignmentMutation,
  useGetAccessDirectoryQuery,
  useRevokeAccessAssignmentMutation,
} from '../../../entities/access'
import { personWithPosition } from '../../../entities/organization/model/requisites'
import { useUpdateOrganizationMutation } from '../../../entities/organization/model/organizationSlice'
import type { DirectoryOrganization } from '../../../entities/organization/model/directory'
import { getApiMode } from '../../../shared/config/runtime'
import { errorsHandler } from '../../../shared/lib/errors-handler'
import { useUnsavedSource } from '../../../shared/session/unsaved-work'
import { organizationKindLabelKey } from '../model/kind-label'
import { Button } from '../../../shared/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../shared/ui/dialog'
import { Input } from '../../../shared/ui/input'
import { Label } from '../../../shared/ui/label'

export function EditOrganizationDialog({
  organization,
  open,
  onOpenChange,
}: {
  organization: DirectoryOrganization | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const mock = getApiMode() === 'mock'
  const [updateOrganization, { isLoading: updating }] = useUpdateOrganizationMutation()
  const [createAssignment, { isLoading: assigning }] = useCreateAccessAssignmentMutation()
  const [revokeAssignment, { isLoading: revoking }] = useRevokeAccessAssignmentMutation()
  const directory = useGetAccessDirectoryQuery(
    { scope: 'organization', organizationId: 'all' },
    { skip: !open || !mock },
  )
  const organizationDirectory = useGetAccessDirectoryQuery(
    { scope: 'organization', organizationId: organization?.id ?? 0 },
    { skip: !open || !mock || organization == null || directory.isSuccess || directory.isLoading || directory.isFetching },
  )
  const directoryData = directory.data ?? organizationDirectory.data
  const directoryPending = directory.isLoading || directory.isFetching || organizationDirectory.isLoading || organizationDirectory.isFetching

  const [fullName, setFullName] = useState(organization?.fullName ?? '')
  const [shortName, setShortName] = useState(organization?.shortName ?? '')
  const [address, setAddress] = useState(organization?.address ?? '')
  const [inn, setInn] = useState(organization?.inn ?? '')
  const [kpp, setKpp] = useState(organization?.kpp ?? '')
  const [kind, setKind] = useState<'laboratory' | 'customer'>(organization?.kind ?? 'laboratory')
  const [administratorId, setAdministratorId] = useState('')
  const [initialAdministratorId, setInitialAdministratorId] = useState('')

  const administratorRole = useMemo(() => {
    if (!mock || !organization || !directoryData) return null
    return directoryData.roles.find((role) =>
      role.system
      && role.ownerScope.type === 'organization'
      && role.ownerScope.organizationId === organization.id,
    ) ?? null
  }, [directoryData, mock, organization])

  const currentAdministratorAssignments = useMemo(() => {
    if (!administratorRole || !organization || !directoryData) return []
    return directoryData.assignments.filter((assignment) =>
      assignment.roleId === administratorRole.id
      && assignment.scope.type === 'organization'
      && assignment.scope.organizationId === organization.id,
    )
  }, [administratorRole, directoryData, organization])

  const specialists = (directoryData?.candidates ?? []).flatMap((candidate) => {
    if (candidate.status === 'blocked') return []
    const label = personWithPosition({
      surname: candidate.surname,
      name: candidate.givenName,
      patronymic: candidate.patronymic,
      position: candidate.position,
    })
    return label ? [{ id: candidate.id, label }] : []
  })

  useEffect(() => {
    if (!open || !organization) return
    setFullName(organization.fullName)
    setShortName(organization.shortName)
    setAddress(organization.address)
    setInn(organization.inn)
    setKpp(organization.kpp)
    setKind(organization.kind)
  }, [open, organization])

  const seededFor = useRef<number | null>(null)
  useEffect(() => {
    if (!open) {
      seededFor.current = null
      return
    }
    if (!mock || !organization || !directoryData || directoryPending) return
    if (seededFor.current === organization.id) return
    seededFor.current = organization.id
    const currentId = currentAdministratorAssignments[0]?.userId
    const nextAdministratorId = currentId != null && currentId > 0 ? String(currentId) : ''
    setAdministratorId(nextAdministratorId)
    setInitialAdministratorId(nextAdministratorId)
  }, [open, mock, organization, directoryData, directoryPending, currentAdministratorAssignments])

  const dirty = open && organization != null && (
    fullName !== organization.fullName
    || shortName !== organization.shortName
    || address !== organization.address
    || inn !== organization.inn
    || kpp !== organization.kpp
    || kind !== organization.kind
    || (mock && administratorId !== initialAdministratorId)
  )
  useUnsavedSource('edit-organization', dirty)

  const isLoading = updating || assigning || revoking

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!organization) return
    try {
      const saved = await updateOrganization({
        id: organization.id,
        full_name: fullName,
        short_name: shortName,
        address,
        inn,
        kpp,
        kind,
        expectedRevision: organization.revision,
      }).unwrap()

      let administratorFailed = false
      if (mock && administratorId !== initialAdministratorId) {
        const nextAdministratorId = Number(administratorId)
        const roleId = saved.administrator_role_id ?? administratorRole?.id
        const corporationId = saved.corporation_id ?? directoryData?.corporationId
        if (roleId && corporationId != null) {
          for (const assignment of currentAdministratorAssignments) {
            if (!assignment.canRevoke) {
              administratorFailed = true
              continue
            }
            try {
              await revokeAssignment({ assignmentId: assignment.id }).unwrap()
            } catch {
              administratorFailed = true
            }
          }
          if (Number.isInteger(nextAdministratorId) && nextAdministratorId > 0) {
            try {
              await createAssignment({
                userId: nextAdministratorId,
                roleId,
                scope: {
                  type: 'organization',
                  organizationId: organization.id,
                  corporationId,
                },
              }).unwrap()
            } catch {
              administratorFailed = true
            }
          }
        } else if (Number.isInteger(nextAdministratorId) && nextAdministratorId > 0) {
          administratorFailed = true
        }
      }

      toast.success(t('settings-page.organization-saved', { kind: t(organizationKindLabelKey(kind)) }))
      if (administratorFailed) toast.error(t('notice-list.organization-administrator-update-failed'))
      onOpenChange(false)
    } catch (error) {
      errorsHandler(error, t)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90vh,44rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('settings-page.edit-organization')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-full-name">{t('fields.full-name')}</Label>
            <Input id="edit-full-name" value={fullName} onChange={(event) => setFullName(event.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-short-name">{t('fields.short-name')}</Label>
            <Input id="edit-short-name" value={shortName} onChange={(event) => setShortName(event.target.value)} required />
          </div>
          {mock ? (
            <div className="space-y-2">
              <Label htmlFor="edit-kind">{t('settings-page.organization-kind')}</Label>
              <select
                id="edit-kind"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={kind}
                onChange={(event) => setKind(event.target.value === 'customer' ? 'customer' : 'laboratory')}
              >
                <option value="laboratory">{t(organizationKindLabelKey('laboratory'))}</option>
                <option value="customer">{t(organizationKindLabelKey('customer'))}</option>
              </select>
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="edit-address" className="leading-snug">{t('fields.address-legal')}</Label>
            <Input id="edit-address" value={address} onChange={(event) => setAddress(event.target.value)} required />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edit-inn">{t('fields.inn')}</Label>
              <Input
                id="edit-inn"
                inputMode="numeric"
                autoComplete="off"
                pattern="[0-9]+"
                maxLength={12}
                value={inn}
                onChange={(event) => setInn(event.target.value.replace(/\D/g, ''))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-kpp">{t('fields.kpp')}</Label>
              <Input
                id="edit-kpp"
                inputMode="numeric"
                autoComplete="off"
                pattern="[0-9]+"
                maxLength={9}
                value={kpp}
                onChange={(event) => setKpp(event.target.value.replace(/\D/g, ''))}
                required
              />
            </div>
          </div>
          {mock ? (
            <div className="space-y-2">
              <Label htmlFor="edit-organization-administrator">{t('settings-page.organization-administrator')}</Label>
              <select
                id="edit-organization-administrator"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={administratorId}
                onChange={(event) => setAdministratorId(event.target.value)}
              >
                <option value="">{t('settings-page.organization-administrator-empty')}</option>
                {specialists.map((person) => (
                  <option key={person.id} value={String(person.id)}>{person.label}</option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">{t('settings-page.organization-administrator-hint')}</p>
            </div>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t('buttons.cancel')}</Button>
            <Button type="submit" disabled={isLoading || !organization}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t('buttons.save')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
