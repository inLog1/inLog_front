import { MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  useDeleteAdminTaskMutation,
  useDeleteAdminTaskStatusMutation,
  useDeleteAdminTaskTagMutation,
  useGetAdminOrganizationsQuery,
  useGetAdminProjectsQuery,
  useGetAdminTasksQuery,
  useGetAdminTaskStatusesQuery,
  useGetAdminTaskTagsQuery,
} from '../../../../entities/platform-admin/model/platformAdminSlice'
import { ADMIN_PAGE_SIZE, formatAdminDateShort } from '../../../../features/platform-admin/lib/format'
import { useAdminDeleteDialog } from '../../../../features/platform-admin/lib/useAdminDeleteDialog'
import {
  getAdminTaskCreator,
  getAdminTaskDoerUsers,
} from '../../../../features/platform-admin/lib/task-users'
import { AdminAvatarStack } from '../../../../features/platform-admin/ui/AdminAvatarStack'
import { AdminDeleteConfirmDialog } from '../../../../features/platform-admin/ui/AdminDeleteConfirmDialog'
import { AdminTaskCreateDialog } from '../../../../features/platform-admin/ui/AdminTaskCreateDialog'
import { AdminTaskStatusDialog } from '../../../../features/platform-admin/ui/AdminTaskStatusDialog'
import { AdminTaskTagDialog } from '../../../../features/platform-admin/ui/AdminTaskTagDialog'
import { AdminTaskEditDialog } from '../../../../features/platform-admin/ui/AdminTaskEditDialog'
import { AdminPagination } from '../../../../features/platform-admin/ui/AdminPagination'
import { DebouncedSearchInput } from '../../../../features/platform-admin/ui/DebouncedSearchInput'
import { AdminSectionShell } from '../../../../features/platform-admin/ui/AdminSectionShell'
import { AdminUserCell } from '../../../../features/platform-admin/ui/AdminUserCell'
import type { Task, TaskPriority } from '../../../../entities/task/model/types'
import { useGetTasksQuery } from '../../../../entities/task/model/taskSlice'
import type { AdminTask, AdminTaskDoer, AdminTaskStatus, AdminTaskTag } from '../../../../entities/platform-admin/model/types'
import { getPriorityColorStyle } from '../../../../shared/lib/utils'
import { Button } from '../../../../shared/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../../shared/ui/dropdown-menu'
import { SiteNameChip } from '../../../../shared/ui/site-name-chip'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../../shared/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../../shared/ui/table'

export function AdminTasksPage() {
  const { t } = useTranslation()
  const [tab, setTab] = useState('tasks')
  const [editingTask, setEditingTask] = useState<AdminTask | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isStatusCreateOpen, setIsStatusCreateOpen] = useState(false)
  const [editingStatus, setEditingStatus] = useState<AdminTaskStatus | null>(null)
  const [isTagCreateOpen, setIsTagCreateOpen] = useState(false)
  const [editingTag, setEditingTag] = useState<AdminTaskTag | null>(null)
  const [search, setSearch] = useState('')
  const [offset, setOffset] = useState(0)

  const tasksQuery = useGetAdminTasksQuery(
    { limit: ADMIN_PAGE_SIZE, offset, search: search || undefined },
    { skip: tab !== 'tasks' }
  )
  const projectsQuery = useGetAdminProjectsQuery({ limit: 200, offset: 0 })
  const organizationsQuery = useGetAdminOrganizationsQuery(
    { limit: 200, offset: 0 },
    { skip: tab !== 'tasks' },
  )
  const projectNameById = useMemo(() => {
    const names = new Map<number, string>()
    for (const project of projectsQuery.data?.results ?? []) names.set(project.id, project.name)
    return names
  }, [projectsQuery.data?.results])
  const tasks = useMemo(() => {
    const projects = new Map((projectsQuery.data?.results ?? []).map((project) => [project.id, project]))
    const organizations = new Map(
      (organizationsQuery.data?.results ?? []).map((organization) => [
        organization.id,
        organization.short_name || organization.full_name,
      ]),
    )

    return (tasksQuery.data?.results ?? []).map((task) => {
      const project = projects.get(task.project_id)
      const organizationId = task.organization_id || project?.organization_id
      const organizationName =
        task.organization_name ||
        project?.organization_name ||
        (organizationId ? organizations.get(organizationId) : '') ||
        ''

      return {
        ...task,
        project_name: task.project_name || project?.name || '',
        organization_id: organizationId,
        organization_name: organizationName,
      }
    })
  }, [organizationsQuery.data?.results, projectsQuery.data?.results, tasksQuery.data?.results])
  const projectIds = useMemo(
    () => [...new Set(tasks.map((task) => task.project_id).filter((id) => id > 0))],
    [tasks],
  )
  const [projectTaskIndex, setProjectTaskIndex] = useState<Record<number, Task>>({})
  const projectTaskSignatures = useRef<Record<number, string>>({})
  const rememberProjectTasks = useCallback((projectId: number, list: Task[]) => {
    const signature = list
      .map((item) => `${item.id}:${item.priority}:${(item.doers ?? []).map((doer) => doer.id).join(',')}:${(item.tags ?? []).map((tag) => tag.name).join(',')}`)
      .join('|')
    if (projectTaskSignatures.current[projectId] === signature) return
    projectTaskSignatures.current[projectId] = signature
    setProjectTaskIndex((current) => {
      const next = { ...current }
      for (const item of list) next[item.id] = item
      return next
    })
  }, [])
  const displayTasks = useMemo(
    () =>
      tasks.map((task) => {
        const full = projectTaskIndex[task.id]
        if (!full) return task
        const doers = doersFromTask(full)
        return {
          ...task,
          priority: full.priority || task.priority,
          doers: doers.length > 0 ? doers : task.doers,
          archived: full.archived,
          is_template: Boolean(full.is_template),
          tags: (full.tags ?? []).flatMap((tag) => (tag.name ? [tag.name] : [])),
        }
      }),
    [projectTaskIndex, tasks],
  )
  const statusesQuery = useGetAdminTaskStatusesQuery(
    { limit: ADMIN_PAGE_SIZE, offset },
    { skip: tab !== 'statuses' }
  )
  const tagsQuery = useGetAdminTaskTagsQuery(
    { limit: ADMIN_PAGE_SIZE, offset, search: search || undefined },
    { skip: tab !== 'tags' }
  )

  const [deleteTask, { isLoading: isDeletingTask }] = useDeleteAdminTaskMutation()
  const [deleteStatus, { isLoading: isDeletingStatus }] = useDeleteAdminTaskStatusMutation()
  const [deleteTag, { isLoading: isDeletingTag }] = useDeleteAdminTaskTagMutation()
  const { target, isDeleting, openDeleteDialog, closeDeleteDialog, confirmDelete } =
    useAdminDeleteDialog()

  const activeQuery =
    tab === 'tasks' ? tasksQuery : tab === 'statuses' ? statusesQuery : tagsQuery
  const isBusy =
    activeQuery.isFetching ||
    isDeletingTask ||
    isDeletingStatus ||
    isDeletingTag ||
    isDeleting

  const handleSearch = (value: string) => {
    const next = value.trim()
    setSearch((current) => {
      if (current !== next) setOffset(0)
      return next
    })
  }

  const handleTabChange = (value: string) => {
    setTab(value)
    setOffset(0)
    setSearch('')
  }

  const handleDeleteTask = (taskId: number, name: string) => {
    openDeleteDialog({
      type: 'task',
      name,
      onConfirm: async () => {
        try {
          await deleteTask(taskId).unwrap()
          toast.success(t('admin-page.task-deleted'))
        } catch (error) {
          toast.error(t('errors.something-went-wrong'))
          console.error(error)
          throw error
        }
      },
    })
  }

  const handleDeleteStatus = (statusId: number, name: string) => {
    openDeleteDialog({
      type: 'task-status',
      name,
      onConfirm: async () => {
        try {
          await deleteStatus(statusId).unwrap()
          toast.success(t('admin-page.status-deleted'))
        } catch (error) {
          toast.error(t('errors.something-went-wrong'))
          console.error(error)
          throw error
        }
      },
    })
  }

  const handleDeleteTag = (tagId: number, name: string) => {
    openDeleteDialog({
      type: 'task-tag',
      name,
      onConfirm: async () => {
        try {
          await deleteTag(tagId).unwrap()
          toast.success(t('admin-page.tag-deleted'))
        } catch (error) {
          toast.error(t('errors.something-went-wrong'))
          console.error(error)
          throw error
        }
      },
    })
  }

  return (
    <>
    {projectIds.map((projectId) => (
      <ProjectTaskIndex key={projectId} projectId={projectId} onTasks={rememberProjectTasks} />
    ))}
    <AdminSectionShell
      title={t('admin-page.tasks')}
      description={t('admin-page.tasks-description')}
      isLoading={activeQuery.isLoading}
      isEmpty={
        !activeQuery.isLoading &&
        ((tab === 'tasks' && (tasksQuery.data?.results.length ?? 0) === 0) ||
          (tab === 'statuses' && (statusesQuery.data?.results.length ?? 0) === 0) ||
          (tab === 'tags' && (tagsQuery.data?.results.length ?? 0) === 0))
      }
      toolbar={
        <div className="space-y-3">
          <div className="flex w-full items-center justify-between gap-3">
            <Tabs value={tab} onValueChange={handleTabChange}>
              <TabsList>
                <TabsTrigger value="tasks">{t('admin-page.tasks-tab.tasks')}</TabsTrigger>
                <TabsTrigger value="statuses">{t('admin-page.tasks-tab.statuses')}</TabsTrigger>
                <TabsTrigger value="tags">{t('admin-page.tasks-tab.tags')}</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button
              type="button"
              className="shrink-0"
              onClick={() => {
                if (tab === 'statuses') setIsStatusCreateOpen(true)
                else if (tab === 'tags') setIsTagCreateOpen(true)
                else setIsCreateOpen(true)
              }}
            >
              <Plus />
              {tab === 'statuses'
                ? t('admin-page.create-status')
                : tab === 'tags'
                  ? t('admin-page.create-tag')
                  : t('admin-page.create-task')}
            </Button>
          </div>
          {(tab === 'tasks' || tab === 'tags') && (
            <DebouncedSearchInput
              key={tab}
              value=""
              delay={300}
              onDebouncedChange={handleSearch}
              placeholder={
                tab === 'tasks'
                  ? t('admin-page.search-tasks')
                  : t('admin-page.search-tags')
              }
            />
          )}
        </div>
      }
      footer={
        activeQuery.data ? (
          <AdminPagination
            count={activeQuery.data.count}
            offset={offset}
            limit={ADMIN_PAGE_SIZE}
            onChange={setOffset}
            isLoading={isBusy}
          />
        ) : null
      }
    >
      <Tabs value={tab}>
        <TabsContent value="tasks" className="mt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('admin-page.tasks-table.name')}</TableHead>
                <TableHead>{t('admin-page.tasks-table.organization')}</TableHead>
                <TableHead>{t('admin-page.tasks-table.project')}</TableHead>
                <TableHead>{t('admin-page.tasks-table.status')}</TableHead>
                <TableHead>{t('admin-page.tasks-table.creator')}</TableHead>
                <TableHead>{t('admin-page.tasks-table.doers')}</TableHead>
                <TableHead>{t('admin-page.tasks-table.tags')}</TableHead>
                <TableHead>{t('admin-page.tasks-table.created')}</TableHead>
                <TableHead className="text-right">{t('admin-page.users-table.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayTasks.map((task) => {
                const doers = getAdminTaskDoerUsers(task)
                const priority = task.priority as TaskPriority | ''
                return (
                <TableRow key={task.id}>
                  <TableCell className="relative pl-4">
                    <span
                      aria-hidden
                      className="absolute bottom-1.5 left-0 top-1.5 w-1 rounded-full"
                      style={
                        priority
                          ? getPriorityColorStyle(priority, 'background')
                          : { backgroundColor: 'var(--border)' }
                      }
                      title={priority ? t(`fields.priority-types.${priority}`) : undefined}
                    />
                    <div className="flex max-w-[16rem] flex-col">
                      <span className="truncate font-medium" title={task.name}>
                        {task.name}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">{task.slug}</span>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[180px]">
                    <SiteNameChip
                      value={task.organization_name}
                      toneKey={`org-${task.organization_id || task.organization_name}`}
                    />
                  </TableCell>
                  <TableCell>
                    <SiteNameChip value={task.project_name} toneKey={`project-${task.project_id}`} />
                  </TableCell>
                  <TableCell>
                    <SiteNameChip
                      value={task.status_name_ru || task.status_name_en}
                      toneKey={`status-${task.status_id}`}
                    />
                  </TableCell>
                  <TableCell className="min-w-[180px]">
                    <AdminUserCell user={getAdminTaskCreator(task)} compact />
                  </TableCell>
                  <TableCell>
                    {doers.length > 0 ? (
                      <AdminAvatarStack users={doers} max={4} showCount={false} className="w-auto" />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(task.tags ?? []).length > 0 ? (
                        task.tags?.map((tag) => (
                          <SiteNameChip key={tag} value={tag} toneKey={`tag-${tag}`} />
                        ))
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatAdminDateShort(task.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={isBusy}
                          aria-label={t('admin-page.user-edit.menu')}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditingTask(task)}>
                          <Pencil />
                          {t('admin-page.user-edit.edit')}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => handleDeleteTask(task.id, task.name)}
                        >
                          <Trash2 />
                          {t('admin-page.user-edit.delete')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="statuses" className="mt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('admin-page.statuses-table.name')}</TableHead>
                <TableHead>{t('admin-page.statuses-table.project')}</TableHead>
                <TableHead>{t('admin-page.statuses-table.position')}</TableHead>
                <TableHead className="text-right">{t('admin-page.users-table.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(statusesQuery.data?.results ?? []).map((status) => (
                <TableRow key={status.id}>
                  <TableCell>
                    <div className="flex flex-col items-start gap-1">
                      <SiteNameChip
                        value={status.name_ru || status.name_en}
                        toneKey={`status-${status.id}`}
                      />
                      {status.name_en && status.name_ru ? (
                        <span className="pl-1 text-xs text-muted-foreground">{status.name_en}</span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <SiteNameChip
                      value={projectNameById.get(status.project_id) || (status.project_id ? String(status.project_id) : '')}
                      toneKey={`project-${status.project_id}`}
                    />
                  </TableCell>
                  <TableCell>
                    <SiteNameChip
                      value={String(status.position)}
                      toneKey={`position-${status.position}`}
                      className="min-w-6 justify-center px-2"
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={isBusy}
                          aria-label={t('admin-page.user-edit.menu')}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditingStatus(status)}>
                          <Pencil />
                          {t('admin-page.user-edit.edit')}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => handleDeleteStatus(status.id, status.name_ru || status.name_en)}
                        >
                          <Trash2 />
                          {t('admin-page.user-edit.delete')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="tags" className="mt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('admin-page.tags-table.name')}</TableHead>
                <TableHead>{t('admin-page.tags-table.project')}</TableHead>
                <TableHead>{t('admin-page.tags-table.systemic')}</TableHead>
                <TableHead>{t('admin-page.tags-table.created')}</TableHead>
                <TableHead className="text-right">{t('admin-page.users-table.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(tagsQuery.data?.results ?? []).map((tag) => (
                <TableRow key={tag.id}>
                  <TableCell>
                    <SiteNameChip value={tag.name} toneKey={`tag-${tag.id}`} />
                  </TableCell>
                  <TableCell>
                    <SiteNameChip
                      value={projectNameById.get(tag.project_id) || (tag.project_id ? String(tag.project_id) : '')}
                      toneKey={`project-${tag.project_id}`}
                    />
                  </TableCell>
                  <TableCell>
                    <SiteNameChip
                      value={tag.is_systemic ? t('admin-page.users-table.yes') : t('admin-page.users-table.no')}
                      toneKey={tag.is_systemic ? 'systemic-yes' : 'systemic-no'}
                    />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatAdminDateShort(tag.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" disabled={isBusy} aria-label={t('admin-page.users-table.actions')}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditingTag(tag)}>
                          <Pencil />
                          {t('admin-page.user-edit.edit')}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => handleDeleteTag(tag.id, tag.name)}
                        >
                          <Trash2 />
                          {t('admin-page.user-edit.delete')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>
      </Tabs>
    </AdminSectionShell>

    <AdminTaskCreateDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
    <AdminTaskStatusDialog
      open={isStatusCreateOpen || Boolean(editingStatus)}
      status={editingStatus}
      onOpenChange={(open) => {
        if (!open) {
          setIsStatusCreateOpen(false)
          setEditingStatus(null)
        }
      }}
    />
    <AdminTaskTagDialog
      open={isTagCreateOpen || Boolean(editingTag)}
      tag={editingTag}
      onOpenChange={(open) => {
        if (!open) {
          setIsTagCreateOpen(false)
          setEditingTag(null)
        }
      }}
    />
    <AdminTaskEditDialog
      task={editingTask}
      open={Boolean(editingTask)}
      onOpenChange={(open) => {
        if (!open) setEditingTask(null)
      }}
    />
    <AdminDeleteConfirmDialog
      open={Boolean(target)}
      onOpenChange={(open) => {
        if (!open) {
          closeDeleteDialog()
        }
      }}
      entityType={target?.type ?? 'task'}
      entityName={target?.name ?? ''}
      isDeleting={isDeleting}
      onConfirm={confirmDelete}
    />
    </>
  )
}

function doersFromTask(task: Task): AdminTaskDoer[] {
  return (task.doers ?? []).flatMap((doer) => {
    const user = doer.user
    if (!user?.id) return []
    return [
      {
        id: doer.id,
        user: {
          id: user.id,
          email: user.email,
          full_name: user.full_name,
          avatar: user.avatar,
        },
      },
    ]
  })
}

function ProjectTaskIndex({
  projectId,
  onTasks,
}: {
  projectId: number
  onTasks: (projectId: number, tasks: Task[]) => void
}) {
  const { data } = useGetTasksQuery(
    { projectId, params: { limit: 200, offset: 0 } },
    { skip: !projectId },
  )

  useEffect(() => {
    if (data?.results) onTasks(projectId, data.results)
  }, [data, onTasks, projectId])

  return null
}
