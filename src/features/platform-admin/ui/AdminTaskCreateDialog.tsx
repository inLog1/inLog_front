import { Loader2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { toast } from 'sonner'
import {
  platformAdminApi,
  useGetAdminOrganizationsQuery,
  useGetAdminProjectsQuery,
} from '../../../entities/platform-admin/model/platformAdminSlice'
import type { TaskPriority } from '../../../entities/task/model/types'
import { useCreateTaskMutation } from '../../../entities/task/model/taskSlice'
import { priorityTypes } from '../../../shared/config/constants'
import { Button } from '../../../shared/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../../shared/ui/dialog'
import { Input } from '../../../shared/ui/input'
import { Label } from '../../../shared/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../shared/ui/select'

interface AdminTaskCreateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AdminTaskCreateDialog({ open, onOpenChange }: AdminTaskCreateDialogProps) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const [createTask, { isLoading }] = useCreateTaskMutation()
  const { data: organizations } = useGetAdminOrganizationsQuery(
    { limit: 200, offset: 0 },
    { skip: !open },
  )
  const { data: projects } = useGetAdminProjectsQuery(
    { limit: 200, offset: 0 },
    { skip: !open },
  )
  const [name, setName] = useState('')
  const [organizationId, setOrganizationId] = useState('')
  const [projectId, setProjectId] = useState('')
  const [priority, setPriority] = useState<TaskPriority>(priorityTypes.medium)

  const orgProjects = useMemo(
    () => (projects?.results ?? []).filter((project) => String(project.organization_id) === organizationId),
    [organizationId, projects?.results],
  )

  useEffect(() => {
    if (!open) return
    setName('')
    setOrganizationId('')
    setProjectId('')
    setPriority(priorityTypes.medium)
  }, [open])

  useEffect(() => {
    if (!open || !organizationId || projectId) return
    if (orgProjects.length === 1) setProjectId(String(orgProjects[0].id))
  }, [open, organizationId, orgProjects, projectId])

  const handleOrganizationChange = (value: string) => {
    setOrganizationId(value)
    setProjectId('')
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!organizationId || !projectId || !name.trim()) return

    try {
      await createTask({
        projectId: Number(projectId),
        data: { name: name.trim(), priority },
      }).unwrap()
      dispatch(platformAdminApi.util.invalidateTags([{ type: 'AdminTasks', id: 'LIST' }]))
      toast.success(t('admin-page.task-created'))
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
          <DialogTitle>{t('admin-page.create-task')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
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
            <Select
              value={projectId || undefined}
              onValueChange={setProjectId}
              disabled={!organizationId}
            >
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
          <div className="space-y-2">
            <Label htmlFor="create-task-name">{t('fields.task-name')}</Label>
            <Input
              id="create-task-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t('fields.enter-task-name')}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>{t('fields.priority')}</Label>
            <Select value={priority} onValueChange={(value) => setPriority(value as TaskPriority)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.values(priorityTypes).map((item) => (
                  <SelectItem key={item} value={item}>
                    {t(`fields.priority-types.${item}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('buttons.cancel')}
            </Button>
            <Button type="submit" disabled={isLoading || !organizationId || !projectId || !name.trim()}>
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('buttons.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
