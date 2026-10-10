import { Loader2, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  useAddAdminTaskMemberMutation,
  useGetAdminTaskDoersQuery,
  useGetAdminUsersQuery,
  useRemoveAdminTaskMemberMutation,
} from '../../../entities/platform-admin/model/platformAdminSlice'
import type { AdminTask, AdminTaskDoer, AdminUser, AdminUserBrief } from '../../../entities/platform-admin/model/types'
import { Button } from '../../../shared/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../shared/ui/dialog'
import { Input } from '../../../shared/ui/input'
import { getAdminTaskMembers, getPersonLetter, personColorClass } from '../lib/task-users'

interface TaskMemberRow {
  doerId: number
  user: AdminUserBrief
}

interface TaskMembersDialogProps {
  task: AdminTask | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

function rowsFromTask(task: AdminTask | null): TaskMemberRow[] {
  if (!task) return []

  const withIds = (task.doers ?? []).flatMap((doer: AdminTaskDoer) =>
    doer.user ? [{ doerId: doer.id, user: doer.user }] : [],
  )
  if (withIds.length > 0) return withIds

  return getAdminTaskMembers(task).map((user) => ({
    doerId: user.id,
    user,
  }))
}

export function TaskMembersDialog({ task, open, onOpenChange }: TaskMembersDialogProps) {
  const { t } = useTranslation()
  const [members, setMembers] = useState<TaskMemberRow[]>([])
  const [userQuery, setUserQuery] = useState('')
  const [appliedUserQuery, setAppliedUserQuery] = useState('')
  const knownUsers = useRef(new Map<number, AdminUserBrief>())
  const [addMember, { isLoading: isAdding }] = useAddAdminTaskMemberMutation()
  const [removeMember, { isLoading: isRemoving }] = useRemoveAdminTaskMemberMutation()
  const { data: doerRows } = useGetAdminTaskDoersQuery(task?.id ?? 0, {
    skip: !open || !task,
  })
  const { data: directory } = useGetAdminUsersQuery(
    { limit: 100, offset: 0 },
    { skip: !open },
  )
  const { data: usersData, isFetching: isSearching } = useGetAdminUsersQuery(
    { limit: 8, offset: 0, search: appliedUserQuery },
    { skip: !open || appliedUserQuery.length < 2 },
  )

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setAppliedUserQuery(userQuery.trim()), 300)
    return () => window.clearTimeout(timeoutId)
  }, [userQuery])

  useEffect(() => {
    for (const user of directory?.results ?? []) {
      knownUsers.current.set(user.id, {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
      })
    }
    for (const user of usersData?.results ?? []) {
      knownUsers.current.set(user.id, {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
      })
    }
  }, [directory?.results, usersData?.results])

  useEffect(() => {
    if (!open || !task) return
    for (const user of getAdminTaskMembers(task)) knownUsers.current.set(user.id, user)
    const fromApi = (doerRows ?? []).map((doer) => {
      const userId = doer.user?.id
      const knownUser = userId ? knownUsers.current.get(userId) : undefined
      return {
        doerId: doer.id,
        user: {
          id: userId ?? doer.id,
          email: knownUser?.email || doer.user?.email || '',
          full_name: knownUser?.full_name || doer.user?.full_name || knownUser?.email || doer.user?.email || '',
        },
      }
    })
    setMembers(fromApi.length > 0 ? fromApi : rowsFromTask(task))
  }, [directory?.results, doerRows, open, task])

  useEffect(() => {
    if (!open) return
    setUserQuery('')
    setAppliedUserQuery('')
  }, [open, task?.id])

  if (!task) return null

  const memberIds = new Set(members.map((member) => member.user.id))
  const userResults = (usersData?.results ?? []).filter((user) => !memberIds.has(user.id))

  const handleAdd = async (user: AdminUser) => {
    try {
      knownUsers.current.set(user.id, {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
      })
      const created = await addMember({
        taskId: task.id,
        projectId: task.project_id,
        userId: user.id,
      }).unwrap()
      setMembers((current) => [
        ...current,
        {
          doerId: created.id,
          user: {
            id: user.id,
            email: user.email,
            full_name: user.full_name || user.email,
          },
        },
      ])
      toast.success(t('admin-page.org-members-added'))
      setUserQuery('')
      setAppliedUserQuery('')
    } catch (error) {
      toast.error(t('errors.something-went-wrong'))
      console.error(error)
    }
  }

  const handleRemove = async (member: TaskMemberRow) => {
    try {
      await removeMember({
        taskId: task.id,
        doerId: member.doerId,
      }).unwrap()
      setMembers((current) => current.filter((item) => item.doerId !== member.doerId))
      toast.success(t('admin-page.org-members-removed'))
    } catch (error) {
      toast.error(t('errors.something-went-wrong'))
      console.error(error)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('admin-page.org-members')}</DialogTitle>
          <DialogDescription>{task.name}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Input
            value={userQuery}
            placeholder={t('admin-page.org-members-search')}
            onChange={(event) => setUserQuery(event.target.value)}
          />

          {appliedUserQuery.length >= 2 && (
            <div className="max-h-40 overflow-auto rounded-lg border border-border">
              {isSearching && userResults.length === 0 ? (
                <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('admin-page.loading')}
                </div>
              ) : userResults.length === 0 ? (
                <p className="px-3 py-2 text-sm text-muted-foreground">{t('admin-page.org-members-none-found')}</p>
              ) : (
                userResults.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-muted"
                    disabled={isAdding}
                    onClick={() => handleAdd(user)}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{user.full_name || user.email}</span>
                      {user.full_name && user.full_name !== user.email && (
                        <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
                      )}
                    </span>
                    <span className="shrink-0 text-xs text-primary">{t('admin-page.org-members-add')}</span>
                  </button>
                ))
              )}
            </div>
          )}

          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('admin-page.org-members-empty')}</p>
          ) : (
            <ul className="space-y-2">
              {members.map((member) => {
                const name = member.user.full_name || member.user.email || '—'
                const letter = getPersonLetter(member.user.full_name, member.user.email)
                return (
                  <li key={member.doerId} className="flex items-center gap-3 rounded-xl border border-border px-3 py-2">
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium ${personColorClass(member.user.email || name)}`}>
                      {letter}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{name}</span>
                      {member.user.email && name !== member.user.email && (
                        <span className="block truncate text-xs text-muted-foreground">{member.user.email}</span>
                      )}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 hover:text-destructive"
                      disabled={isRemoving}
                      aria-label={t('admin-page.org-members-remove')}
                      onClick={() => handleRemove(member)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
