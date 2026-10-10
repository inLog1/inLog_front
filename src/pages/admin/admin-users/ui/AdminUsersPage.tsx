import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useSelector } from 'react-redux'
import {
  useDeleteAdminUserMutation,
  useGetAdminFeatureProfilesQuery,
  useGetAdminFeaturesQuery,
  useGetAdminUsersQuery,
} from '../../../../entities/platform-admin/model/platformAdminSlice'
import type { AdminUser } from '../../../../entities/platform-admin/model/types'
import { selectUser } from '../../../../entities/user/model/selectors'
import { ADMIN_PAGE_SIZE, formatAdminDate } from '../../../../features/platform-admin/lib/format'
import { useAdminDeleteDialog } from '../../../../features/platform-admin/lib/useAdminDeleteDialog'
import { AdminDeleteConfirmDialog } from '../../../../features/platform-admin/ui/AdminDeleteConfirmDialog'
import { AdminPagination } from '../../../../features/platform-admin/ui/AdminPagination'
import { AdminSearchBar } from '../../../../features/platform-admin/ui/AdminSearchBar'
import { AdminSectionShell } from '../../../../features/platform-admin/ui/AdminSectionShell'
import { FeatureAccessPanel } from '../../../../features/platform-admin/ui/FeatureAccessPanel'
import { readUserFeatures } from '../../../../features/platform-admin/model/featureProfileActions'
import { PlatformRoleBadge } from '../../../../features/platform-admin/ui/PlatformRoleBadge'
import { UserEditDialog } from '../../../../features/platform-admin/ui/UserEditDialog'
import {
  clearUserAccess,
  useUserAccessDrafts,
} from '../../../../features/platform-admin/model/featureAccessPolicy'
import { Badge } from '../../../../shared/ui/badge'
import { Button } from '../../../../shared/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../../shared/ui/dropdown-menu'
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
  const drafts = useUserAccessDrafts()
  const [search, setSearch] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [offset, setOffset] = useState(0)
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null)

  const { data, isLoading, isFetching } = useGetAdminUsersQuery({
    limit: ADMIN_PAGE_SIZE,
    offset,
    search: appliedSearch || undefined,
  })
  const {
    data: catalog = [],
    isLoading: isCatalogLoading,
    isError: isCatalogError,
  } = useGetAdminFeaturesQuery()
  const {
    data: profiles = [],
    isLoading: isProfilesLoading,
    isError: isProfilesError,
  } = useGetAdminFeatureProfilesQuery()
  const [deleteUser, { isLoading: isDeletingUser }] = useDeleteAdminUserMutation()
  const { target, isDeleting, openDeleteDialog, closeDeleteDialog, confirmDelete } =
    useAdminDeleteDialog()

  const users = data?.results ?? []
  const isBusy = isLoading || isFetching || isDeletingUser || isDeleting

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
          clearUserAccess(userId)
          toast.success(t('admin-page.user-deleted'))
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
      below={<FeatureAccessPanel />}
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
            <TableHead>{t('admin-page.users-table.access')}</TableHead>
            <TableHead className="text-right">{t('admin-page.users-table.actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => {
            const draft = drafts[user.id]
            const role = draft?.role ?? user.role
            const isSelf = currentUser?.id === user.id
            const isTargetSuperAdmin = role === 'super_admin'
            const features = readUserFeatures(user.id, profiles, catalog)
            const openCount = isTargetSuperAdmin || features == null ? catalog.length : features.length
            const catalogReady = !isCatalogLoading && !isProfilesLoading && !isCatalogError && !isProfilesError && catalog.length > 0

            return (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.email}</TableCell>
                <TableCell>{displayName(user, draft?.name, draft?.surname)}</TableCell>
                <TableCell>
                  <PlatformRoleBadge role={role} showSuperAdminHint={isTargetSuperAdmin} />
                </TableCell>
                <TableCell>
                  <Badge variant={user.is_email_verified ? 'default' : 'secondary'}>
                    {user.is_active
                      ? t('admin-page.users-table.yes')
                      : t('admin-page.users-table.no')}
                  </Badge>
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {formatAdminDate(user.created_at)}
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                  {!catalogReady
                    ? '—'
                    : openCount === catalog.length
                    ? t('admin-page.feature-access.all-open')
                    : t('admin-page.feature-access.some-open', {
                        open: openCount,
                        total: catalog.length,
                      })}
                </TableCell>
                <TableCell className="text-right">
                  {isTargetSuperAdmin ? (
                    <span className="text-xs text-muted-foreground">—</span>
                  ) : (
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
                        <DropdownMenuItem onClick={() => setEditingUser(user)}>
                          <Pencil />
                          {t('admin-page.user-edit.edit')}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={isSelf}
                          className="text-destructive focus:text-destructive"
                          onClick={() => handleDelete(user.id, user.email)}
                        >
                          <Trash2 />
                          {t('admin-page.user-edit.delete')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </AdminSectionShell>

    <UserEditDialog
      user={editingUser}
      open={Boolean(editingUser)}
      onOpenChange={(open) => {
        if (!open) setEditingUser(null)
      }}
    />

    <AdminDeleteConfirmDialog
      open={Boolean(target)}
      onOpenChange={(open) => {
        if (!open) closeDeleteDialog()
      }}
      entityType={target?.type ?? 'user'}
      entityName={target?.name ?? ''}
      isDeleting={isDeleting}
      onConfirm={confirmDelete}
    />
    </>
  )
}

function displayName(user: AdminUser, name?: string, surname?: string) {
  const next = [name ?? user.name, surname ?? user.surname].filter(Boolean).join(' ')
  return next || user.full_name || '—'
}
