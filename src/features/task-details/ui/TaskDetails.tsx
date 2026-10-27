'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { taskApi, useAddTaskCommentMutation, useAddTaskDoerMutation, useAddTaskSupervisorMutation, useAddTaskTagMutation, useCreateTaskFileMutation, useCreateTaskMutation, useDeleteTaskCommentMutation, useDeleteTaskDoerMutation, useDeleteTaskFileMutation, useDeleteTaskMutation, useDeleteTaskSupervisorMutation, useEditTaskCommentMutation, useUpdateTaskMutation } from '../../../entities/task/model/taskSlice'
import { Form } from '../../../shared/ui/form'

import { format } from 'date-fns'
import { CalendarIcon, CircleUserRoundIcon, EyeIcon, FlagIcon, Kanban, LayoutGridIcon, TagIcon, UserIcon, UserPlusIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { toast } from 'sonner'
import { SubTasks } from '../../../entities/subtasks'
import { TaskComments } from '../../../entities/task-comments'
import type { Status, Tag, Task, TaskPriority } from '../../../entities/task/model/types'
import { DATE_REQUEST_FORMAT, DATE_VIEW_FORMAT, priorityTypes } from '../../../shared/config/constants'
import { errorsHandler } from '../../../shared/lib/errors-handler'
import { cn, getPriorityColorStyle } from '../../../shared/lib/utils'
import type { MemberResponse } from '../../../shared/types/dto/project'
import type { TaskUpdate } from '../../../shared/types/dto/task'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../../../shared/ui/accordion'
import { Badge } from '../../../shared/ui/badge'
import { DatePicker } from '../../../shared/ui/date-picker'
import { EditableField } from '../../../shared/ui/editable-field'
import { FileAttachment } from '../../../shared/ui/file-attachment'
import { Label } from '../../../shared/ui/label'
import { ScrollArea } from '../../../shared/ui/scroll-area'
import { TagsInput } from '../../../shared/ui/tags-input'
import TaskDescription from './TaskDescription'
import { Whiteboard } from '../../whiteboard'
import { useTaskFileUrls } from '../model/task-file-url'
import { mayChangeComment, useTaskOperations } from '../../org-project-selector/model/useWorkspaceSection'

const taskSchema = z.object({
  name: z.string().min(1, 'Название обязательно'),
  description: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical', 'important']),
  due_date_start: z.date().nullable(),
  due_date_end: z.date().nullable(),
  deadline: z.date().nullable(),
  status: z.string().optional(),
  supervisor: z.number().optional(),
  doers: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
})

type FormValues = z.infer<typeof taskSchema>

interface Props {
  task: Task
  tasks: Task[]
  tags: Tag[]
  taskSlug: string
  statuses: Status[]
  members: MemberResponse[]
  projectId: number
  organizationId: number
}

const TaskDetails = ({ task, tasks, tags: existingTags, taskSlug, statuses, members, projectId, organizationId }: Props) => {
  const { t, i18n } = useTranslation()
  const [createTask] = useCreateTaskMutation()
  const [updateTask] = useUpdateTaskMutation()
  const [deleteTask] = useDeleteTaskMutation()
  const [addTaskDoer] = useAddTaskDoerMutation()
  const [deleteTaskDoer] = useDeleteTaskDoerMutation()
  const [addTaskSupervisor] = useAddTaskSupervisorMutation()
  const [deleteTaskSupervisor] = useDeleteTaskSupervisorMutation()
  const [addTaskTag] = useAddTaskTagMutation()
  const [addTaskComment] = useAddTaskCommentMutation()
  const [editTaskComment] = useEditTaskCommentMutation()
  const [deleteTaskComment] = useDeleteTaskCommentMutation()
  const [createTaskFile] = useCreateTaskFileMutation()
  const [deleteTaskFile] = useDeleteTaskFileMutation()
  const dispatch = useDispatch()
  const operations = useTaskOperations(organizationId, projectId)
  const actor = members.find((member) => member.user.id === operations.actorId)

  const deny = (allowed: boolean, key: 'tasks-page.no-create' | 'tasks-page.no-update' | 'tasks-page.no-delete' | 'tasks-page.no-assign') => {
    if (allowed) return false
    toast.error(t(key))
    return true
  }

  const [subtasks, setSubtasks] = useState<Task[]>([])
  const displayFiles = useTaskFileUrls(task.files)
  const [openSections, setOpenSections] = useState<string[]>(['task-details', 'description', 'subtasks', 'files', 'comments'])
  const isTemplate = task?.is_template ?? false

  useEffect(() => {
    if(task?.subtasks && task?.subtasks?.length > 0 && tasks.length > 0) {
      setSubtasks(task?.subtasks)
    }
  }, [task?.subtasks, tasks])

  const form = useForm<FormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      name: '',
      description: '',
      priority: 'medium',
      due_date_start: null,
      due_date_end: null,
      deadline: null,
      status: undefined,
      supervisor: undefined,
      doers: [],
      tags: [],
    },
  })

  useEffect(() => {
    if (!task) return

    form.reset({
      name: task.name,
      description: task.description || '',
      priority: task.priority,
      due_date_start: task.due_date_start ? new Date(task.due_date_start) : null,
      due_date_end: task.due_date_end ? new Date(task.due_date_end) : null,
      status: task.status?.id?.toString(),
      supervisor: task.supervisor?.user?.id,
      doers: task.doers?.map((d) => d.user?.id?.toString() || ''),
      tags: task.tags?.map((tag) => tag.name) || [],
    })
  }, [task])

  const checkTaskAccess = async () => {
    let isHasAccess = true
    if (!taskSlug) {
      toast.error(t('errors.task-not-found'))
      return false
    }

    

    if (!projectId) {
      toast.error(t('errors.select-project-first'))
      return false
    }

    return isHasAccess
  }

  const updateField = async (
    field: keyof FormValues,
    value: any,
  ) => {
    const previous = form.getValues(field)
    const isHasAccess = await checkTaskAccess()
    if (!isHasAccess || deny(operations.update, 'tasks-page.no-update')) {
      return
    }

    let toastId: string | number | undefined;

    try {
      const payload = field === 'status'
        ? Number(value)
        : value instanceof Date
          ? format(value, DATE_REQUEST_FORMAT)
          : value
      if (field === 'status' && !Number.isFinite(payload)) {
        toast.error(t('errors.status-not-found'))
        return
      }
      toastId = toast.loading(t('notice-list.saving-task-data'))
      await updateTask({
        projectId: Number(projectId),
        taskSlug: taskSlug || '',
        data: {
          id: task.id,
          [field]: payload,
        } as TaskUpdate,
      }).unwrap()
      toast.success(t('notice-list.task-data-saved-successfully'))
      form.setValue(field, value, {
        shouldDirty: false,
      })
    } catch (error) {
      errorsHandler(error, t)
      form.setValue(field, previous)
    } finally {
      toast.dismiss(toastId)
    }
  }

  const changeSupervisor = async (value: number) => {
    const isHasAccess = await checkTaskAccess()
    if (!isHasAccess || deny(operations.assign, 'tasks-page.no-assign')) {
      return
    }
    const previousValue = form.getValues('supervisor')
    const currentSupervisorId = task.supervisor?.id
    const userId = Number(value)
    let removed = false

    try {
      if (currentSupervisorId) {
        await deleteTaskSupervisor({
          projectId: Number(projectId),
          taskSlug: taskSlug || '',
          supervisorId: currentSupervisorId,
        }).unwrap()
        removed = true
      }

      await addTaskSupervisor({
        projectId: Number(projectId),
        taskSlug: taskSlug || '',
        data: {
          user: userId,
        },
      }).unwrap()

      form.setValue('supervisor', userId, {
        shouldDirty: false,
      })
    } catch (error) {
      errorsHandler(error, t)
      form.setValue('supervisor', removed ? undefined : previousValue, {
        shouldDirty: false,
      })
    }
  }

  const changeDoers = async (value: string[]) => {
    const isHasAccess = await checkTaskAccess()
    if (!isHasAccess || deny(operations.assign, 'tasks-page.no-assign')) {
      return
    }

    const previousValue = form.getValues('doers') || []
    const newUserIds = value.filter((userId) => !previousValue.includes(userId))

    let operationType: 'add' | 'delete' = 'add';
    let targetId: string | null = null;

    if (previousValue.length > value.length) {
      operationType = 'delete'
      targetId = previousValue.find((userId) => !value.includes(userId)) ?? null;
    } else {
      operationType = 'add'
      if (value.length === 1) {
        targetId = value[0] || null
      } else if (value.length === 0) {
        targetId = previousValue[0] || null
        operationType = 'delete'
      } else {
        targetId = newUserIds[0] || null
      }
    }

    if (!targetId) {
      return
    }

    if (operationType === 'delete') {
      try {
        const targetDoer = task.doers?.find((doer) => doer.user?.id?.toString() === targetId)
        if (!targetDoer) {
          return
        }

        await deleteTaskDoer({
          projectId: Number(projectId),
          taskSlug: taskSlug || '',
          doerId: targetDoer.id,
        }).unwrap()
        form.setValue('doers', previousValue.filter((doer) => doer !== targetId), {
          shouldDirty: false,
        })
      } catch (error) {
        errorsHandler(error, t)
        form.setValue('doers', previousValue, {
          shouldDirty: false,
        })
      }

    } else {
      try {
        await addTaskDoer({
          projectId: Number(projectId),
          taskSlug: taskSlug || '',
          data: {
            user: Number(targetId),
          },
        }).unwrap()
        form.setValue('doers', [...previousValue, targetId], {
          shouldDirty: false,
        })
      } catch (error) {
        errorsHandler(error, t)
        form.setValue('doers', previousValue, {
          shouldDirty: false,
        })
      }
    }

  }

  const changeTags = async (value: string[]) => {
    const isHasAccess = await checkTaskAccess()
    if (!isHasAccess || deny(operations.update, 'tasks-page.no-update')) {
      return
    }

    const previousValue = form.getValues('tags') || []

    const operationType: 'add' | 'delete' = previousValue.length < value.length ? 'add' : 'delete'

    if (operationType === 'delete') {
      const deletedTagName = previousValue.find(tag => !value.includes(tag))

      if (!deletedTagName) {
        return
      }

      const currentTagIds = task.tags?.map(tag => tag.id) || []

      const updatedTagIds = currentTagIds.filter(tagId => {
        const tag = task.tags?.find(t => t.id === tagId)
        return tag?.name !== deletedTagName
      })

      try {
        await updateTask({
          projectId: Number(projectId),
          taskSlug: taskSlug || '',
          data: {
            id: task.id,
            tags: updatedTagIds,
          } as TaskUpdate,
        }).unwrap()

        form.setValue('tags', value, {
          shouldDirty: false,
        })

      } catch (error) {
        errorsHandler(error, t)
        form.setValue('tags', previousValue, {
          shouldDirty: false,
        })
      }
    } else {
      const addedTagNames = value.filter(tag => !previousValue.includes(tag))

      if (addedTagNames.length === 0) {
        return
      }

      try {
        let currentTagIds = task.tags?.map(tag => tag.id) || []

        for (const tagName of addedTagNames) {
          const existingTag = existingTags.find(tag => tag.name === tagName)

          if (existingTag) {
            if (!currentTagIds.includes(existingTag.id)) {
              currentTagIds.push(existingTag.id)
            }
          } else {
            const createdTag = await addTaskTag({
              projectId: Number(projectId),
              data: { name: tagName },
            }).unwrap()

            if (createdTag && createdTag.id) {
              currentTagIds.push(createdTag.id)
            }
          }
        }

        await updateTask({
          projectId: Number(projectId),
          taskSlug: taskSlug || '',
          data: {
            id: task.id,
            tags: currentTagIds,
          } as TaskUpdate,
        }).unwrap()

        form.setValue('tags', value, {
          shouldDirty: false,
        })

      } catch (error) {
        errorsHandler(error, t)
        form.setValue('tags', previousValue, {
          shouldDirty: false,
        })
      }
    }
  }

  const addSubtask = async (title: string) => {
    const isHasAccess = await checkTaskAccess()
    if (!isHasAccess || deny(operations.create, 'tasks-page.no-create')) {
      return
    }
    try {
      await createTask({
        projectId: Number(projectId),
        data: {
          name: title,
          parent: task.id,
          is_template: isTemplate,
        },
      }).unwrap()
    } catch (error) {
      errorsHandler(error, t)
    }
  }

  const editSubtask = async (slug: string, title: string, status?: 'completed' | 'incomplete') => {
    let targetStatus;

    if (status) {
      targetStatus = statuses?.find((st) => status === 'completed' ? st.name_en === 'Closed' : st.name_en === 'No status')?.id
    }

    const isHasAccess = await checkTaskAccess()
    if (!isHasAccess || deny(operations.update, 'tasks-page.no-update')) {
      return
    }
    try {
      const updatedSubtask = await updateTask({
        projectId: Number(projectId),
        taskSlug: slug,
        data: {
          name: title,
          ...(targetStatus != null ? { status: targetStatus } : {}),
        },
      }).unwrap()
      setSubtasks((prevSubtasks) => prevSubtasks.map((subtask) => subtask.slug === updatedSubtask?.slug ? updatedSubtask : subtask))
    } catch (error) {
      errorsHandler(error, t)
    }
  }

  const deleteSubtask = async (slug: string) => {
    const isHasAccess = await checkTaskAccess()
    if (!isHasAccess || deny(operations.delete, 'tasks-page.no-delete')) {
      return
    }

    try {
      await deleteTask({
        projectId: Number(projectId),
        taskSlug: slug,
      }).unwrap()

      setSubtasks((prevSubtasks) => prevSubtasks.filter((subtask) => subtask.slug !== slug))
    } catch (error) {
      errorsHandler(error, t)
    }
  }

  const addComment = async (text: string) => {
    const isHasAccess = await checkTaskAccess()
    if (!isHasAccess || deny(operations.update, 'tasks-page.no-update')) {
      return
    }

    try {
      await addTaskComment({
        projectId: Number(projectId),
        taskSlug: taskSlug || '',
        data: { text },
      }).unwrap()
    } catch (error) {
      errorsHandler(error, t)
    }
  }

  const editComment = async (commentId: string | number, text: string) => {
    const isHasAccess = await checkTaskAccess()
    const authorId = task.comments?.find((comment) => comment.id === Number(commentId))?.user?.id
    if (!isHasAccess || deny(operations.update, 'tasks-page.no-update') || !mayChangeComment(true, authorId, operations.actorId)) {
      if (isHasAccess && operations.update) toast.error(t('tasks-page.no-update'))
      return
    }

    try {
      await editTaskComment({
        projectId: Number(projectId),
        taskSlug: taskSlug || '',
        commentId: commentId as number,
        data: { text },
      }).unwrap()
    } catch (error) {
      errorsHandler(error, t)
    }
  }

  const deleteComment = async (commentId: string | number) => {
    const isHasAccess = await checkTaskAccess()
    const authorId = task.comments?.find((comment) => comment.id === Number(commentId))?.user?.id
    if (!isHasAccess || deny(operations.update, 'tasks-page.no-update') || !mayChangeComment(true, authorId, operations.actorId)) {
      if (isHasAccess && operations.update) toast.error(t('tasks-page.no-update'))
      return
    }

    try {
      await deleteTaskComment({
        projectId: Number(projectId),
        taskSlug: taskSlug || '',
        commentId: Number(commentId),
      }).unwrap()
    } catch (error) {
      errorsHandler(error, t)
    }
  }

  const addFile = async (file: File) => {
    const isHasAccess = await checkTaskAccess()
    if (!isHasAccess || deny(operations.update, 'tasks-page.no-update')) {
      return
    }

    let toastId: string | number | undefined
    let stored = false

    try {
      toastId = toast.loading(t('notice-list.adding-file'))
      const newFile = await createTaskFile({
        projectId: Number(projectId),
        taskSlug: taskSlug || '',
        file: file,
      }).unwrap()
      stored = true

      if (newFile) {
        await updateTask({
          projectId: Number(projectId),
          taskSlug: taskSlug || '',
          data: {
            id: task.id,
            files: [...(task.files || []), newFile],
          },
        }).unwrap()
        toast.success(t('notice-list.file-added-successfully'))
      }
      dispatch(taskApi.util.invalidateTags(['Task']))
    } catch (error) {
      if (stored) dispatch(taskApi.util.invalidateTags(['Task']))
      errorsHandler(error, t)
    } finally {
      toast.dismiss(toastId)
    }
  }

  const deleteFile = async (fileId: number) => {
    const isHasAccess = await checkTaskAccess()
    if (!isHasAccess || deny(operations.update, 'tasks-page.no-update')) {
      return
    }

    let toastId: string | number | undefined
    let removed = false

    try {
      toastId = toast.loading(t('notice-list.deleting-file'))
      await deleteTaskFile({
        projectId: Number(projectId),
        taskSlug: taskSlug || '',
        fileId: fileId,
      }).unwrap()
      removed = true

      await updateTask({
        projectId: Number(projectId),
        taskSlug: taskSlug || '',
        data: {
          id: task.id,
          files: task.files?.filter((file) => file.id !== fileId),
        },
      }).unwrap()
      toast.success(t('notice-list.file-deleted-successfully'))
      dispatch(taskApi.util.invalidateTags(['Task']))
    } catch (error) {
      if (removed) dispatch(taskApi.util.invalidateTags(['Task']))
      errorsHandler(error, t)
    } finally {
      toast.dismiss(toastId)
    }
  }


  const fieldLabel = (label: string, icon?: React.ReactNode) => {
    return (
      <div className={cn("flex items-center gap-2")}>
        {icon && icon}
        <span>{label}</span>
      </div>
    )
  }
  const renderStatusValue = (value: number | string) => {
    const targetStatus = statuses && statuses.find((status) => status.id?.toString() === value?.toString())
    if (!targetStatus) {
      return <span>{t('fields.not-specified')}</span>
    }
    return targetStatus[`name${i18n.language === 'ru' ? '_ru' : '_en'}`]
  }

  const renderSupervisorValue = (value: number | string) => {
    if (!value) {
      return <span>{t('fields.not-specified')}</span>
    }
    const targetMember = members.find((member) => member?.user?.id.toString() === value.toString())
    if (!targetMember) {
      return <span>{t('fields.not-specified')}</span>
    }

    return (
      <div className="flex items-center gap-2">
        {targetMember.user?.avatar?.small ? (
          <img src={targetMember.user?.avatar?.small} alt={targetMember.user?.full_name} width={20} height={20} className="rounded-full object-cover" />
        ) : (
          <CircleUserRoundIcon className="w-4 h-4 text-muted-foreground" />
        )}
        <span>{targetMember.user?.full_name}</span>
      </div>
    )
  }

  const renderDoersValue = (value: string[]) => {
    if (!value.length) {
      return <span>{t('fields.not-specified')}</span>
    }
    const targetMembers = members.filter((member) => value.includes(member.user?.id.toString() ?? ''))

    if (!targetMembers.length) {
      return <span>{t('fields.not-specified')}</span>
    }

    return (
      <div className="flex flex-col gap-2">

        {targetMembers.map((member) => (
          <div className="flex items-center gap-2" key={member.user?.id}>
            {
              member.user?.avatar?.small ? (
                <img src={member.user?.avatar?.small} alt={member.user?.full_name} width={20} height={20} className="rounded-full object-cover" />
              ) : (
                <CircleUserRoundIcon className="w-4 h-4 text-muted-foreground" />
              )
            }
            <span>{member.user?.full_name}</span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="w-full h-full">
      <Form {...form}>
        <div className="h-full bg-card/80 backdrop-blur-sm shadow-xl">
          <ScrollArea className="h-full">
            <div className="p-4">
              <EditableField<FormValues>
                name="name"
                label={t('fields.name')}
                control={form.control}
                className="max-w-3xl"
                disabled={!operations.update}
                disabledReason={t('tasks-page.no-update')}
                onSave={(name, value) => updateField(name as keyof FormValues, value)}
              />

              <Accordion
                type="multiple"
                className="mt-4"
                value={openSections}
                onValueChange={setOpenSections}
              >
                <AccordionItem value="task-details">
                  <AccordionTrigger>{isTemplate ? t('templates-page.templates-details') : t('tasks-page.task-details')}</AccordionTrigger>
                  <AccordionContent>
                    <div className="grid grid-cols-2 gap-4">
                      <EditableField<FormValues>
                        name="priority"
                        label={fieldLabel(t('fields.priority'), <FlagIcon className="w-4 h-4" />)}
                        control={form.control}
                        type="select"
                        options={Object.values(priorityTypes).map((priority) => ({
                          label: t(`fields.priority-types.${priority}`),
                          value: priority
                        }))}
                        renderValue={(value) => (
                          <div className="flex items-center gap-2">
                            <div className='w-4 h-4 rounded-[5px]' style={getPriorityColorStyle(value as TaskPriority, 'background')} />
                            <span>{t(`fields.priority-types.${value}`)}</span>
                          </div>
                        )}
                        renderOption={(option) => (
                          <div className="flex items-center gap-2">
                            <div className='w-4 h-4 rounded-[25px]' style={getPriorityColorStyle(option.value as TaskPriority, 'background')} />
                            <span>{t(`fields.priority-types.${option.value}`)}</span>
                          </div>
                        )}

                        className="max-w-3xl"
                        disabled={!operations.update}
                        disabledReason={t('tasks-page.no-update')}
                        onSave={(name, value) => updateField(name as keyof FormValues, value)}
                      />
                      {!!task?.creator && (
                        <div className="flex flex-col gap-2">
                          <div className="flex gap-2">
                            <UserPlusIcon className="w-4 h-4" />
                            <Label >{t('fields.creator')}</Label>
                          </div>
                          <div className="flex items-center gap-2 bg-muted/50 opacity-100 px-2 py-1.5 rounded-md cursor-not-allowed">
                            {task?.creator?.avatar?.small ? (
                              <img src={task?.creator?.avatar?.small} alt={task?.creator?.full_name} width={20} height={20} className="rounded-full object-cover" />
                            ) : (
                              <CircleUserRoundIcon className="w-4 h-4 text-muted-foreground" />
                            )}
                            <span>{task?.creator?.full_name}</span>
                          </div>
                        </div>
                      )}

                      <EditableField<FormValues>
                        name="due_date_start"
                        label={fieldLabel(t('fields.due-date-start'), <CalendarIcon className="w-4 h-4" />)}
                        control={form.control}
                        type="custom"
                        className="max-w-3xl"
                        disabled={!operations.update}
                        disabledReason={t('tasks-page.no-update')}
                        onSave={(name, value) => updateField(name as keyof FormValues, value)}
                        renderValue={(value) => (
                          <span>{value ? format(value, DATE_VIEW_FORMAT) : t('fields.not-specified')}</span>
                        )}
                        renderCustom={(value, save) => (
                          <DatePicker
                            value={value}
                            onChange={(date) => {
                              save(date)
                            }}
                          />
                        )}
                      />
                      <EditableField<FormValues>
                        name="doers"
                        label={fieldLabel(t('fields.assignees'), <UserIcon className="w-4 h-4" />)}
                        control={form.control}
                        type="multiple-select"
                        options={members.map((member: MemberResponse) => ({
                          label: member.user.full_name,
                          value: member.user.id.toString()
                        }))}
                        className="max-w-3xl"
                        isVisible={!isTemplate}
                        disabled={!operations.assign}
                        disabledReason={t('tasks-page.no-assign')}
                        onSave={(_, value: string[]) => changeDoers(value)}
                        renderValue={(value) => (
                          <div className="flex items-center gap-2">
                            {renderDoersValue(value)}
                          </div>
                        )}
                      />
                      <EditableField<FormValues>
                        name="due_date_end"
                        label={fieldLabel(t('fields.due-date-end'), <CalendarIcon className="w-4 h-4" />)}
                        control={form.control}
                        type="custom"
                        className="max-w-3xl"
                        disabled={!operations.update}
                        disabledReason={t('tasks-page.no-update')}
                        onSave={(name, value) => updateField(name as keyof FormValues, value)}
                        renderValue={(value) => (
                          <span>{value ? format(value, DATE_VIEW_FORMAT) : t('fields.not-specified')}</span>
                        )}
                        renderCustom={(value, save) => (
                          <DatePicker
                            value={value}
                            onChange={(date) => {
                              save(date)
                            }}
                          />
                        )}
                      />

                      <EditableField<FormValues>
                        name="supervisor"
                        label={fieldLabel(t('fields.supervisor'), <EyeIcon className="w-4 h-4" />)}
                        control={form.control}
                        type="select"
                        options={members.map((member) => ({
                          label: member.user.full_name || member.user.email || t('fields.not-specified'),
                          value: member.user.id.toString()
                        }))}
                        className="max-w-3xl"
                        isVisible={!isTemplate}
                        disabled={!operations.assign}
                        disabledReason={t('tasks-page.no-assign')}
                        onSave={(_, value) => changeSupervisor(value as number)}
                        renderValue={(value) => (
                          <div className="flex items-center gap-2">
                            {renderSupervisorValue(value)}
                          </div>
                        )}
                      />

                      <EditableField<FormValues>
                        name="status"
                        label={fieldLabel(t('fields.status'), <Kanban className="w-4 h-4" />)}
                        control={form.control}
                        type="select"
                        options={statuses.map((status) => ({
                          label: status.name ?? i18n.language === 'ru' ? status.name_ru ?? '' : status.name_en ?? '',
                          value: status.id.toString()
                        }))}
                        className="max-w-3xl"
                        isVisible={!isTemplate}
                        disabled={!operations.update}
                        disabledReason={t('tasks-page.no-update')}
                        onSave={(name, value) => updateField(name as keyof FormValues, value)}
                        renderValue={(value) => (
                          <div className="flex items-center gap-2">
                            <span>{renderStatusValue(value)}</span>
                          </div>
                        )}
                      />
                      <EditableField<FormValues>
                        name="tags"
                        label={fieldLabel(t('fields.tags'), <TagIcon className="w-4 h-4" />)}
                        control={form.control}
                        type="custom"
                        className="max-w-3xl"
                        disabled={!operations.update}
                        disabledReason={t('tasks-page.no-update')}
                        onSave={(_, value) => changeTags(value)}
                        renderValue={(value) => (
                          <div className="flex flex-wrap gap-2">
                            {value && value.length > 0 ? (
                              value.map((tag: string) => (
                                <Badge key={tag} variant="secondary" className="text-sm">
                                  {tag}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-muted-foreground">{t('fields.not-specified')}</span>
                            )}
                          </div>
                        )}
                        renderCustom={(value, save) => (
                          <TagsInput
                            value={value || []}
                            options={existingTags?.map((tag) => tag.name || '') || []}
                            onChange={(tags) => save(tags)}
                            placeholder={t('fields.add-tags')}
                            maxTags={10}
                          />
                        )}
                      />
                    </div>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem className="w-full" value="description">
                  <AccordionTrigger>{t('fields.description')}</AccordionTrigger>
                  <AccordionContent>
                    <div>
                      <EditableField<FormValues>
                        name="description"
                        type="custom"
                        control={form.control}
                        className="max-w-3xl"
                        disabled={!operations.update}
                        disabledReason={t('tasks-page.no-update')}
                        onSave={(name, value) => updateField(name as keyof FormValues, value)}
                        renderValue={(value) => {
                          if (!value) {
                            return <span>{t('fields.not-specified')}</span>
                          }
                          return <div className="prose dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: value || '' }} />
                        }}
                        renderCustom={(value, save) => (
                          <TaskDescription
                            value={value || ''}
                            onChange={(value) => save(value)}
                          />
                        )}
                      />
                    </div>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem className="w-full" value="whiteboard">
                  <AccordionTrigger>
                    <div className="flex items-center gap-2">
                      <LayoutGridIcon className="w-4 h-4" />
                      {t('whiteboard.title')}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    {openSections.includes('whiteboard') && projectId && taskSlug && (
                      <Whiteboard
                        storageKey={`task-${projectId}-${taskSlug}`}
                        height={480}
                      />
                    )}
                  </AccordionContent>
                </AccordionItem>
                {task.parent === undefined || task.parent === null && (
                  <AccordionItem className="w-full" value="subtasks">
                    <AccordionTrigger>{isTemplate ? t('subtasks-entity.subtemplates') : t('subtasks-entity.subtasks')}</AccordionTrigger>
                    <AccordionContent>
                      <SubTasks
                        subtasks={subtasks.map((subtask) => ({
                          id: subtask.id,
                          title: subtask.name,
                          slug: subtask.slug,
                          completed: subtask?.status?.name_en === 'Closed'
                        }))}
                        isTemplate={isTemplate}
                        onAddSubtask={operations.create ? addSubtask : undefined}
                        addDisabledReason={operations.create ? undefined : t('tasks-page.no-create')}
                        onEditSubtask={operations.update ? editSubtask : undefined}
                        onDeleteSubtask={operations.delete ? deleteSubtask : undefined}
                      />
                    </AccordionContent>
                  </AccordionItem>
                )}
                <AccordionItem className="w-full" value="files">
                  <AccordionTrigger>{t('fields.files')}</AccordionTrigger>
                  <AccordionContent>
                    <FileAttachment
                      files={displayFiles}
                      onUpload={operations.update ? addFile : undefined}
                      uploadDisabledReason={operations.update ? undefined : t('tasks-page.no-update')}
                      onDelete={operations.update ? deleteFile : undefined}
                    />
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem className="w-full" value="comments">
                  <AccordionTrigger>{t('comments-entity.comments')}</AccordionTrigger>
                  <AccordionContent>
                    <TaskComments
                      comments={task.comments ?? []}
                      currentUser={operations.actorId == null ? undefined : {
                        id: operations.actorId,
                        name: actor?.user.full_name || actor?.user.email || '',
                        avatar: actor?.user.avatar?.small,
                      }}
                      onAddComment={operations.update ? addComment : undefined}
                      addDisabledReason={operations.update ? undefined : t('tasks-page.no-update')}
                      onEditComment={operations.update ? editComment : undefined}
                      onDeleteComment={operations.update ? deleteComment : undefined}
                    />
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </ScrollArea>
        </div>
      </Form>
    </div>
  )
}

export default TaskDetails