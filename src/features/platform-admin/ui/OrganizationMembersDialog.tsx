import { Loader2, Mail, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import { toast } from 'sonner'
import { selectUser } from '../../../entities/user/model/selectors'
import type { AdminOrganization, AdminOrganizationMember, AdminUser, OrganizationInviteRole, OrganizationMemberRole } from '../../../entities/platform-admin/model/types'
import {
  useCreateAdminOrganizationEmailInvitationMutation,
  useCreateAdminOrganizationMemberMutation,
  useCreateAdminOrganizationUserInvitationMutation,
  useDeleteAdminOrganizationEmailInvitationMutation,
  useDeleteAdminOrganizationMemberMutation,
  useDeleteAdminOrganizationUserInvitationMutation,
  useGetAdminOrganizationEmailInvitationsQuery,
  useGetAdminUsersQuery,
  useLazyGetAdminUsersQuery,
} from '../../../entities/platform-admin/model/platformAdminSlice'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../../../shared/ui/alert-dialog'
import { Badge } from '../../../shared/ui/badge'
import { Button } from '../../../shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../../shared/ui/dialog'
import { Input } from '../../../shared/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../shared/ui/select'
import { getPersonLetter, personColorClass } from '../lib/task-users'

const MEMBER_ROLES: OrganizationMemberRole[] = ['member', 'editor', 'admin']
const INVITE_ROLES: OrganizationInviteRole[] = ['member', 'editor']

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function invitationRows(data: { results?: { id: number; email: string; role: string }[] } | { id: number; email: string; role: string }[] | undefined) {
  if (!data) return []
  if (Array.isArray(data)) return data
  return data.results ?? []
}

interface PendingUserInvite {
  id: number
  email: string
  role: string
}

interface OrganizationMembersDialogProps {
  organization: AdminOrganization | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function OrganizationMembersDialog({
  organization,
  open,
  onOpenChange,
}: OrganizationMembersDialogProps) {
  const { t } = useTranslation()
  const currentUser = useSelector(selectUser)
  const [createMember, { isLoading: isAdding }] = useCreateAdminOrganizationMemberMutation()
  const [deleteMember, { isLoading: isRemoving }] = useDeleteAdminOrganizationMemberMutation()
  const [inviteByEmail, { isLoading: isInvitingEmail }] = useCreateAdminOrganizationEmailInvitationMutation()
  const [inviteExistingUser, { isLoading: isInvitingUser }] = useCreateAdminOrganizationUserInvitationMutation()
  const [deleteEmailInvitation, { isLoading: isDeletingEmailInvite }] = useDeleteAdminOrganizationEmailInvitationMutation()
  const [deleteUserInvitation, { isLoading: isDeletingUserInvite }] = useDeleteAdminOrganizationUserInvitationMutation()
  const [searchUsers] = useLazyGetAdminUsersQuery()
  const [members, setMembers] = useState<AdminOrganizationMember[]>([])
  const [userQuery, setUserQuery] = useState('')
  const [appliedUserQuery, setAppliedUserQuery] = useState('')
  const [role, setRole] = useState<OrganizationMemberRole>('member')
  const [email, setEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<OrganizationInviteRole>('member')
  const [userInvites, setUserInvites] = useState<PendingUserInvite[]>([])
  const [memberToRemove, setMemberToRemove] = useState<AdminOrganizationMember | null>(null)
  const isInviting = isInvitingEmail || isInvitingUser
  const isDeletingInvite = isDeletingEmailInvite || isDeletingUserInvite

  const { data: emailInvitations } = useGetAdminOrganizationEmailInvitationsQuery(
    { organization: organization?.id ?? 0 },
    { skip: !open || !organization },
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
    if (!organization || !open) return
    setMembers(organization.members ?? [])
    setUserQuery('')
    setAppliedUserQuery('')
    setRole('member')
    setEmail('')
    setInviteRole('member')
    setUserInvites([])
    setMemberToRemove(null)
  }, [organization, open])

  const memberUserIds = new Set(members.map((member) => member.user?.id))
  const userResults = (usersData?.results ?? []).filter((user) => !memberUserIds.has(user.id))

  const addMember = async (user: AdminUser) => {
    if (!organization || memberUserIds.has(user.id)) return

    try {
      const created = await createMember({
        user: user.id,
        organization: organization.id,
        role,
      }).unwrap()
      setMembers((current) => [
        ...current,
        {
          id: created.id,
          role: created.role || role,
          user: {
            id: user.id,
            full_name: user.full_name || user.email,
            email: user.email,
          },
        },
      ])
      setUserQuery('')
      setAppliedUserQuery('')
      toast.success(t('admin-page.org-members-added'))
    } catch (error) {
      toast.error(t('errors.something-went-wrong'))
      console.error(error)
    }
  }

  const removeMember = async () => {
    if (!memberToRemove) return

    try {
      await deleteMember(memberToRemove.id).unwrap()
      setMembers((current) => current.filter((member) => member.id !== memberToRemove.id))
      toast.success(t('admin-page.org-members-removed'))
      setMemberToRemove(null)
    } catch (error) {
      toast.error(t('errors.something-went-wrong'))
      console.error(error)
    }
  }

  const inviteMember = async (event: React.FormEvent) => {
    event.preventDefault()
    const normalized = email.trim().toLowerCase()
    if (!isEmail(normalized)) {
      toast.error(t('admin-page.org-members-invalid-email'))
      return
    }
    if (!organization || !currentUser?.id) {
      toast.error(t('errors.something-went-wrong'))
      return
    }
    if (members.some((member) => member.user?.email?.toLowerCase() === normalized)) {
      toast.error(t('admin-page.org-members-already'))
      return
    }
    const emailAlreadyInvited = invitationRows(emailInvitations).some((item) => item.email.toLowerCase() === normalized)
    if (emailAlreadyInvited || userInvites.some((item) => item.email === normalized)) {
      toast.error(t('admin-page.org-members-invite-duplicate'))
      return
    }

    try {
      const found = await searchUsers({ limit: 8, offset: 0, search: normalized }).unwrap()
      const user = found.results.find((item) => item.email.toLowerCase() === normalized)
      if (user) {
        const created = await inviteExistingUser({
          organization: organization.id,
          invited_by: currentUser.id,
          user: user.id,
          role: inviteRole,
        }).unwrap()
        setUserInvites((current) => [...current, { id: created.id, email: normalized, role: inviteRole }])
      } else {
        await inviteByEmail({
          organization: organization.id,
          invited_by: currentUser.id,
          email: normalized,
          role: inviteRole,
        }).unwrap()
      }
      setEmail('')
      toast.success(t('admin-page.org-members-invited', { email: normalized }))
    } catch (error) {
      toast.error(t('errors.something-went-wrong'))
      console.error(error)
    }
  }

  const removeInvite = async (invite: { id: number; kind: 'email' | 'user' }) => {
    try {
      if (invite.kind === 'email') await deleteEmailInvitation(invite.id).unwrap()
      else {
        await deleteUserInvitation(invite.id).unwrap()
        setUserInvites((current) => current.filter((item) => item.id !== invite.id))
      }
      toast.success(t('settings-page.subscribers-invite-removed'))
    } catch (error) {
      toast.error(t('errors.something-went-wrong'))
      console.error(error)
    }
  }

  const pendingInvites = [
    ...invitationRows(emailInvitations).map((item) => ({
      id: item.id,
      email: item.email,
      role: item.role,
      kind: 'email' as const,
    })),
    ...userInvites.map((item) => ({ ...item, kind: 'user' as const })),
  ]

  const roleLabel = (value: string) => {
    if (value === 'admin' || value === 'member' || value === 'editor') {
      return t(`admin-page.org-member-roles.${value}`)
    }
    return value
  }

  const organizationName = organization?.full_name || organization?.short_name || ''

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('admin-page.org-members')}</DialogTitle>
            {organizationName && <DialogDescription>{organizationName}</DialogDescription>}
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Input
                value={userQuery}
                placeholder={t('admin-page.org-members-search')}
                onChange={(event) => setUserQuery(event.target.value)}
              />
              <Select value={role} onValueChange={(value) => setRole(value as OrganizationMemberRole)}>
                <SelectTrigger className="w-40 shrink-0" aria-label={t('admin-page.members-table.role')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MEMBER_ROLES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {t(`admin-page.org-member-roles.${item}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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
                      onClick={() => addMember(user)}
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

            <form onSubmit={inviteMember} className="space-y-2 border-t border-border pt-3">
              <p className="text-sm font-medium">{t('admin-page.org-members-invite')}</p>
              <div className="flex items-center gap-2">
                <Input
                  type="email"
                  value={email}
                  placeholder={t('admin-page.org-members-invite-placeholder')}
                  onChange={(event) => setEmail(event.target.value)}
                />
                <Select value={inviteRole} onValueChange={(value) => setInviteRole(value as OrganizationInviteRole)}>
                  <SelectTrigger className="w-40 shrink-0" aria-label={t('admin-page.members-table.role')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INVITE_ROLES.map((item) => (
                      <SelectItem key={item} value={item}>
                        {t(`admin-page.org-member-roles.${item}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="submit" disabled={isInviting || !email.trim()}>
                  {isInviting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t('admin-page.org-members-invite-action')}
                </Button>
              </div>
            </form>

            {pendingInvites.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">{t('admin-page.org-members-invite-pending')}</p>
                <ul className="space-y-2">
                  {pendingInvites.map((invite) => (
                    <li key={`${invite.kind}-${invite.id}`} className="flex items-center gap-3 rounded-xl border border-dashed border-border px-3 py-2">
                      <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate text-sm">{invite.email}</span>
                      <Badge variant="outline">{roleLabel(invite.role)}</Badge>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 hover:text-destructive"
                        disabled={isDeletingInvite}
                        aria-label={t('settings-page.subscribers-remove-invite')}
                        onClick={() => removeInvite(invite)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {members.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('admin-page.org-members-empty')}</p>
            ) : (
              <ul className="space-y-2">
                {members.map((member) => {
                  const name = member.user?.full_name || member.user?.email || '—'
                  const letter = getPersonLetter(member.user?.full_name, member.user?.email)
                  return (
                    <li key={member.id} className="flex items-center gap-3 rounded-xl border border-border px-3 py-2">
                      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium ${personColorClass(member.user?.email || name)}`}>
                        {letter}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{name}</span>
                        {member.user?.email && name !== member.user.email && (
                          <span className="block truncate text-xs text-muted-foreground">{member.user.email}</span>
                        )}
                      </span>
                      <Badge variant="secondary">{roleLabel(member.role)}</Badge>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 hover:text-destructive"
                        disabled={isRemoving}
                        aria-label={t('admin-page.org-members-remove')}
                        onClick={() => setMemberToRemove(member)}
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

      <AlertDialog open={Boolean(memberToRemove)} onOpenChange={(next) => { if (!next) setMemberToRemove(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin-page.org-members-remove')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('admin-page.org-members-remove-description', {
                name: memberToRemove?.user?.full_name || memberToRemove?.user?.email || '',
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemoving}>{t('buttons.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              disabled={isRemoving}
              className="bg-destructive hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault()
                void removeMember()
              }}
            >
              {isRemoving ? t('buttons.deleting') : t('buttons.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
