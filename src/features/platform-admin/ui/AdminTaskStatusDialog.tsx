import { Loader2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  useCreateAdminTaskStatusMutation,
  useGetAdminOrganizationsQuery,
  useGetAdminProjectsQuery,
  useUpdateAdminTaskStatusMutation,
} from '../../../entities/platform-admin/model/platformAdminSlice'
import type { AdminTaskStatus } from '../../../entities/platform-admin/model/types'
import { Button } from '../../../shared/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../../shared/ui/dialog'
import { Input } from '../../../shared/ui/input'
import { Label } from '../../../shared/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../shared/ui/select'

interface AdminTaskStatusDialogProps {
  open: boolean
  status?: AdminTaskStatus | null
  onOpenChange: (open: boolean) => void
}

export function AdminTaskStatusDialog({ open, status, onOpenChange }: AdminTaskStatusDialogProps) {
  const { t } = useTranslation()
  const isEdit = Boolean(status)
  const [createStatus, { isLoading: isCreating }] = useCreateAdminTaskStatusMutation()
  const [updateStatus, { isLoading: isUpdating }] = useUpdateAdminTaskStatusMutation()
  const { data: organizations } = useGetAdminOrganizationsQuery(
    { limit: 200, offset: 0 },
    { skip: !open || isEdit },
  )
  const { data: projects } = useGetAdminProjectsQuery(
    { limit: 200, offset: 0 },
    { skip: !open || isEdit },
  )
  const [nameRu, setNameRu] = useState('')
  const [nameEn, setNameEn] = useState('')
  const [organizationId, setOrganizationId] = useState('')
  const [projectId, setProjectId] = useState('')

  const orgProjects = useMemo(
    () => (projects?.results ?? []).filter((project) => String(project.organization_id) === organizationId),
    [organizationId, projects?.results],
  )

  useEffect(() => {
    if (!open) return
    setNameRu(status?.name_ru || '')
    setNameEn(status?.name_en || '')
    setOrganizationId('')
    setProjectId(status ? String(status.project_id) : '')
  }, [open, status])

  useEffect(() => {
    if (!open || isEdit || !organizationId || projectId) return
    if (orgProjects.length === 1) setProjectId(String(orgProjects[0].id))
  }, [isEdit, open, organizationId, orgProjects, projectId])

  const handleOrganizationChange = (value: string) => {
    setOrganizationId(value)
    setProjectId('')
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const nextRu = nameRu.trim()
    const nextEn = nameEn.trim()
    if (!nextRu || !nextEn || !projectId) return

    try {
      if (status) {
        await updateStatus({
          id: status.id,
          name_ru: nextRu,
          name_en: nextEn,
          project: status.project_id,
        }).unwrap()
        toast.success(t('admin-page.status-updated'))
      } else {
        await createStatus({
          name_ru: nextRu,
          name_en: nextEn,
          project: Number(projectId),
        }).unwrap()
        toast.success(t('admin-page.status-created'))
      }
      onOpenChange(false)
    } catch (error) {
      toast.error(t('errors.something-went-wrong'))
      console.error(error)
    }
  }

  const isLoading = isCreating || isUpdating

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? t('admin-page.edit-status') : t('admin-page.create-status')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isEdit && (
            <>
              <div className="space-y-2">
                <Label>{t('admin-page.tasks-table.organization')}</Label>
                <Select value={organizationId || undefined} onValueChange={handleOrganizationChange}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('admin-page.select-organization')} />
                  </SelectTrigger>
                  <SelectContent>
                    {(organizations?.results ?? []).map((organization) => (
                      <SelectItem key={organization.id} value={String(organization.id)}>
                        {organization.short_name || organization.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('admin-page.tasks-table.project')}</Label>
                <Select value={projectId || undefined} onValueChange={setProjectId} disabled={!organizationId}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('scheduler-page.select-project-first')} />
                  </SelectTrigger>
                  <SelectContent>
                    {orgProjects.map((project) => (
                      <SelectItem key={project.id} value={String(project.id)}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
          <div className="space-y-2">
            <Label htmlFor="status-name-ru">{t('fields.name-in-russian')}</Label>
            <Input
              id="status-name-ru"
              value={nameRu}
              onChange={(event) => setNameRu(event.target.value)}
              placeholder={t('fields.enter-name-in-russian')}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="status-name-en">{t('fields.name-in-english')}</Label>
            <Input
              id="status-name-en"
              value={nameEn}
              onChange={(event) => setNameEn(event.target.value)}
              placeholder={t('fields.enter-name-in-english')}
              required
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('buttons.cancel')}
            </Button>
            <Button type="submit" disabled={isLoading || !nameRu.trim() || !nameEn.trim() || !projectId}>
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? t('buttons.save') : t('buttons.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
