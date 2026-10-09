import { Pencil, Plus, Settings2, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  useDeleteAdminProjectMutation,
  useGetAdminOrganizationsQuery,
  useGetAdminProjectsQuery,
} from '../../../../entities/platform-admin/model/platformAdminSlice'
import type { AdminProject } from '../../../../entities/platform-admin/model/types'
import { ADMIN_PAGE_SIZE, formatAdminDateShort } from '../../../../features/platform-admin/lib/format'
import { useAdminDeleteDialog } from '../../../../features/platform-admin/lib/useAdminDeleteDialog'
import { AdminDeleteConfirmDialog } from '../../../../features/platform-admin/ui/AdminDeleteConfirmDialog'
import { AdminPagination } from '../../../../features/platform-admin/ui/AdminPagination'
import { AdminProjectCreateDialog } from '../../../../features/platform-admin/ui/AdminProjectCreateDialog'
import { AdminProjectEditDialog } from '../../../../features/platform-admin/ui/AdminProjectEditDialog'
import { AdminSectionShell } from '../../../../features/platform-admin/ui/AdminSectionShell'
import { DebouncedSearchInput } from '../../../../features/platform-admin/ui/DebouncedSearchInput'
import { matchesCreatedPeriod } from '../../../../features/platform-admin/ui/FilterMenu'
import { ProjectMembersDialog } from '../../../../features/platform-admin/ui/ProjectMembersDialog'
import { Button } from '../../../../shared/ui/button'
import { CountryValue, usePopularCountries } from '../../../../shared/ui/country-select'
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

const ALL_ORGANIZATIONS = 'all'

export function AdminProjectsPage() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [appliedSearch, setAppliedSearch] = useState('')
  const [extraFilters, setExtraFilters] = useState({ country: 'all', reservoir: '', created: 'all' })
  const [offset, setOffset] = useState(0)
  const [editingProject, setEditingProject] = useState<AdminProject | null>(null)
  const [membersProject, setMembersProject] = useState<AdminProject | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)

  const organizationParam = searchParams.get('organization')
  const organizationId = organizationParam && Number.isFinite(Number(organizationParam))
    ? Number(organizationParam)
    : undefined

  const { data: organizationsData } = useGetAdminOrganizationsQuery({ limit: 1000, offset: 0 })
  const { data, isLoading, isFetching } = useGetAdminProjectsQuery({
    limit: ADMIN_PAGE_SIZE,
    offset,
    organization: organizationId,
    search: appliedSearch || undefined,
  })
  const [deleteProject] = useDeleteAdminProjectMutation()
  const { target, isDeleting, openDeleteDialog, closeDeleteDialog, confirmDelete } = useAdminDeleteDialog()

  const countries = usePopularCountries()
  const organizations = organizationsData?.results ?? []
  const organizationLabel = (project: AdminProject) => {
    if (project.organization_name) return project.organization_name
    const organization = organizations.find((item) => item.id === project.organization_id)
    return organization?.short_name || organization?.full_name || ''
  }
  const projects = useMemo(() => {
    const reservoirQuery = extraFilters.reservoir.trim().toLowerCase()
    const country = countries.find((item) => item.code === extraFilters.country)
    return (data?.results ?? []).filter((project) => {
      if (country) {
        const value = (project.country || '').trim().toLowerCase()
        const matches = value === country.code.toLowerCase() || value === country.name.toLowerCase()
        if (!matches) return false
      }
      if (reservoirQuery && !(project.reservoir || '').toLowerCase().includes(reservoirQuery)) return false
      if (!matchesCreatedPeriod(project.created_at, extraFilters.created)) return false
      return true
    })
  }, [countries, data?.results, extraFilters])
  const isBusy = isLoading || isFetching || isDeleting

  const setSearch = (value: string) => {
    const next = value.trim()
    setAppliedSearch((current) => (current === next ? current : next))
    setOffset(0)
  }

  const handleDelete = (project: AdminProject) => {
    openDeleteDialog({
      type: 'project',
      name: project.name,
      onConfirm: async () => {
        try {
          await deleteProject(project.id).unwrap()
          toast.success(t('admin-page.project-deleted'))
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
        title={t('admin-page.projects')}
        description={t('admin-page.projects-description')}
        actions={
          <Button type="button" onClick={() => setIsCreateOpen(true)}>
            <Plus />
            {t('admin-page.create-project')}
          </Button>
        }
        isLoading={isLoading}
        isEmpty={!isLoading && projects.length === 0}
        toolbar={
          <div className="flex w-full items-center gap-2">
            <DebouncedSearchInput
              value={appliedSearch}
              onDebouncedChange={setSearch}
              placeholder={t('admin-page.search-projects')}
            />
          </div>
        }
        footer={
          <AdminPagination
            count={data?.count ?? 0}
            offset={offset}
            limit={ADMIN_PAGE_SIZE}
            onChange={setOffset}
            isLoading={isBusy}
          />
        }
      >
        <Table className="w-full min-w-max [&_td]:whitespace-nowrap [&_td]:py-1.5 [&_th]:h-9 [&_th]:whitespace-nowrap">
          <TableHeader>
            <TableRow>
              <TableHead>{t('admin-page.projects-table.name')}</TableHead>
              <TableHead>{t('admin-page.projects-table.organization')}</TableHead>
              <TableHead>{t('fields.reservoir')}</TableHead>
              <TableHead>{t('admin-page.projects-table.country')}</TableHead>
              <TableHead>{t('admin-page.projects-table.members')}</TableHead>
              <TableHead>{t('admin-page.projects-table.created')}</TableHead>
              <TableHead className="text-right">{t('admin-page.users-table.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.map((project) => (
              <TableRow key={project.id}>
                <TableCell>
                  <SiteNameChip value={project.name} toneKey={String(project.id)} />
                </TableCell>
                <TableCell>
                  <NameChipStack
                    items={organizationLabel(project)
                      ? [{ id: project.organization_id || organizationLabel(project), name: organizationLabel(project) }]
                      : []}
                  />
                </TableCell>
                <TableCell>{project.reservoir || '—'}</TableCell>
                <TableCell><CountryValue code={project.country} /></TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {project.members_count > 0 ? (
                      <span className="text-sm tabular-nums">{project.members_count}</span>
                    ) : null}
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-7 w-7 rounded-full border-2 border-background bg-muted"
                      aria-label={t('admin-page.org-members')}
                      onClick={() => setMembersProject(project)}
                    >
                      <Settings2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {project.created_at ? formatAdminDateShort(project.created_at) : '—'}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={t('admin-page.edit-project')}
                      onClick={() => setEditingProject(project)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={isBusy}
                      aria-label={t('buttons.delete')}
                      onClick={() => handleDelete(project)}
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

      <AdminProjectCreateDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        organizations={organizations}
        defaultOrganizationId={organizationId}
      />
      <ProjectMembersDialog
        project={membersProject}
        open={Boolean(membersProject)}
        onOpenChange={(open) => {
          if (!open) setMembersProject(null)
        }}
      />
      <AdminProjectEditDialog
        project={editingProject}
        open={Boolean(editingProject)}
        onOpenChange={(open) => {
          if (!open) setEditingProject(null)
        }}
      />
      <AdminDeleteConfirmDialog
        open={Boolean(target)}
        onOpenChange={(open) => {
          if (!open) closeDeleteDialog()
        }}
        entityType={target?.type ?? 'project'}
        entityName={target?.name ?? ''}
        isDeleting={isDeleting}
        onConfirm={confirmDelete}
      />
    </>
  )
}
