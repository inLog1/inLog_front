import { Loader2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  useCreateAdminTaskTagMutation,
  useGetAdminOrganizationsQuery,
  useGetAdminProjectsQuery,
  useUpdateAdminTaskTagMutation,
} from '../../../entities/platform-admin/model/platformAdminSlice'
import type { AdminTaskTag } from '../../../entities/platform-admin/model/types'
import { Button } from '../../../shared/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../../shared/ui/dialog'
import { Input } from '../../../shared/ui/input'
import { Label } from '../../../shared/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../shared/ui/select'

interface AdminTaskTagDialogProps {
  open: boolean
  tag?: AdminTaskTag | null
  onOpenChange: (open: boolean) => void
}

export function AdminTaskTagDialog({ open, tag, onOpenChange }: AdminTaskTagDialogProps) {
  const { t } = useTranslation()
  const isEdit = Boolean(tag)
  const [createTag, { isLoading: isCreating }] = useCreateAdminTaskTagMutation()
  const [updateTag, { isLoading: isUpdating }] = useUpdateAdminTaskTagMutation()
  const { data: organizations } = useGetAdminOrganizationsQuery(
    { limit: 200, offset: 0 },
    { skip: !open || isEdit },
  )
  const { data: projects } = useGetAdminProjectsQuery(
    { limit: 200, offset: 0 },
    { skip: !open || isEdit },
  )
  const [name, setName] = useState('')
  const [organizationId, setOrganizationId] = useState('')
  const [projectId, setProjectId] = useState('')

  const orgProjects = useMemo(
    () => (projects?.results ?? []).filter((project) => String(project.organization_id) === organizationId),
    [organizationId, projects?.results],
  )

  useEffect(() => {
    if (!open) return
    setName(tag?.name || '')
    setOrganizationId('')
    setProjectId(tag ? String(tag.project_id) : '')
  }, [open, tag])

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
    const nextName = name.trim()
    if (!nextName || !projectId) return

    try {
      if (tag) {
        await updateTag({
          id: tag.id,
          name: nextName,
          project: tag.project_id,
        }).unwrap()
        toast.success(t('admin-page.tag-updated'))
      } else {
        await createTag({
          name: nextName,
          project: Number(projectId),
        }).unwrap()
        toast.success(t('admin-page.tag-created'))
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
          <DialogTitle>{isEdit ? t('admin-page.edit-tag') : t('admin-page.create-tag')}</DialogTitle>
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
            <Label htmlFor="tag-name">{t('admin-page.tags-table.name')}</Label>
            <Input
              id="tag-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t('validation.enter-name')}
              required
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('buttons.cancel')}
            </Button>
            <Button type="submit" disabled={isLoading || !name.trim() || !projectId}>
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? t('buttons.save') : t('buttons.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
