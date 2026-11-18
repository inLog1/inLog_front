import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  useDeleteAdminTaskMutation,
  useDeleteAdminTaskStatusMutation,
  useDeleteAdminTaskTagMutation,
  useGetAdminTasksQuery,
  useGetAdminTaskStatusesQuery,
  useGetAdminTaskTagsQuery,
} from '../../../../entities/platform-admin/model/platformAdminSlice'
import { ADMIN_PAGE_SIZE, formatAdminDateShort } from '../../../../features/platform-admin/lib/format'
import { useAdminDeleteDialog } from '../../../../features/platform-admin/lib/useAdminDeleteDialog'
import {
  getAdminTaskCreator,
  getAdminTaskMembers,
} from '../../../../features/platform-admin/lib/task-users'
import { AdminAvatarStack } from '../../../../features/platform-admin/ui/AdminAvatarStack'
import { AdminDeleteConfirmDialog } from '../../../../features/platform-admin/ui/AdminDeleteConfirmDialog'
import { AdminPagination } from '../../../../features/platform-admin/ui/AdminPagination'
import { AdminSearchBar } from '../../../../features/platform-admin/ui/AdminSearchBar'
import { AdminSectionShell } from '../../../../features/platform-admin/ui/AdminSectionShell'
import { AdminUserCell } from '../../../../features/platform-admin/ui/AdminUserCell'
import { Badge } from '../../../../shared/ui/badge'
import { Button } from '../../../../shared/ui/button'
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
  const [search, setSearch] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [offset, setOffset] = useState(0)

  const tasksQuery = useGetAdminTasksQuery(
    { limit: ADMIN_PAGE_SIZE, offset, search: appliedSearch || undefined },
    { skip: tab !== 'tasks' }
  )
  const statusesQuery = useGetAdminTaskStatusesQuery(
    { limit: ADMIN_PAGE_SIZE, offset },
    { skip: tab !== 'statuses' }
  )
  const tagsQuery = useGetAdminTaskTagsQuery(
    { limit: ADMIN_PAGE_SIZE, offset, search: appliedSearch || undefined },
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

  const handleSearch = () => {
    setAppliedSearch(search.trim())
    setOffset(0)
  }

  const handleTabChange = (value: string) => {
    setTab(value)
    setOffset(0)
    setSearch('')
    setAppliedSearch('')
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
          <Tabs value={tab} onValueChange={handleTabChange}>
            <TabsList>
              <TabsTrigger value="tasks">{t('admin-page.tasks-tab.tasks')}</TabsTrigger>
              <TabsTrigger value="statuses">{t('admin-page.tasks-tab.statuses')}</TabsTrigger>
              <TabsTrigger value="tags">{t('admin-page.tasks-tab.tags')}</TabsTrigger>
            </TabsList>
          </Tabs>
          {(tab === 'tasks' || tab === 'tags') && (
            <AdminSearchBar
              value={search}
              onChange={setSearch}
              onSubmit={handleSearch}
              placeholder={
                tab === 'tasks'
                  ? t('admin-page.search-tasks')
                  : t('admin-page.search-tags')
              }
              actionLabel={t('admin-page.search')}
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
                <TableHead>{t('admin-page.tasks-table.members')}</TableHead>
                <TableHead>{t('admin-page.tasks-table.priority')}</TableHead>
                <TableHead>{t('admin-page.tasks-table.flags')}</TableHead>
                <TableHead>{t('admin-page.tasks-table.created')}</TableHead>
                <TableHead className="text-right">{t('admin-page.users-table.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(tasksQuery.data?.results ?? []).map((task) => (
                <TableRow key={task.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{task.name}</span>
                      <span className="text-xs text-muted-foreground">{task.slug}</span>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[160px]">
                    <div className="flex flex-col">
                      <span className="truncate">{task.organization_name || '—'}</span>
                      {task.organization_id && (
                        <span className="text-xs text-muted-foreground">#{task.organization_id}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span>{task.project_name}</span>
                      <span className="text-xs text-muted-foreground">#{task.project_id}</span>
                    </div>
                  </TableCell>
                  <TableCell>{task.status_name_ru || task.status_name_en}</TableCell>
                  <TableCell className="min-w-[180px]">
                    <AdminUserCell user={getAdminTaskCreator(task)} compact />
                  </TableCell>
                  <TableCell className="min-w-[120px]">
                    <AdminAvatarStack users={getAdminTaskMembers(task)} />
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{task.priority}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {task.archived && (
                        <Badge variant="secondary">{t('admin-page.tasks-table.archived')}</Badge>
                      )}
                      {task.is_template && (
                        <Badge variant="secondary">{t('admin-page.tasks-table.template')}</Badge>
                      )}
                      {task.parent_id && (
                        <Badge variant="outline">{t('admin-page.tasks-table.subtask')}</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatAdminDateShort(task.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={isBusy}
                      onClick={() => handleDeleteTask(task.id, task.name)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
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
                <TableHead>{t('admin-page.statuses-table.created')}</TableHead>
                <TableHead className="text-right">{t('admin-page.users-table.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(statusesQuery.data?.results ?? []).map((status) => (
                <TableRow key={status.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{status.name_ru}</span>
                      <span className="text-xs text-muted-foreground">{status.name_en}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span>{status.project_name}</span>
                      <span className="text-xs text-muted-foreground">#{status.project_id}</span>
                    </div>
                  </TableCell>
                  <TableCell>{status.position}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatAdminDateShort(status.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={isBusy}
                      onClick={() =>
                        handleDeleteStatus(status.id, status.name_ru || status.name_en)
                      }
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
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
                <TableHead>{t('admin-page.tags-table.flags')}</TableHead>
                <TableHead>{t('admin-page.tags-table.created')}</TableHead>
                <TableHead className="text-right">{t('admin-page.users-table.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(tagsQuery.data?.results ?? []).map((tag) => (
                <TableRow key={tag.id}>
                  <TableCell className="font-medium">{tag.name}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span>{tag.project_name}</span>
                      <span className="text-xs text-muted-foreground">#{tag.project_id}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {tag.is_systemic && (
                        <Badge variant="secondary">{t('admin-page.tags-table.systemic')}</Badge>
                      )}
                      {tag.is_orphan && (
                        <Badge variant="outline">{t('admin-page.tags-table.orphan')}</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatAdminDateShort(tag.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={isBusy}
                      onClick={() => handleDeleteTag(tag.id, tag.name)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>
      </Tabs>
    </AdminSectionShell>

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
