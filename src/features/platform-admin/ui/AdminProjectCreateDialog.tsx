import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import type { AdminOrganization } from '../../../entities/platform-admin/model/types'
import { useCreateAdminProjectMutation } from '../../../entities/platform-admin/model/platformAdminSlice'
import { Button } from '../../../shared/ui/button'
import { CountrySelect } from '../../../shared/ui/country-select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../../shared/ui/dialog'
import { Input } from '../../../shared/ui/input'
import { Label } from '../../../shared/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../shared/ui/select'

const NONE = 'none'

const emptyForm = {
  name: '',
  reservoir: '',
}

interface AdminProjectCreateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  organizations: AdminOrganization[]
  defaultOrganizationId?: number
}

export function AdminProjectCreateDialog({
  open,
  onOpenChange,
  organizations,
  defaultOrganizationId,
}: AdminProjectCreateDialogProps) {
  const { t } = useTranslation()
  const [createProject, { isLoading }] = useCreateAdminProjectMutation()
  const [organizationId, setOrganizationId] = useState(NONE)
  const [country, setCountry] = useState(NONE)
  const [form, setForm] = useState(emptyForm)

  useEffect(() => {
    if (!open) return
    setOrganizationId(defaultOrganizationId ? String(defaultOrganizationId) : NONE)
    setCountry(NONE)
    setForm(emptyForm)
  }, [open, defaultOrganizationId])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    try {
      await createProject({
        name: form.name.trim(),
        reservoir: form.reservoir.trim(),
        organization: organizationId === NONE ? null : Number(organizationId),
        country: country === NONE ? null : country,
      }).unwrap()
      toast.success(t('admin-page.project-created'))
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
          <DialogTitle>{t('admin-page.create-project')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>{t('admin-page.projects-table.organization')}</Label>
            <Select value={organizationId} onValueChange={setOrganizationId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>—</SelectItem>
                {organizations.map((organization) => (
                  <SelectItem key={organization.id} value={String(organization.id)}>
                    {organization.short_name || organization.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="create-project-name">{t('admin-page.projects-table.name')}</Label>
            <Input
              id="create-project-name"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="create-project-reservoir">{t('fields.reservoir')}</Label>
            <Input
              id="create-project-reservoir"
              value={form.reservoir}
              onChange={(event) => setForm({ ...form, reservoir: event.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>{t('admin-page.projects-table.country')}</Label>
            <CountrySelect value={country === NONE ? '' : country} onChange={(code) => setCountry(code || NONE)} />
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
