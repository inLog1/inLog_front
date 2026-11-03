import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { MoreHorizontal } from 'lucide-react'
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
import { EditOrganizationDialog } from '../../../../features/organizations-and-projects'
import { routes } from '../../../../shared/lib/routes'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../../shared/ui/alert-dialog'
import { Button } from '../../../../shared/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../../shared/ui/dropdown-menu'
import { PageHeader, PageHeading, PageState, WorkPage } from '../../../../shared/ui/page'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../shared/ui/table'
import { AddEmployeeDialog } from '../../../../features/personnel'
import { PersonnelComposer } from './PersonnelComposer'

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
  const data = overview.currentData
  const organization = organizationId == null ? null : data?.organizations.find((item) => item.id === organizationId) ?? null
  const rows = organizationId == null ? [] : (data?.personnel ?? []).filter((item) => item.organizationId === organizationId)
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

  const laboratory = organization.kind === 'laboratory'
  return (
    <WorkPage>
      <PageHeading>{organization.fullName}</PageHeading>
      <PageHeader
        breadcrumbs={[
          { label: t('nav.corporation'), to: routes.settings.organizations() },
          { label: organization.shortName },
        ]}
        title={organization.fullName}
        description={t(laboratory ? 'corporation.kind-laboratory' : 'corporation.kind-customer')}
        actions={(
          <>
            {organization.canUpdate ? (
              <Button type="button" variant="outline" onClick={() => setEditOrg(directoryOf(organization))}>
                {t('corporation.edit-organization')}
              </Button>
            ) : null}
            {organization.canDelete ? (
              <Button type="button" variant="outline" className="text-destructive" onClick={() => { setDeleteError(''); setDeleteOpen(true) }}>
                {t('corporation.delete')}
              </Button>
            ) : null}
          </>
        )}
      />
      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-medium text-muted-foreground">{t('corporation.details-title')}</h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          <Fact label={t('corporation.field-name')} value={organization.fullName} />
          <Fact label={t('corporation.field-short')} value={organization.shortName} />
          <Fact label={t('corporation.field-kind')} value={t(laboratory ? 'corporation.kind-laboratory' : 'corporation.kind-customer')} />
          <Fact label={t('corporation.field-address')} value={organization.address} />
          <Fact
            label={t('corporation.field-employees')}
            value={organization.employeeCount == null ? t('corporation.employees-hidden') : String(organization.employeeCount)}
          />
        </dl>
      </section>
      <section className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-base font-semibold">{t('corporation.staff-title')}</h2>
            <p className="text-sm text-muted-foreground">{t('corporation.staff-note')}</p>
          </div>
          {createTarget ? <Button type="button" className="shrink-0" onClick={() => setAddOpen(true)}>{t('corporation.add-employee')}</Button> : null}
        </div>
        {organization.employeeCount == null ? (
          <p className="text-sm text-muted-foreground">{t('corporation.employees-hidden')}</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('corporation.staff-empty')}</p>
        ) : (
          <StaffTable
            rows={rows}
            onEdit={(row) => setEditor(row.employeeId)}
            onArchive={(row) => { setArchiveError(''); setArchiveRow(row) }}
          />
        )}
      </section>
      {editor != null ? (
        <PersonnelComposer
          organizationId={organization.id}
          employeeId={editor}
          organizationName={organization.fullName}
          createTargets={createTarget ? [createTarget] : []}
          onOrganizationChange={() => undefined}
          closeLabel={t('corporation.detail-close')}
          onClose={(savedId) => {
            setEditor(null)
            if (savedId) toast.success(t('corporation.saved'))
          }}
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
      <PageHeading>{title}</PageHeading>
      <PageHeader
        breadcrumbs={[
          { label: t('nav.corporation'), to: routes.settings.organizations() },
          { label: row.shortName || title },
        ]}
        title={title}
      />
      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-medium text-muted-foreground">{t('corporation.details-title')}</h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          <Fact label={t('corporation.field-name')} value={row.fullName} />
          <Fact label={t('corporation.field-short')} value={row.shortName} />
          <Fact label={t('corporation.field-address')} value={row.address} />
        </dl>
      </section>
      <section className="space-y-2">
        <h2 className="text-base font-semibold">{t('corporation.staff-title')}</h2>
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

function Fact({ label, value }: { label: string; value?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium">{value?.trim() ? value : '—'}</dd>
    </div>
  )
}

function directoryOf(organization: CorporateOverviewOrganization): DirectoryOrganization {
  return {
    id: organization.id,
    fullName: organization.fullName,
    shortName: organization.shortName,
    address: organization.address,
    kind: organization.kind,
    revision: organization.revision,
    canUpdate: organization.canUpdate,
  }
}

function StaffTable({
  rows,
  onEdit,
  onArchive,
}: {
  rows: CorporatePersonnelRow[]
  onEdit: (row: CorporatePersonnelRow) => void
  onArchive: (row: CorporatePersonnelRow) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="px-4">{t('corporation.column-employee')}</TableHead>
          <TableHead className="px-4">{t('corporation.column-position')}</TableHead>
          <TableHead className="px-4">{t('corporation.column-role')}</TableHead>
          <TableHead className="w-12 px-4"><span className="sr-only">{t('corporation.actions-column')}</span></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const label = row.name || row.email || t('corporation.column-employee')
          return (
            <TableRow key={row.employeeId}>
              <TableCell className="px-4 py-3">
                <span className="block font-medium">{row.name || '—'}</span>
                {row.email ? <span className="block text-xs text-muted-foreground">{row.email}</span> : null}
              </TableCell>
              <TableCell className="px-4 py-3">{row.position || '—'}</TableCell>
              <TableCell className="px-4 py-3">
                {row.roles == null ? t('corporation.roles-hidden') : row.roles.length === 0 ? t('corporation.no-role') : row.roles.map((role) => role.displayName).join(', ')}
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
    </div>
  )
}
