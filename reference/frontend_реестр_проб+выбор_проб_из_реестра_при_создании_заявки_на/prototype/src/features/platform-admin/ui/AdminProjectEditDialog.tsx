import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import type { AdminProject } from '../../../entities/platform-admin/model/types'
import {
  useGetAdminOrganizationsQuery,
  useUpdateAdminProjectMutation,
} from '../../../entities/platform-admin/model/platformAdminSlice'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../shared/ui/select'

interface AdminProjectEditDialogProps {
  project: AdminProject | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AdminProjectEditDialog({
  project,
  open,
  onOpenChange,
}: AdminProjectEditDialogProps) {
  const { t } = useTranslation()
  const [updateProject, { isLoading }] = useUpdateAdminProjectMutation()
  const { data: organizationsData } = useGetAdminOrganizationsQuery(
    { limit: 200, offset: 0 },
    { skip: !open }
  )
  const [form, setForm] = useState({
    name: '',
    organization_id: '',
    reservoir: '',
    company_customer: '',
    contractor: '',
    country: '',
  })

  useEffect(() => {
    if (!project) return

    setForm({
      name: project.name,
      organization_id: String(project.organization_id),
      reservoir: project.reservoir ?? '',
      company_customer: project.company_customer ?? '',
      contractor: project.contractor ?? '',
      country: project.country ?? '',
    })
  }, [project])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!project) return

    try {
      await updateProject({
        id: project.id,
        body: {
          name: form.name.trim(),
          organization_id: Number(form.organization_id),
          reservoir: form.reservoir.trim(),
          company_customer: form.company_customer.trim(),
          contractor: form.contractor.trim(),
          country: form.country.trim(),
        },
      }).unwrap()
      toast.success(t('admin-page.project-updated'))
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
          <DialogTitle>{t('admin-page.edit-project')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="project-name">{t('admin-page.projects-table.name')}</Label>
            <Input
              id="project-name"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>{t('admin-page.projects-table.organization')}</Label>
            <Select
              value={form.organization_id}
              onValueChange={(value) => setForm({ ...form, organization_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('admin-page.select-organization')} />
              </SelectTrigger>
              <SelectContent>
                {(organizationsData?.results ?? []).map((org) => (
                  <SelectItem key={org.id} value={String(org.id)}>
                    {org.short_name || org.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-reservoir">{t('fields.reservoir')}</Label>
            <Input
              id="project-reservoir"
              value={form.reservoir}
              onChange={(event) => setForm({ ...form, reservoir: event.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="project-customer">{t('admin-page.projects-table.customer')}</Label>
              <Input
                id="project-customer"
                value={form.company_customer}
                onChange={(event) => setForm({ ...form, company_customer: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-contractor">{t('admin-page.projects-table.contractor')}</Label>
              <Input
                id="project-contractor"
                value={form.contractor}
                onChange={(event) => setForm({ ...form, contractor: event.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-country">{t('admin-page.projects-table.country')}</Label>
            <Input
              id="project-country"
              value={form.country}
              onChange={(event) => setForm({ ...form, country: event.target.value })}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('buttons.cancel')}
            </Button>
            <Button type="submit" disabled={isLoading || !form.organization_id}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('buttons.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
