import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import { selectUser } from '../../../../entities/user/model/selectors'
import { canAccessSection } from '../../../../shared/lib/available-features'
import { toast } from 'sonner'
import {
  useDeleteAdminOrganizationMutation,
  useGetAdminOrganizationsQuery,
} from '../../../../entities/platform-admin/model/platformAdminSlice'
import type { AdminOrganization, AdminUserBrief } from '../../../../entities/platform-admin/model/types'
import { ADMIN_PAGE_SIZE, formatAdminDateShort } from '../../../../features/platform-admin/lib/format'
import { useAdminDeleteDialog } from '../../../../features/platform-admin/lib/useAdminDeleteDialog'
import { AdminDeleteConfirmDialog } from '../../../../features/platform-admin/ui/AdminDeleteConfirmDialog'
import { AdminOrganizationCreateDialog } from '../../../../features/platform-admin/ui/AdminOrganizationCreateDialog'
import { AdminOrganizationEditDialog } from '../../../../features/platform-admin/ui/AdminOrganizationEditDialog'
import { AdminPagination } from '../../../../features/platform-admin/ui/AdminPagination'
import { AdminSectionShell } from '../../../../features/platform-admin/ui/AdminSectionShell'
import { DebouncedSearchInput } from '../../../../features/platform-admin/ui/DebouncedSearchInput'
import { OrganizationMembersDialog } from '../../../../features/platform-admin/ui/OrganizationMembersDialog'
import { PeopleStackCell } from '../../../../features/platform-admin/ui/PeopleStackCell'
import { routes } from '../../../../shared/lib/routes'
import { Button } from '../../../../shared/ui/button'
import { NameChipStack } from '../../../../shared/ui/name-chip-stack'
import { SiteNameChip } from '../../../../shared/ui/site-name-chip'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../../shared/ui/table'

function memberUsers(organization: AdminOrganization): AdminUserBrief[] {
  return (organization.members ?? []).flatMap((member) => {
    if (!member.user) return []
    return [{
      id: member.user.id,
      email: member.user.email,
      full_name: member.user.full_name,
    }]
  })
}

export function AdminOrganizationsPage() {
  const { t } = useTranslation()
  const user = useSelector(selectUser)
  const projectsOpen = canAccessSection(user, 'projects')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [offset, setOffset] = useState(0)
  const [editingOrganization, setEditingOrganization] = useState<AdminOrganization | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [membersOrganization, setMembersOrganization] = useState<AdminOrganization | null>(null)

  const { data, isLoading, isFetching } = useGetAdminOrganizationsQuery({
    limit: ADMIN_PAGE_SIZE,
    offset,
    search: appliedSearch || undefined,
  })
  const [deleteOrganization] = useDeleteAdminOrganizationMutation()
  const { target, isDeleting, openDeleteDialog, closeDeleteDialog, confirmDelete } = useAdminDeleteDialog()

  const organizations = useMemo(() => {
    return data?.results ?? []
  }, [data?.results])
  const isBusy = isLoading || isFetching || isDeleting

  const setSearch = (value: string) => {
    const next = value.trim()
    setAppliedSearch((current) => (current === next ? current : next))
    setOffset(0)
  }

  const handleDelete = (organization: AdminOrganization) => {
    openDeleteDialog({
      type: 'organization',
      name: organization.full_name,
      onConfirm: async () => {
        try {
          await deleteOrganization(organization.id).unwrap()
          toast.success(t('admin-page.organization-deleted'))
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
        title={t('admin-page.organizations')}
        description={t('admin-page.organizations-description')}
        actions={
          <Button type="button" onClick={() => setIsCreateOpen(true)}>
            <Plus />
            {t('admin-page.create-organization')}
          </Button>
        }
        isLoading={isLoading}
        isEmpty={!isLoading && organizations.length === 0}
        toolbar={
          <div className="flex w-full items-center gap-2">
            <DebouncedSearchInput
              value={appliedSearch}
              onDebouncedChange={setSearch}
              placeholder={t('admin-page.search-organizations')}
            />
          </div>
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
        <Table className="w-full min-w-max [&_td]:whitespace-nowrap [&_td]:py-1.5 [&_th]:h-9 [&_th]:whitespace-nowrap">
          <TableHeader>
            <TableRow>
              <TableHead>{t('admin-page.orgs-table.name')}</TableHead>
              <TableHead>{t('admin-page.orgs-table.short-name')}</TableHead>
              <TableHead>{t('fields.address')}</TableHead>
              <TableHead>{t('admin-page.orgs-table.inn')}</TableHead>
              <TableHead>{t('admin-page.orgs-table.kpp')}</TableHead>
              <TableHead>{t('admin-page.orgs-table.members')}</TableHead>
              <TableHead>{t('admin-page.orgs-table.projects')}</TableHead>
              <TableHead>{t('admin-page.orgs-table.created')}</TableHead>
              <TableHead className="text-right">{t('admin-page.users-table.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {organizations.map((organization) => (
              <TableRow key={organization.id}>
                <TableCell>
                  <SiteNameChip value={organization.full_name} toneKey={String(organization.id)} />
                </TableCell>
                <TableCell>
                  <SiteNameChip value={organization.short_name} toneKey={String(organization.id)} />
                </TableCell>
                <TableCell>{organization.address || '—'}</TableCell>
                <TableCell>{organization.inn || '—'}</TableCell>
                <TableCell>{organization.kpp || '—'}</TableCell>
                <TableCell>
                  <PeopleStackCell
                    users={memberUsers(organization)}
                    label={t('admin-page.org-members')}
                    onOpen={() => setMembersOrganization(organization)}
                  />
                </TableCell>
                <TableCell>
                  {projectsOpen ? (
                    <Link
                      to={`${routes.admin.projects()}?organization=${organization.id}`}
                      className="inline-flex rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <NameChipStack items={organization.projects ?? []} />
                    </Link>
                  ) : (
                    <NameChipStack items={organization.projects ?? []} />
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {organization.created_at ? formatAdminDateShort(organization.created_at) : '—'}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={t('admin-page.edit-organization')}
                      onClick={() => setEditingOrganization(organization)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={isBusy}
                      aria-label={t('buttons.delete')}
                      onClick={() => handleDelete(organization)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </AdminSectionShell>

      <AdminOrganizationCreateDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
      <OrganizationMembersDialog
        organization={membersOrganization}
        open={Boolean(membersOrganization)}
        onOpenChange={(open) => {
          if (!open) setMembersOrganization(null)
        }}
      />
      <AdminOrganizationEditDialog
        organization={editingOrganization}
        open={Boolean(editingOrganization)}
        onOpenChange={(open) => {
          if (!open) setEditingOrganization(null)
        }}
      />
      <AdminDeleteConfirmDialog
        open={Boolean(target)}
        onOpenChange={(open) => {
          if (!open) closeDeleteDialog()
        }}
        entityType={target?.type ?? 'organization'}
        entityName={target?.name ?? ''}
        isDeleting={isDeleting}
        onConfirm={confirmDelete}
      />
    </>
  )
}
