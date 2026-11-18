import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import type { AdminOrganization } from '../../../entities/platform-admin/model/types'
import { useUpdateAdminOrganizationMutation } from '../../../entities/platform-admin/model/platformAdminSlice'
import { Button } from '../../../shared/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../shared/ui/dialog'
import { Input } from '../../../shared/ui/input'
import { Label } from '../../../shared/ui/label'

interface AdminOrganizationEditDialogProps {
  organization: AdminOrganization | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AdminOrganizationEditDialog({
  organization,
  open,
  onOpenChange,
}: AdminOrganizationEditDialogProps) {
  const { t } = useTranslation()
  const [updateOrganization, { isLoading }] = useUpdateAdminOrganizationMutation()
  const [form, setForm] = useState({
    full_name: '',
    short_name: '',
    address: '',
    inn: '',
    kpp: '',
  })

  useEffect(() => {
    if (!organization) return

    setForm({
      full_name: organization.full_name,
      short_name: organization.short_name,
      address: organization.address,
      inn: organization.inn ?? '',
      kpp: organization.kpp ?? '',
    })
  }, [organization])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!organization) return

    try {
      await updateOrganization({
        id: organization.id,
        body: {
          full_name: form.full_name.trim(),
          short_name: form.short_name.trim(),
          address: form.address.trim(),
          inn: form.inn.trim() || null,
          kpp: form.kpp.trim() || null,
        },
      }).unwrap()
      toast.success(t('admin-page.organization-updated'))
      onOpenChange(false)
    } catch (error) {
      toast.error(t('errors.something-went-wrong'))
      console.error(error)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('admin-page.edit-organization')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="org-full-name">{t('admin-page.orgs-table.name')}</Label>
            <Input
              id="org-full-name"
              value={form.full_name}
              onChange={(event) => setForm({ ...form, full_name: event.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="org-short-name">{t('admin-page.orgs-table.short-name')}</Label>
            <Input
              id="org-short-name"
              value={form.short_name}
              onChange={(event) => setForm({ ...form, short_name: event.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="org-address">{t('fields.address')}</Label>
            <Input
              id="org-address"
              value={form.address}
              onChange={(event) => setForm({ ...form, address: event.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="org-inn">{t('admin-page.orgs-table.inn')}</Label>
              <Input
                id="org-inn"
                value={form.inn}
                onChange={(event) => setForm({ ...form, inn: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-kpp">KPP</Label>
              <Input
                id="org-kpp"
                value={form.kpp}
                onChange={(event) => setForm({ ...form, kpp: event.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('buttons.cancel')}
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('buttons.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
