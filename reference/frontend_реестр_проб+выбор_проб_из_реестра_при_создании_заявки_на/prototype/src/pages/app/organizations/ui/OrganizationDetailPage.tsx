import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Plus,
  Search,
  Shield,
} from 'lucide-react'
import { toast } from 'sonner'
import { useDeleteOrganizationMutation, useGetOrganizationByIdQuery } from '../../../../entities/organization/model/organizationSlice'
import type { DirectoryOrganization } from '../../../../entities/organization/model/directory'
import {
  personnelError,
  personnelMode,
  useArchiveEmployeeMutation,
  useGetCorporateOverviewQuery,
  type CorporateOverviewOrganization,
  type CorporatePersonnelRow,
} from '../../../../entities/personnel'
import { EditOrganizationDialog, OrganizationSummary, organizationKindLabelKey } from '../../../../features/organizations-and-projects'
import { routes } from '../../../../shared/lib/routes'
import { cn } from '../../../../shared/lib/utils'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../../shared/ui/alert-dialog'
import { Avatar, AvatarFallback } from '../../../../shared/ui/avatar'
import { Badge } from '../../../../shared/ui/badge'
import { Button } from '../../../../shared/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../../shared/ui/dropdown-menu'
import { Input } from '../../../../shared/ui/input'
import { PageHeader, PageHeading, PageState, WorkPage } from '../../../../shared/ui/page'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../shared/ui/select'
import { TabButton } from '../../../../shared/ui/tab-button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../shared/ui/table'
import { AddEmployeeDialog, EditEmployeeDialog } from '../../../../features/personnel'

type StaffStatusFilter = 'all' | 'active' | 'inactive'

const STAFF_PAGE_SIZES = [10, 20, 50] as const

export function OrganizationDetailPage() {
  const params = useParams()
  const parsed = Number(params.organizationId)
  const organizationId = Number.isInteger(parsed) && parsed > 0 ? parsed : null
  return personnelMode() === 'mock'
    ? <MockOrganizationDetail organizationId={organizationId} />
    : <LiveOrganizationDetail organizationId={organizationId} />
}

function MockOrganizationDetail({ organizationId }: { organizationId: number | null }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const overview = useGetCorporateOverviewQuery()
  const [archiveEmployee, archiveState] = useArchiveEmployeeMutation()
  const [deleteOrganization, deleteState] = useDeleteOrganizationMutation()
  const [editOrg, setEditOrg] = useState<DirectoryOrganization | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [editor, setEditor] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [archiveRow, setArchiveRow] = useState<CorporatePersonnelRow | null>(null)
  const [archiveError, setArchiveError] = useState('')
  const [staffQuery, setStaffQuery] = useState('')
  const [staffStatus, setStaffStatus] = useState<StaffStatusFilter>('all')
  const [staffDepartment, setStaffDepartment] = useState<string>('all')
  const [staffPage, setStaffPage] = useState(1)
  const [staffPageSize, setStaffPageSize] = useState<number>(STAFF_PAGE_SIZES[0])
  const data = overview.currentData
  const organization = organizationId == null ? null : data?.organizations.find((item) => item.id === organizationId) ?? null
  const allRows = organizationId == null ? [] : (data?.personnel ?? []).filter((item) => item.organizationId === organizationId)
  const createTarget = organizationId == null ? null : data?.createTargets.find((item) => item.id === organizationId) ?? null

  const confirmDelete = async () => {
    if (!organization?.canDelete) return
    setDeleteError('')
    try {
      await deleteOrganization(organization.id).unwrap()
      toast.success(t('corporation.deleted'))
      navigate(routes.settings.organizations())
    } catch {
      setDeleteError(t('corporation.delete-error'))
    }
  }

  const confirmArchive = async () => {
    if (!archiveRow?.actions.archive) return
    setArchiveError('')
    try {
      await archiveEmployee({
        employeeId: archiveRow.employeeId,
        organizationId: archiveRow.organizationId,
        expectedRevision: archiveRow.revision,
        archived: true,
      }).unwrap()
      if (editor === archiveRow.employeeId) setEditor(null)
      setArchiveRow(null)
      toast.success(t('corporation.removed'))
    } catch (caught) {
      setArchiveError(t(`personnel.errors.${personnelError(caught).code}`, { defaultValue: t('personnel.errors.generic') }))
    }
  }

  const departmentOptions = useMemo(() => {
    const values = new Set<string>()
    for (const row of allRows) {
      const label = row.department.trim()
      if (label) values.add(label)
    }
    return [...values].sort((left, right) => left.localeCompare(right, 'ru'))
  }, [allRows])

  const filteredRows = useMemo(() => {
    const needle = staffQuery.trim().toLowerCase()
    return allRows.filter((row) => {
      if (staffStatus === 'active' && row.archived) return false
      if (staffStatus === 'inactive' && !row.archived) return false
      if (staffDepartment !== 'all' && row.department !== staffDepartment) return false
      if (!needle) return true
      const roles = row.roles?.map((role) => role.displayName).join(' ') ?? ''
      return row.name.toLowerCase().includes(needle)
        || row.email.toLowerCase().includes(needle)
        || row.position.toLowerCase().includes(needle)
        || row.department.toLowerCase().includes(needle)
        || roles.toLowerCase().includes(needle)
    })
  }, [allRows, staffDepartment, staffQuery, staffStatus])

  const activeCount = allRows.filter((row) => !row.archived).length
  const inactiveCount = allRows.filter((row) => row.archived).length
  const staffPages = Math.max(1, Math.ceil(filteredRows.length / staffPageSize))
  const staffPageSafe = Math.min(staffPage, staffPages)
  const pageRows = filteredRows.slice((staffPageSafe - 1) * staffPageSize, staffPageSafe * staffPageSize)

  if (organizationId == null) {
    return (
      <WorkPage>
        <PageHeading>{t('nav.corporation')}</PageHeading>
        <MissingOrganization />
      </WorkPage>
    )
  }
  if (overview.isLoading && !data) {
    return <WorkPage><PageState kind="loading" description={t('workspace.loading')} /></WorkPage>
  }
  if (overview.isError || !data) {
    return (
      <WorkPage>
        <PageState kind="error" description={t('corporation.load-error')} action={<Button type="button" variant="outline" onClick={() => void overview.refetch()}>{t('workspace.retry')}</Button>} />
      </WorkPage>
    )
  }
  if (!organization) {
    return (
      <WorkPage>
        <PageHeading>{t('nav.corporation')}</PageHeading>
        <MissingOrganization />
      </WorkPage>
    )
  }

  const kindLabel = t(organizationKindLabelKey(organization.kind))
  const orgMenu = organization.canUpdate || organization.canDelete ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="icon" aria-label={t('corporation.org-actions', { name: organization.fullName })}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {organization.canUpdate ? (
          <DropdownMenuItem onSelect={() => setEditOrg(directoryOf(organization))}>{t('corporation.edit-organization')}</DropdownMenuItem>
        ) : null}
        {organization.canDelete ? (
          <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => { setDeleteError(''); setDeleteOpen(true) }}>
            {t('corporation.delete')}
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  ) : null

  return (
    <WorkPage>
      <PageHeader
        breadcrumbs={[
          { label: t('nav.corporation'), to: routes.settings.organizations() },
          { label: organization.shortName },
        ]}
        title={organization.fullName}
        description={kindLabel}
        actions={orgMenu}
      />
      <section className="rounded-xl border border-border bg-card p-4">
        <OrganizationSummary organization={organization} />
      </section>
      <div className="flex flex-col gap-3 border-b border-border sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-wrap gap-6" role="tablist" aria-label={organization.fullName}>
          <TabButton active onClick={() => undefined}>{t('corporation.staff-tab')}</TabButton>
          <span className="cursor-not-allowed border-b-2 border-transparent px-1 pb-2 text-sm font-medium text-muted-foreground/60" aria-disabled>
            {t('corporation.structure-tab')}
          </span>
          <span className="cursor-not-allowed border-b-2 border-transparent px-1 pb-2 text-sm font-medium text-muted-foreground/60" aria-disabled>
            {t('nav.access')}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 pb-2">
          <Button type="button" variant="outline" className="shrink-0" asChild>
            <Link to={routes.settings.access()} state={{ accessOrganizationId: organization.id }}>
              <Shield className="h-4 w-4" />
              {t('corporation.assign-role')}
            </Link>
          </Button>
          {createTarget ? (
            <Button type="button" className="shrink-0" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" />
              {t('corporation.add-employee')}
            </Button>
          ) : null}
        </div>
      </div>
      <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">{t('corporation.staff-tab')}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t('corporation.staff-note')}</p>
          </div>
          {organization.employeeCount == null ? (
            <p className="text-sm text-muted-foreground">{t('corporation.employees-hidden')}</p>
          ) : (
            <>
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="relative min-w-0 sm:max-w-md">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                  <Input
                    value={staffQuery}
                    onChange={(event) => {
                      setStaffQuery(event.target.value)
                      setStaffPage(1)
                    }}
                    placeholder={t('corporation.staff-search')}
                    aria-label={t('corporation.staff-search')}
                    className="pl-9"
                  />
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                  <StaffStatusPills
                    status={staffStatus}
                    total={allRows.length}
                    active={activeCount}
                    inactive={inactiveCount}
                    onChange={(next) => {
                      setStaffStatus(next)
                      setStaffPage(1)
                    }}
                  />
                  <Select
                    value={staffDepartment}
                    onValueChange={(value) => {
                      setStaffDepartment(value)
                      setStaffPage(1)
                    }}
                  >
                    <SelectTrigger className="w-full sm:w-[13rem]" aria-label={t('corporation.filter-department')}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('corporation.filter-department-all')}</SelectItem>
                      {departmentOptions.map((item) => (
                        <SelectItem key={item} value={item}>{item}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {filteredRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('corporation.staff-empty')}</p>
              ) : (
                <StaffTable
                  rows={pageRows}
                  page={staffPageSafe}
                  pages={staffPages}
                  pageSize={staffPageSize}
                  onPageChange={setStaffPage}
                  onPageSizeChange={(size) => {
                    setStaffPageSize(size)
                    setStaffPage(1)
                  }}
                  onEdit={(row) => setEditor(row.employeeId)}
                  onArchive={(row) => { setArchiveError(''); setArchiveRow(row) }}
                />
              )}
            </>
          )}
        </section>
      {editor != null ? (
        <EditEmployeeDialog
          open
          organizationId={organization.id}
          organizationName={organization.fullName}
          employeeId={editor}
          onOpenChange={(open) => { if (!open) setEditor(null) }}
          onSaved={() => toast.success(t('corporation.saved'))}
        />
      ) : null}
      {createTarget ? (
        <AddEmployeeDialog
          open={addOpen}
          targets={[{ id: createTarget.id, name: createTarget.fullName }]}
          onOpenChange={setAddOpen}
          onCreated={() => {
            setAddOpen(false)
            toast.success(t('corporation.saved'))
          }}
        />
      ) : null}
      <EditOrganizationDialog organization={editOrg} open={editOrg != null} onOpenChange={(open) => { if (!open) setEditOrg(null) }} />
      <AlertDialog open={deleteOpen} onOpenChange={(open) => { if (!open && !deleteState.isLoading) { setDeleteOpen(false); setDeleteError('') } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('corporation.delete-title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('corporation.delete-body', { name: organization.fullName })}</AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError ? <p className="text-sm text-destructive" role="alert">{deleteError}</p> : null}
          <AlertDialogFooter>
            <AlertDialogCancel type="button" disabled={deleteState.isLoading}>{t('corporation.cancel')}</AlertDialogCancel>
            <Button type="button" variant="destructive" disabled={deleteState.isLoading || !organization.canDelete} onClick={() => void confirmDelete()}>
              {t('corporation.delete')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={archiveRow != null} onOpenChange={(open) => { if (!open && !archiveState.isLoading) { setArchiveRow(null); setArchiveError('') } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('corporation.remove-title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {archiveRow ? t('corporation.remove-who', { name: archiveRow.name || archiveRow.email, organization: archiveRow.organizationName }) : ''}
              {' '}
              {t('corporation.remove-body')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {archiveError ? <p className="text-sm text-destructive" role="alert">{archiveError}</p> : null}
          <AlertDialogFooter>
            <AlertDialogCancel type="button" disabled={archiveState.isLoading}>{t('corporation.cancel')}</AlertDialogCancel>
            <Button type="button" variant="destructive" disabled={archiveState.isLoading || !archiveRow?.actions.archive} onClick={() => void confirmArchive()}>
              {t('corporation.remove-confirm')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </WorkPage>
  )
}

function LiveOrganizationDetail({ organizationId }: { organizationId: number | null }) {
  const { t } = useTranslation()
  const organization = useGetOrganizationByIdQuery(organizationId ?? 0, { skip: organizationId == null })
  if (organizationId == null) {
    return (
      <WorkPage>
        <PageHeading>{t('nav.corporation')}</PageHeading>
        <MissingOrganization />
      </WorkPage>
    )
  }
  if (organization.isLoading) return <WorkPage><PageState kind="loading" description={t('workspace.loading')} /></WorkPage>
  if (organization.isError || !organization.data) {
    return (
      <WorkPage>
        <PageHeading>{t('nav.corporation')}</PageHeading>
        <MissingOrganization />
      </WorkPage>
    )
  }
  const row = organization.data
  const title = row.fullName || row.shortName || t('nav.corporation')
  return (
    <WorkPage>
      <PageHeader
        breadcrumbs={[
          { label: t('nav.corporation'), to: routes.settings.organizations() },
          { label: row.shortName || title },
        ]}
        title={title}
      />
      <section className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Building2 className="h-5 w-5" aria-hidden />
          </span>
          <h2 className="min-w-0 text-base font-semibold leading-snug">{title}</h2>
        </div>
        <dl className="mt-4 grid gap-2 text-sm">
          <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3">
            <dt className="text-muted-foreground">{t('corporation.field-short')}</dt>
            <dd className="min-w-0 font-medium">{row.shortName?.trim() ? row.shortName : '—'}</dd>
          </div>
          <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3">
            <dt className="text-muted-foreground">{t('corporation.field-address')}</dt>
            <dd className="min-w-0 font-medium">{row.address?.trim() ? row.address : '—'}</dd>
          </div>
        </dl>
      </section>
      <div className="flex flex-wrap gap-6 border-b border-border" role="tablist" aria-label={title}>
        <TabButton active onClick={() => undefined}>{t('corporation.staff-tab')}</TabButton>
      </div>
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">{t('corporation.staff-tab')}</h2>
        <p className="text-sm text-muted-foreground">{t('personnel.unavailable')}</p>
      </section>
    </WorkPage>
  )
}

function MissingOrganization() {
  const { t } = useTranslation()
  return (
    <PageState
      kind="empty"
      description={t('corporation.detail-missing')}
      action={<Button type="button" variant="outline" asChild><Link to={routes.settings.organizations()}>{t('nav.corporation')}</Link></Button>}
    />
  )
}

function StaffStatusPills({
  status,
  total,
  active,
  inactive,
  onChange,
}: {
  status: StaffStatusFilter
  total: number
  active: number
  inactive: number
  onChange: (value: StaffStatusFilter) => void
}) {
  const { t } = useTranslation()
  const items: { id: StaffStatusFilter; label: string }[] = [
    { id: 'all', label: t('corporation.filter-staff-all', { count: total }) },
    { id: 'active', label: t('corporation.filter-staff-active', { count: active }) },
    { id: 'inactive', label: t('corporation.filter-staff-inactive', { count: inactive }) },
  ]
  return (
    <div className="flex flex-wrap gap-1 rounded-lg bg-muted/60 p-1">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={cn(
            'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            status === item.id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

function directoryOf(organization: CorporateOverviewOrganization): DirectoryOrganization {
  return {
    id: organization.id,
    fullName: organization.fullName,
    shortName: organization.shortName,
    address: organization.address,
    inn: organization.inn,
    kpp: organization.kpp,
    kind: organization.kind,
    revision: organization.revision,
    canUpdate: organization.canUpdate,
  }
}

function employeeInitials(name: string, email: string): string {
  const source = name.trim() || email.trim()
  const parts = source.split(/\s+/).filter(Boolean).slice(0, 2)
  if (!parts.length) return '—'
  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('')
}

function StaffTable({
  rows,
  page,
  pages,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onEdit,
  onArchive,
}: {
  rows: CorporatePersonnelRow[]
  page: number
  pages: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  onEdit: (row: CorporatePersonnelRow) => void
  onArchive: (row: CorporatePersonnelRow) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="px-4">{t('corporation.column-employee')}</TableHead>
            <TableHead className="px-4">{t('corporation.column-position')}</TableHead>
            <TableHead className="px-4">{t('corporation.column-department')}</TableHead>
            <TableHead className="px-4">{t('corporation.column-role')}</TableHead>
            <TableHead className="px-4">{t('corporation.column-status')}</TableHead>
            <TableHead className="w-12 px-4"><span className="sr-only">{t('corporation.actions-column')}</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const label = row.name || row.email || t('corporation.column-employee')
            const roleLabel = row.roles == null
              ? t('corporation.roles-hidden')
              : row.roles.length === 0
                ? t('corporation.no-role')
                : row.roles.map((role) => role.displayName).join(', ')
            return (
              <TableRow key={row.employeeId}>
                <TableCell className="px-4 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar className="h-9 w-9 border border-border">
                      <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                        {employeeInitials(row.name, row.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <span className="block truncate font-medium">{row.name || '—'}</span>
                      {row.email ? <span className="block truncate text-xs text-muted-foreground">{row.email}</span> : null}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="px-4 py-3">{row.position || '—'}</TableCell>
                <TableCell className="px-4 py-3">{row.department || '—'}</TableCell>
                <TableCell className="px-4 py-3">
                  {row.roles == null ? (
                    <span className="text-sm text-muted-foreground">{roleLabel}</span>
                  ) : (
                    <Badge variant="outline" className="max-w-[14rem] truncate font-normal bg-primary/5 text-primary border-primary/20">
                      {roleLabel}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="px-4 py-3">
                  <span className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
                    row.archived ? 'bg-muted text-muted-foreground' : 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300',
                  )}>
                    <span className={cn('h-1.5 w-1.5 rounded-full', row.archived ? 'bg-muted-foreground' : 'bg-emerald-500')} aria-hidden />
                    {row.archived ? t('corporation.status-inactive') : t('corporation.status-active')}
                  </span>
                </TableCell>
                <TableCell className="px-4 py-3">
                  {row.actions.update || row.actions.archive ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button type="button" variant="ghost" size="icon" className="text-muted-foreground" aria-label={t('corporation.actions', { name: label })}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {row.actions.update ? <DropdownMenuItem onSelect={() => onEdit(row)}>{t('corporation.edit')}</DropdownMenuItem> : null}
                        {row.actions.archive ? <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => onArchive(row)}>{t('corporation.remove')}</DropdownMenuItem> : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
      <div className="flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span id="org-staff-page-size">{t('corporation.page-size')}</span>
          <Select value={String(pageSize)} onValueChange={(value) => onPageSizeChange(Number(value))}>
            <SelectTrigger className="h-8 w-[4.5rem]" aria-labelledby="org-staff-page-size">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STAFF_PAGE_SIZES.map((size) => (
                <SelectItem key={size} value={String(size)}>{size}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm tabular-nums text-muted-foreground">{page} / {pages}</span>
          <Button type="button" variant="outline" size="sm" disabled={page >= pages} onClick={() => onPageChange(page + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
