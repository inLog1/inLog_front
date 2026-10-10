import { zodResolver } from '@hookform/resolvers/zod'
import { CalendarIcon, EyeIcon, FlagIcon, Kanban, Loader2, TagIcon, UserIcon } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { toast } from 'sonner'
import { z } from 'zod'
import {
  platformAdminApi,
  useAddAdminTaskMemberMutation,
  useAddAdminTaskSupervisorMutation,
  useGetAdminProjectMembersQuery,
  useGetAdminTaskDoersQuery,
  useGetAdminTaskStatusesQuery,
  useGetAdminTaskSupervisorsQuery,
  useGetAdminTaskTagsQuery,
  useRemoveAdminTaskMemberMutation,
  useRemoveAdminTaskSupervisorMutation,
} from '../../../entities/platform-admin/model/platformAdminSlice'
import type { AdminTask } from '../../../entities/platform-admin/model/types'
import type { Task, TaskPriority } from '../../../entities/task/model/types'
import {
  taskApi,
  useAddTaskTagMutation,
  useGetTaskQuery,
  useUpdateTaskMutation,
} from '../../../entities/task/model/taskSlice'
import { DATE_VIEW_FORMAT, priorityTypes } from '../../../shared/config/constants'
import { format } from 'date-fns'
import { getPriorityColorStyle } from '../../../shared/lib/utils'
import type { TaskUpdate } from '../../../shared/types/dto/task'
import { DatePicker } from '../../../shared/ui/date-picker'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../shared/ui/dialog'
import { EditableField } from '../../../shared/ui/editable-field'
import { Form } from '../../../shared/ui/form'
import { Label } from '../../../shared/ui/label'
import { Switch } from '../../../shared/ui/switch'
import { TagsInput } from '../../../shared/ui/tags-input'
import TaskDescription from '../../task-details/ui/TaskDescription'

const PRIORITIES = Object.values(priorityTypes)
const NO_SUPERVISOR = '__none__'

const taskSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  priority: z.string(),
  status: z.string(),
  due_date_start: z.date().nullable(),
  due_date_end: z.date().nullable(),
  doers: z.array(z.string()),
  supervisor: z.string(),
  tags: z.array(z.string()),
})

type FormValues = z.infer<typeof taskSchema>

interface AdminTaskEditDialogProps {
  task: AdminTask | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

function supervisorUserId(task?: Task | null) {
  const supervisor = task?.supervisor
  if (!supervisor || typeof supervisor !== 'object' || !('user' in supervisor)) return ''
  return supervisor.user?.id ? String(supervisor.user.id) : ''
}

export function AdminTaskEditDialog({ task, open, onOpenChange }: AdminTaskEditDialogProps) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const [updateTask] = useUpdateTaskMutation()
  const [addDoer] = useAddAdminTaskMemberMutation()
  const [deleteDoer] = useRemoveAdminTaskMemberMutation()
  const [addSupervisor] = useAddAdminTaskSupervisorMutation()
  const [deleteSupervisor] = useRemoveAdminTaskSupervisorMutation()
  const [addTag] = useAddTaskTagMutation()
  const { data: fullTask, isFetching, isError } = useGetTaskQuery(
    {
      projectId: task?.project_id ?? 0,
      taskSlug: task?.slug ?? '',
      archived: Boolean(task?.archived),
    },
    { skip: !open || !task?.project_id || !task.slug },
  )
  const { data: statuses } = useGetAdminTaskStatusesQuery(
    { limit: 100, offset: 0, project: task?.project_id },
    { skip: !open || !task },
  )
  const { data: members } = useGetAdminProjectMembersQuery(task?.project_id ?? 0, {
    skip: !open || !task?.project_id,
  })
  const { data: tagsCatalog } = useGetAdminTaskTagsQuery(
    { limit: 100, offset: 0, project: task?.project_id },
    { skip: !open || !task },
  )
  const { data: doerRows } = useGetAdminTaskDoersQuery(task?.id ?? 0, { skip: !open || !task })
  const { data: supervisorRows } = useGetAdminTaskSupervisorsQuery(task?.id ?? 0, { skip: !open || !task })
  const [archived, setArchived] = useState(false)
  const [isTemplate, setIsTemplate] = useState(false)
  const appliedKey = useRef<string | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      name: '',
      description: '',
      priority: priorityTypes.medium,
      status: '',
      due_date_start: null,
      due_date_end: null,
      doers: [],
      supervisor: NO_SUPERVISOR,
      tags: [],
    },
  })

  const formKey = fullTask ? `full-${fullTask.id}` : isError && task ? `fallback-${task.id}` : null

  useEffect(() => {
    if (!open) {
      appliedKey.current = null
      return
    }
    if (!task || !formKey || appliedKey.current === formKey) return
    appliedKey.current = formKey
    form.reset({
      name: fullTask?.name || task.name,
      description: fullTask?.description || '',
      priority: fullTask?.priority || task.priority || priorityTypes.medium,
      status: String(fullTask?.status?.id || task.status_id || ''),
      due_date_start: fullTask?.due_date_start ? new Date(fullTask.due_date_start) : null,
      due_date_end: fullTask?.due_date_end ? new Date(fullTask.due_date_end) : null,
      doers: (fullTask?.doers ?? []).flatMap((doer) => (doer.user?.id ? [String(doer.user.id)] : [])),
      supervisor: supervisorUserId(fullTask) || NO_SUPERVISOR,
      tags: (fullTask?.tags ?? []).flatMap((tag) => (tag.name ? [tag.name] : [])),
    })
    setArchived(fullTask?.archived ?? task.archived)
    setIsTemplate(Boolean(fullTask?.is_template ?? task.is_template))
  }, [form, formKey, fullTask, open, task])

  const people = useMemo(() => {
    const map = new Map<number, string>()
    for (const member of members ?? []) {
      map.set(member.user.id, member.user.full_name || member.user.email)
    }
    for (const doer of fullTask?.doers ?? []) {
      if (doer.user?.id) map.set(doer.user.id, doer.user.full_name || doer.user.email)
    }
    const supervisor = fullTask?.supervisor
    if (supervisor && 'user' in supervisor && supervisor.user?.id) {
      map.set(supervisor.user.id, supervisor.user.full_name || supervisor.user.email)
    }
    return [...map.entries()].map(([id, label]) => ({ value: String(id), label }))
  }, [fullTask, members])

  const tagOptions = useMemo(() => {
    const names = new Set<string>()
    for (const tag of tagsCatalog?.results ?? []) if (tag.name) names.add(tag.name)
    for (const tag of fullTask?.tags ?? []) if (tag.name) names.add(tag.name)
    return [...names]
  }, [fullTask, tagsCatalog?.results])

  if (!task) return null

  const refreshLists = () => {
    dispatch(taskApi.util.invalidateTags(['Tasks', 'Task']))
    dispatch(platformAdminApi.util.invalidateTags([{ type: 'AdminTasks', id: 'LIST' }]))
  }

  const saveTask = async (data: Partial<TaskUpdate>) => {
    await updateTask({
      projectId: task.project_id,
      taskSlug: fullTask?.slug || task.slug,
      archived: fullTask?.archived ?? task.archived,
      data: { id: fullTask?.id ?? task.id, ...data },
    }).unwrap()
    refreshLists()
  }

  const updateField = async (field: keyof FormValues, value: FormValues[keyof FormValues]) => {
    const previous = form.getValues(field)
    const toastId = toast.loading(t('notice-list.saving-task-data'))
    try {
      if (field === 'doers') {
        await changeDoers(value as string[])
      } else if (field === 'supervisor') {
        await changeSupervisor(String(value))
      } else if (field === 'tags') {
        await changeTags(value as string[])
      } else if (field === 'due_date_start' || field === 'due_date_end') {
        const date = value instanceof Date ? value.toISOString() : null
        await saveTask({ [field]: date } as Partial<TaskUpdate>)
      } else if (field === 'status') {
        await saveTask({ status: Number(value) })
      } else {
        await saveTask({ [field]: value } as Partial<TaskUpdate>)
      }
      form.setValue(field, value as never)
      toast.success(t('notice-list.task-data-saved-successfully'))
    } catch (error) {
      form.setValue(field, previous as never)
      toast.error(t('errors.something-went-wrong'))
      console.error(error)
    } finally {
      toast.dismiss(toastId)
    }
  }

  const changeDoers = async (nextIds: string[]) => {
    const previous = form.getValues('doers') || []
    const known = new Map((doerRows ?? []).flatMap((doer) => (doer.user?.id ? [[String(doer.user.id), doer.id] as const] : [])))
    for (const userId of previous) {
      if (nextIds.includes(userId)) continue
      const doerId = known.get(userId)
      if (doerId) await deleteDoer({ taskId: task.id, doerId }).unwrap()
    }
    for (const userId of nextIds) {
      if (previous.includes(userId)) continue
      await addDoer({ taskId: task.id, userId: Number(userId), projectId: task.project_id }).unwrap()
    }
  }

  const changeSupervisor = async (nextUserId: string) => {
    const previous = form.getValues('supervisor')
    const normalized = nextUserId === NO_SUPERVISOR ? '' : nextUserId
    const current = previous === NO_SUPERVISOR ? '' : previous
    if (normalized === current) return
    const record = supervisorRows?.[0]
    if (record?.id) await deleteSupervisor({ taskId: task.id, supervisorId: record.id }).unwrap()
    if (normalized) {
      await addSupervisor({ taskId: task.id, userId: Number(normalized), projectId: task.project_id }).unwrap()
    }
  }

  const changeTags = async (nextNames: string[]) => {
    const known = [
      ...(tagsCatalog?.results ?? []).map((tag) => ({ id: tag.id, name: tag.name })),
      ...(fullTask?.tags ?? []).map((tag) => ({ id: tag.id, name: tag.name || '' })),
    ]
    const tagIds: number[] = []
    for (const tagName of nextNames) {
      const existing = known.find((tag) => tag.name === tagName && tag.id)
      if (existing?.id) {
        tagIds.push(existing.id)
        continue
      }
      const created = await addTag({ projectId: task.project_id, data: { name: tagName } }).unwrap()
      if (created?.id) tagIds.push(created.id)
    }
    await saveTask({ tags: tagIds })
  }

  const saveFlag = async (field: 'archived' | 'is_template', value: boolean) => {
    const previous = field === 'archived' ? archived : isTemplate
    if (field === 'archived') setArchived(value)
    else setIsTemplate(value)
    const toastId = toast.loading(t('notice-list.saving-task-data'))
    try {
      await saveTask({ [field]: value })
      toast.success(t('notice-list.task-data-saved-successfully'))
    } catch (error) {
      if (field === 'archived') setArchived(previous)
      else setIsTemplate(previous)
      toast.error(t('errors.something-went-wrong'))
      console.error(error)
    } finally {
      toast.dismiss(toastId)
    }
  }

  const statusOptions = (statuses?.results ?? []).map((status) => ({
    value: String(status.id),
    label: status.name_ru || status.name_en,
  }))
  if (task.status_id && !statusOptions.some((status) => status.value === String(task.status_id))) {
    statusOptions.unshift({
      value: String(task.status_id),
      label: task.status_name_ru || task.status_name_en || t('fields.not-specified'),
    })
  }
  const creatorName = fullTask?.creator?.full_name || fullTask?.creator?.email || task.creator_name || task.creator_email
  const fieldLabel = (label: string, icon: React.ReactNode) => (
    <span className="flex items-center gap-2">
      {icon}
      {label}
    </span>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(90vh,52rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>{t('admin-page.edit-task')}</DialogTitle>
        </DialogHeader>
        {isFetching && !fullTask && !isError ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Form {...form}>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
              <EditableField<FormValues>
                name="name"
                label={t('fields.name')}
                control={form.control}
                onSave={(name, value) => updateField(name, value)}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <EditableField<FormValues>
                  name="priority"
                  label={fieldLabel(t('fields.priority'), <FlagIcon className="h-4 w-4" />)}
                  control={form.control}
                  type="select"
                  options={PRIORITIES.map((item) => ({
                    value: item,
                    label: t(`fields.priority-types.${item}`),
                  }))}
                  renderOption={(option) => (
                    <span className="flex items-center gap-2">
                      <span
                        className="h-3.5 w-3.5 rounded-[4px]"
                        style={getPriorityColorStyle(option.value as TaskPriority, 'background')}
                      />
                      {option.label}
                    </span>
                  )}
                  renderValue={(value) => (
                    <span className="flex items-center gap-2">
                      <span
                        className="h-3.5 w-3.5 rounded-[4px]"
                        style={getPriorityColorStyle(value as TaskPriority, 'background')}
                      />
                      {t(`fields.priority-types.${value}`)}
                    </span>
                  )}
                  onSave={(name, value) => updateField(name, value)}
                />
                <EditableField<FormValues>
                  name="status"
                  label={fieldLabel(t('fields.status'), <Kanban className="h-4 w-4" />)}
                  control={form.control}
                  type="select"
                  options={statusOptions}
                  renderValue={(value) =>
                    statusOptions.find((status) => status.value === String(value))?.label || t('fields.not-specified')
                  }
                  onSave={(name, value) => updateField(name, value)}
                />
                <EditableField<FormValues>
                  name="due_date_start"
                  label={fieldLabel(t('fields.due-date-start'), <CalendarIcon className="h-4 w-4" />)}
                  control={form.control}
                  type="custom"
                  renderValue={(value) => (
                    <span>{value ? format(new Date(value), DATE_VIEW_FORMAT) : t('fields.not-specified')}</span>
                  )}
                  renderCustom={(value, save) => <DatePicker value={value ?? undefined} onChange={(date) => save(date ?? null)} />}
                  onSave={(name, value) => updateField(name, value)}
                />
                <EditableField<FormValues>
                  name="due_date_end"
                  label={fieldLabel(t('fields.due-date-end'), <CalendarIcon className="h-4 w-4" />)}
                  control={form.control}
                  type="custom"
                  renderValue={(value) => (
                    <span>{value ? format(new Date(value), DATE_VIEW_FORMAT) : t('fields.not-specified')}</span>
                  )}
                  renderCustom={(value, save) => <DatePicker value={value ?? undefined} onChange={(date) => save(date ?? null)} />}
                  onSave={(name, value) => updateField(name, value)}
                />
                <EditableField<FormValues>
                  name="doers"
                  label={fieldLabel(t('fields.assignees'), <UserIcon className="h-4 w-4" />)}
                  control={form.control}
                  type="multiple-select"
                  options={people}
                  onSave={(name, value) => updateField(name, value)}
                />
                <EditableField<FormValues>
                  name="supervisor"
                  label={fieldLabel(t('fields.supervisor'), <EyeIcon className="h-4 w-4" />)}
                  control={form.control}
                  type="select"
                  options={[{ value: NO_SUPERVISOR, label: t('fields.not-specified') }, ...people]}
                  renderValue={(value) => {
                    if (!value || value === NO_SUPERVISOR) return t('fields.not-specified')
                    return people.find((person) => person.value === String(value))?.label || t('fields.not-specified')
                  }}
                  onSave={(name, value) => updateField(name, value)}
                />
              </div>
              <EditableField<FormValues>
                name="tags"
                label={fieldLabel(t('fields.tags'), <TagIcon className="h-4 w-4" />)}
                control={form.control}
                type="custom"
                renderValue={(value: string[]) =>
                  value?.length ? value.join(', ') : t('fields.not-specified')
                }
                renderCustom={(value, save) => (
                  <TagsInput
                    value={value || []}
                    options={tagOptions}
                    onChange={(tags) => save(tags)}
                    placeholder={t('fields.add-tags')}
                    maxTags={10}
                  />
                )}
                onSave={(name, value) => updateField(name, value)}
              />
              <EditableField<FormValues>
                name="description"
                label={t('fields.description')}
                control={form.control}
                type="custom"
                renderValue={(value) =>
                  value ? (
                    <span className="line-clamp-3" dangerouslySetInnerHTML={{ __html: value }} />
                  ) : (
                    t('fields.not-specified')
                  )
                }
                renderCustom={(value, save) => (
                  <TaskDescription value={value || ''} onChange={(next) => save(next)} />
                )}
                onSave={(name, value) => updateField(name, value)}
              />
              {creatorName ? (
                <div className="space-y-2">
                  <Label>{t('fields.creator')}</Label>
                  <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">{creatorName}</div>
                </div>
              ) : null}
              <div className="space-y-3 rounded-lg border border-border px-3 py-3">
                <label className="flex items-center justify-between gap-3 text-sm">
                  <span>{t('admin-page.tasks-table.archived')}</span>
                  <Switch checked={archived} onCheckedChange={(value) => saveFlag('archived', value)} />
                </label>
                <label className="flex items-center justify-between gap-3 text-sm">
                  <span>{t('admin-page.tasks-table.template')}</span>
                  <Switch checked={isTemplate} onCheckedChange={(value) => saveFlag('is_template', value)} />
                </label>
              </div>
            </div>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  )
}
