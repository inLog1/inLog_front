import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useCreateAdminOrganizationMutation } from '../../../entities/platform-admin/model/platformAdminSlice'
import { Button } from '../../../shared/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../../shared/ui/dialog'
import { Input } from '../../../shared/ui/input'
import { Label } from '../../../shared/ui/label'

const emptyForm = {
  full_name: '',
  short_name: '',
  address: '',
  inn: '',
  kpp: '',
}

interface AdminOrganizationCreateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AdminOrganizationCreateDialog({ open, onOpenChange }: AdminOrganizationCreateDialogProps) {
  const { t } = useTranslation()
  const [createOrganization, { isLoading }] = useCreateAdminOrganizationMutation()
  const [form, setForm] = useState(emptyForm)

  useEffect(() => {
    if (open) setForm(emptyForm)
  }, [open])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    try {
      await createOrganization({
        full_name: form.full_name.trim(),
        short_name: form.short_name.trim(),
        address: form.address.trim() || null,
        inn: form.inn.trim() || null,
        kpp: form.kpp.trim() || null,
      }).unwrap()
      toast.success(t('admin-page.organization-created'))
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
          <DialogTitle>{t('admin-page.create-organization')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="create-org-full-name">{t('admin-page.orgs-table.name')}</Label>
            <Input
              id="create-org-full-name"
              value={form.full_name}
              onChange={(event) => setForm({ ...form, full_name: event.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="create-org-short-name">{t('admin-page.orgs-table.short-name')}</Label>
            <Input
              id="create-org-short-name"
              value={form.short_name}
              onChange={(event) => setForm({ ...form, short_name: event.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="create-org-address">{t('fields.address')}</Label>
            <Input
              id="create-org-address"
              value={form.address}
              onChange={(event) => setForm({ ...form, address: event.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="create-org-inn">{t('admin-page.orgs-table.inn')}</Label>
              <Input
                id="create-org-inn"
                value={form.inn}
                onChange={(event) => setForm({ ...form, inn: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-org-kpp">KPP</Label>
              <Input
                id="create-org-kpp"
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
              {t('buttons.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
