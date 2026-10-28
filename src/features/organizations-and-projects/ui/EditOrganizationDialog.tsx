import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-hot-toast'
import { Loader2 } from 'lucide-react'
import { useUpdateOrganizationMutation } from '../../../entities/organization/model/organizationSlice'
import type { DirectoryOrganization } from '../../../entities/organization/model/directory'
import { errorsHandler } from '../../../shared/lib/errors-handler'
import { useUnsavedSource } from '../../../shared/session/unsaved-work'
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
  const [updateOrganization, { isLoading }] = useUpdateOrganizationMutation()
  const [fullName, setFullName] = useState(organization?.fullName ?? '')
  const [shortName, setShortName] = useState(organization?.shortName ?? '')
  const [address, setAddress] = useState(organization?.address ?? '')
  const [kind, setKind] = useState<'laboratory' | 'customer'>(organization?.kind ?? 'laboratory')
  const dirty = open && organization != null && (
    fullName !== organization.fullName
    || shortName !== organization.shortName
    || address !== organization.address
    || kind !== organization.kind
  )
  useUnsavedSource('edit-organization', dirty)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!organization) return
    try {
      await updateOrganization({
        id: organization.id,
        full_name: fullName,
        short_name: shortName,
        address,
        kind,
        expectedRevision: organization.revision,
      }).unwrap()
      toast.success(t('settings-page.organization-saved'))
      onOpenChange(false)
    } catch (error) {
      errorsHandler(error, t)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
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
          <div className="space-y-2">
            <Label htmlFor="edit-kind">{t('settings-page.organization-kind')}</Label>
            <select
              id="edit-kind"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={kind}
              onChange={(event) => setKind(event.target.value === 'customer' ? 'customer' : 'laboratory')}
            >
              <option value="laboratory">{t('settings-page.kind-laboratory')}</option>
              <option value="customer">{t('settings-page.kind-customer')}</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-address">{t('fields.address')}</Label>
            <Input id="edit-address" value={address} onChange={(event) => setAddress(event.target.value)} required />
          </div>
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
