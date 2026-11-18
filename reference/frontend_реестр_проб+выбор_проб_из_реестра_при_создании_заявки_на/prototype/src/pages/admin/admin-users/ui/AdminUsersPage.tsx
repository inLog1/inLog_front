import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useSelector } from 'react-redux'
import {
  useDeleteAdminUserMutation,
  useGetAdminUsersQuery,
  useUpdateAdminUserRoleMutation,
} from '../../../../entities/platform-admin/model/platformAdminSlice'
import { selectUser } from '../../../../entities/user/model/selectors'
import { ADMIN_PAGE_SIZE, formatAdminDate } from '../../../../features/platform-admin/lib/format'
import { useAdminDeleteDialog } from '../../../../features/platform-admin/lib/useAdminDeleteDialog'
import { AdminDeleteConfirmDialog } from '../../../../features/platform-admin/ui/AdminDeleteConfirmDialog'
import { AdminPagination } from '../../../../features/platform-admin/ui/AdminPagination'
import { AdminSearchBar } from '../../../../features/platform-admin/ui/AdminSearchBar'
import { AdminSectionShell } from '../../../../features/platform-admin/ui/AdminSectionShell'
import {
  canManageUserRoles,
  UserRoleSelect,
} from '../../../../features/platform-admin/ui/UserRoleSelect'
import type { PlatformRole } from '../../../../shared/types/platform-role'
import { Badge } from '../../../../shared/ui/badge'
import { Button } from '../../../../shared/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../../shared/ui/table'

export function AdminUsersPage() {
  const { t } = useTranslation()
  const currentUser = useSelector(selectUser)
  const [search, setSearch] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [offset, setOffset] = useState(0)
  const canManageRoles = canManageUserRoles(currentUser?.role)

  const { data, isLoading, isFetching } = useGetAdminUsersQuery({
    limit: ADMIN_PAGE_SIZE,
    offset,
    search: appliedSearch || undefined,
  })
  const [deleteUser, { isLoading: isDeletingUser }] = useDeleteAdminUserMutation()
  const [updateRole, { isLoading: isUpdatingRole }] = useUpdateAdminUserRoleMutation()
  const { target, isDeleting, openDeleteDialog, closeDeleteDialog, confirmDelete } =
    useAdminDeleteDialog()

  const users = data?.results ?? []
  const isBusy = isLoading || isFetching || isDeletingUser || isUpdatingRole || isDeleting

  const handleSearch = () => {
    setAppliedSearch(search.trim())
    setOffset(0)
  }

  const handleDelete = (userId: number, email: string) => {
    openDeleteDialog({
      type: 'user',
      name: email,
      onConfirm: async () => {
        try {
          await deleteUser(userId).unwrap()
          toast.success(t('admin-page.user-deleted'))
        } catch (error) {
          toast.error(t('errors.something-went-wrong'))
          console.error(error)
          throw error
        }
      },
    })
  }

  const handleRoleChange = async (userId: number, role: PlatformRole) => {
    try {
      await updateRole({ userId, role }).unwrap()
      toast.success(t('admin-page.user-role-updated'))
    } catch (error) {
      toast.error(t('errors.something-went-wrong'))
      console.error(error)
    }
  }

  return (
    <>
    <AdminSectionShell
      title={t('admin-page.users')}
      description={t('admin-page.users-description')}
      isLoading={isLoading}
      isEmpty={!isLoading && users.length === 0}
      toolbar={
        <AdminSearchBar
          value={search}
          onChange={setSearch}
          onSubmit={handleSearch}
          placeholder={t('admin-page.search-users')}
          actionLabel={t('admin-page.search')}
        />
      }
      footer={
        data ? (
          <AdminPagination
            count={data.count}
            offset={offset}
            limit={ADMIN_PAGE_SIZE}
            onChange={setOffset}
            isLoading={isBusy}
          />
        ) : null
      }
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('admin-page.users-table.email')}</TableHead>
            <TableHead>{t('admin-page.users-table.name')}</TableHead>
            <TableHead>{t('admin-page.users-table.role')}</TableHead>
            <TableHead>{t('admin-page.users-table.verified')}</TableHead>
            <TableHead>{t('admin-page.users-table.registered-at')}</TableHead>
            <TableHead className="text-right">{t('admin-page.users-table.actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => {
            const isSelf = currentUser?.id === user.id
            const isTargetSuperAdmin = user.role === 'super_admin'

            return (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.email}</TableCell>
                <TableCell>{user.full_name || '—'}</TableCell>
                <TableCell>
                  <UserRoleSelect
                    role={user.role}
                    canManage={canManageRoles && !isSelf}
                    disabled={isBusy}
                    onChange={(role) => handleRoleChange(user.id, role)}
                  />
                </TableCell>
                <TableCell>
                  <Badge variant={user.is_email_verified ? 'default' : 'secondary'}>
                    {user.is_email_verified
                      ? t('admin-page.users-table.yes')
                      : t('admin-page.users-table.no')}
                  </Badge>
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {formatAdminDate(user.created_at)}
                </TableCell>
                <TableCell className="text-right">
                  {isTargetSuperAdmin ? (
                    <span className="text-xs text-muted-foreground">—</span>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={isSelf || isBusy}
                      onClick={() => handleDelete(user.id, user.email)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </AdminSectionShell>

    <AdminDeleteConfirmDialog
      open={Boolean(target)}
      onOpenChange={(open) => {
        if (!open) {
          closeDeleteDialog()
        }
      }}
      entityType={target?.type ?? 'user'}
      entityName={target?.name ?? ''}
      isDeleting={isDeleting}
      onConfirm={confirmDelete}
    />
    </>
  )
}
