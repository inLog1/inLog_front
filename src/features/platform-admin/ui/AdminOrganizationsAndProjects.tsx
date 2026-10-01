import { FolderOpen, Loader2, MapPin, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import type { AdminMember, AdminOrganization, AdminProject, AdminUserBrief } from '../../../entities/platform-admin/model/types'
import {
  useDeleteAdminOrganizationMutation,
  useDeleteAdminProjectMutation,
  useGetAdminMembersQuery,
  useGetAdminOrganizationsQuery,
  useGetAdminProjectsQuery,
} from '../../../entities/platform-admin/model/platformAdminSlice'
import { formatAdminDateShort } from '../lib/format'
import { useAdminDeleteDialog } from '../lib/useAdminDeleteDialog'
import { AdminDeleteConfirmDialog } from './AdminDeleteConfirmDialog'
import { AdminOrganizationEditDialog } from './AdminOrganizationEditDialog'
import { AdminProjectEditDialog } from './AdminProjectEditDialog'
import { Button } from '../../../shared/ui/button'
import { cn } from '../../../shared/lib/utils'

const LIST_LIMIT = 1000

function initials(name?: string) {
  const parts = name?.trim().split(/\s+/).filter(Boolean).slice(0, 2) ?? []
  if (!parts.length) return '—'
  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('')
}

function personName(user?: AdminUserBrief) {
  return user?.full_name || [user?.name, user?.surname].filter(Boolean).join(' ') || user?.email || ''
}

function ownersByOrganization(members: AdminMember[]) {
  const map = new Map<number, string[]>()
  members
    .filter((member) => member.role === 'admin')
    .forEach((member) => {
      const name = personName(member.user)
      if (!name) return
      const list = map.get(member.organization_id) ?? []
      if (!list.includes(name)) list.push(name)
      map.set(member.organization_id, list)
    })
  return map
}

function ownersByProject(members: AdminMember[]) {
  const map = new Map<number, string[]>()
  members
    .filter((member) => member.role === 'admin' && member.project_id)
    .forEach((member) => {
      const name = personName(member.user)
      if (!name || !member.project_id) return
      const list = map.get(member.project_id) ?? []
      if (!list.includes(name)) list.push(name)
      map.set(member.project_id, list)
    })
  return map
}

export function AdminOrganizationsAndProjects() {
  const { t } = useTranslation()
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null)
  const [editingOrganization, setEditingOrganization] = useState<AdminOrganization | null>(null)
  const [editingProject, setEditingProject] = useState<AdminProject | null>(null)

  const { data: organizationsData, isLoading: orgsLoading } = useGetAdminOrganizationsQuery({
    limit: LIST_LIMIT,
    offset: 0,
  })
  const organizations = organizationsData?.results ?? []
  const selectedOrg = organizations.find((org) => org.id === selectedOrgId) ?? organizations[0] ?? null
  const activeOrgId = selectedOrg?.id ?? null

  const { data: projectsData, isLoading: projectsLoading, isFetching: projectsFetching } = useGetAdminProjectsQuery(
    { limit: LIST_LIMIT, offset: 0, organization: activeOrgId ?? undefined },
    { skip: activeOrgId == null },
  )
  const projects = projectsData?.results ?? []

  const { data: organizationMembers } = useGetAdminMembersQuery({
    type: 'organization',
    limit: LIST_LIMIT,
    offset: 0,
  })
  const { data: projectMembers } = useGetAdminMembersQuery(
    { type: 'project', organization: activeOrgId ?? undefined, limit: LIST_LIMIT, offset: 0 },
    { skip: activeOrgId == null },
  )

  const orgOwners = ownersByOrganization(organizationMembers?.results ?? [])
  const projectOwners = ownersByProject(projectMembers?.results ?? [])

  const [deleteOrganization] = useDeleteAdminOrganizationMutation()
  const [deleteProject, { isLoading: isDeletingProject }] = useDeleteAdminProjectMutation()
  const { target, isDeleting, openDeleteDialog, closeDeleteDialog, confirmDelete } = useAdminDeleteDialog()

  const deleteOrg = (organization: AdminOrganization) => {
    openDeleteDialog({
      type: 'organization',
      name: organization.full_name,
      onConfirm: async () => {
        try {
          await deleteOrganization(organization.id).unwrap()
          if (activeOrgId === organization.id) setSelectedOrgId(null)
          toast.success(t('admin-page.organization-deleted'))
        } catch (error) {
          toast.error(t('errors.something-went-wrong'))
          console.error(error)
          throw error
        }
      },
    })
  }

  const removeProject = (project: AdminProject) => {
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

  if (orgsLoading) {
    return (
      <div className="flex h-full min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!organizations.length) {
    return (
      <div className="flex h-full min-h-[28rem] items-center justify-center rounded-2xl border border-dashed border-border bg-card">
        <p className="text-sm text-muted-foreground">{t('admin-page.no-data')}</p>
      </div>
    )
  }

  const selectedOwners = selectedOrg ? orgOwners.get(selectedOrg.id) ?? [] : []

  return (
    <div className="flex h-[calc(100vh-64px-32px)] min-h-0 w-full overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <aside className="flex w-72 shrink-0 flex-col border-r border-border bg-muted/30">
        <div className="flex items-center gap-2 px-4 py-4">
          <p className="text-sm font-semibold">{t('admin-page.organizations')}</p>
          <span className="rounded-full bg-background px-2 py-0.5 text-xs text-muted-foreground ring-1 ring-border">
            {organizationsData?.count ?? organizations.length}
          </span>
        </div>
        <div className="min-h-0 flex-1 space-y-1 overflow-auto px-2 py-1 pb-3">
          {organizations.map((org) => {
            const active = org.id === activeOrgId
            const owners = orgOwners.get(org.id) ?? []
            return (
              <div
                key={org.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedOrgId(org.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    setSelectedOrgId(org.id)
                  }
                }}
                className={cn(
                  'group flex w-full cursor-pointer items-center gap-3 rounded-xl border px-2.5 py-2.5 text-left transition-colors',
                  active ? 'border-border bg-background' : 'border-transparent hover:bg-background/70',
                )}
              >
                <span className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-semibold',
                  active ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground ring-1 ring-border',
                )}>
                  {initials(org.short_name || org.full_name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{org.full_name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {owners.length ? owners.join(', ') : org.short_name}
                  </span>
                </span>
                <span className="flex shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(event) => {
                    event.stopPropagation()
                    setEditingOrganization(org)
                  }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive" onClick={(event) => {
                    event.stopPropagation()
                    deleteOrg(org)
                  }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </span>
              </div>
            )
          })}
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        {selectedOrg && (
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border px-6 py-5">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t('settings-page.organization')}
              </p>
              <h2 className="mt-1 truncate text-xl font-semibold">{selectedOrg.full_name}</h2>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                {selectedOrg.short_name && <span>{selectedOrg.short_name}</span>}
                {selectedOrg.address && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" />
                    {selectedOrg.address}
                  </span>
                )}
                {selectedOwners.length > 0 && (
                  <span>{t('admin-page.owner')}: {selectedOwners.join(', ')}</span>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-auto p-6">
          {projectsLoading || projectsFetching ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : projects.length === 0 ? (
            <div className="flex h-full min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-border text-center">
              <FolderOpen className="mb-3 h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">{t('scheduler-page.no-projects-in-organization')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              {projects.map((project) => {
                const owners = projectOwners.get(project.id) ?? []
                const details = [
                  { label: t('admin-page.projects-table.organization'), value: project.organization_name },
                  { label: t('admin-page.owner'), value: owners.join(', ') },
                  { label: t('fields.reservoir'), value: project.reservoir },
                  { label: t('admin-page.projects-table.country'), value: project.country },
                  { label: t('admin-page.projects-table.customer'), value: project.company_customer },
                  { label: t('admin-page.projects-table.contractor'), value: project.contractor },
                  { label: t('admin-page.projects-table.members'), value: String(project.members_count ?? '') },
                  { label: t('admin-page.projects-table.created'), value: project.created_at ? formatAdminDateShort(project.created_at) : '' },
                ].filter((item) => item.value?.trim())

                return (
                  <div
                    key={project.id}
                    className="group rounded-xl border border-border bg-background p-4 transition-colors hover:border-primary/40"
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                        <FolderOpen className="h-4 w-4" />
                      </span>
                      <p className="min-w-0 flex-1 pt-1.5 text-sm font-medium">{project.name}</p>
                      <span className="flex shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingProject(project)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 hover:text-destructive"
                          disabled={isDeletingProject}
                          onClick={() => removeProject(project)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </span>
                    </div>
                    {details.length > 0 && (
                      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-border pt-3">
                        {details.map((item) => (
                          <div key={item.label} className="min-w-0">
                            <dt className="text-xs text-muted-foreground">{item.label}</dt>
                            <dd className="truncate text-sm">{item.value}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>

      <AdminOrganizationEditDialog
        organization={editingOrganization}
        open={Boolean(editingOrganization)}
        onOpenChange={(open) => {
          if (!open) setEditingOrganization(null)
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
        entityType={target?.type ?? 'organization'}
        entityName={target?.name ?? ''}
        isDeleting={isDeleting}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
