import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Building2, MoreHorizontal, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { useDeleteOrganizationMutation, useGetOrganizationsQuery } from '../../../../entities/organization/model/organizationSlice'
import type { DirectoryOrganization } from '../../../../entities/organization/model/directory'
import {
  personnelError,
  personnelMode,
  useArchiveEmployeeMutation,
  useGetCorporateOverviewQuery,
  type CorporateOverviewOrganization,
  type CorporatePersonnelRow,
} from '../../../../entities/personnel'
import {
  CreateOrganizationDialog,
  EditOrganizationDialog,
  OrganizationSummary,
  organizationKindLabelKey,
  organizationVisible,
  personnelVisible,
  omitWorkspaceSelection,
  readCorporateLocation,
  writeCorporateLocation,
  type CorporateKindFilter,
  type CorporateTab,
} from '../../../../features/organizations-and-projects'
import { routes } from '../../../../shared/lib/routes'
import { hasUnsavedWork } from '../../../../shared/session/unsaved-work'
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
import { Input } from '../../../../shared/ui/input'
import { PageHeading, PageState, WorkPage } from '../../../../shared/ui/page'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../shared/ui/select'
import { TabButton } from '../../../../shared/ui/tab-button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../shared/ui/table'
import { AddEmployeeDialog } from '../../../../features/personnel'
import { PersonnelComposer } from './PersonnelComposer'

function useCorporationAddress() {
  const [searchParams, setSearchParams] = useSearchParams()
  useEffect(() => {
    const next = omitWorkspaceSelection(searchParams)
    if (!next) return
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])
}

export function CorporateOverview() {
  useCorporationAddress()
  return personnelMode() === 'mock' ? <MockCorporation /> : <LiveCorporation />
}

function MockCorporation() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const location = readCorporateLocation(searchParams)
  const overview = useGetCorporateOverviewQuery()
  const [archiveEmployee, archiveState] = useArchiveEmployeeMutation()
  const [createOpen, setCreateOpen] = useState(false)
  const [editOrg, setEditOrg] = useState<DirectoryOrganization | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<CorporateOverviewOrganization | null>(null)
  const [deleteError, setDeleteError] = useState('')
  const [deleteOrganization, deleteState] = useDeleteOrganizationMutation()
  const [archiveRow, setArchiveRow] = useState<CorporatePersonnelRow | null>(null)
  const [archiveError, setArchiveError] = useState('')
  const [pendingTab, setPendingTab] = useState<CorporateTab | null>(null)
  const data = overview.currentData

  const write = (patch: Parameters<typeof writeCorporateLocation>[1]) => {
    setSearchParams((current) => writeCorporateLocation(current, patch), { replace: true })
  }

  const closeEditor = () => write({ employee: null, personnelOrg: null, tab: 'personnel' })

  const openOrganization = (organizationId: number) => {
    navigate(routes.settings.organization(organizationId))
  }

  const selectTab = (tab: CorporateTab) => {
    if (tab === location.tab) return
    if (location.employee && hasUnsavedWork()) {
      setPendingTab(tab)
      return
    }
    write({ tab, employee: null, personnelOrg: null })
  }

  const startAdd = () => {
    if ((data?.createTargets.length ?? 0) === 0) return
    setAddOpen(true)
  }

  const confirmDelete = async () => {
    if (!deleteTarget?.canDelete) return
    setDeleteError('')
    try {
      await deleteOrganization(deleteTarget.id).unwrap()
      if (editOrg?.id === deleteTarget.id) setEditOrg(null)
      setDeleteTarget(null)
      toast.success(t('corporation.deleted'))
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
      setArchiveRow(null)
      toast.success(t('corporation.removed'))
    } catch (caught) {
      setArchiveError(t(`personnel.errors.${personnelError(caught).code}`, { defaultValue: t('personnel.errors.generic') }))
    }
  }

  if (overview.isLoading && !data) return <WorkPage><PageState kind="loading" description={t('workspace.loading')} /></WorkPage>
  if (overview.isError || !data) {
    return (
      <WorkPage>
        <PageState
          kind="error"
          description={t('corporation.load-error')}
          action={<Button type="button" variant="outline" onClick={() => void overview.refetch()}>{t('workspace.retry')}</Button>}
        />
      </WorkPage>
    )
  }

  const edited = location.employee && location.employee !== 'new'
    ? data.personnel.find((row) => row.employeeId === location.employee) ?? null
    : null
  const editorOpen = edited != null
  const organizations = data.organizations.filter((item) => organizationVisible(item, location.query, location.kind))
  const personnel = data.personnel.filter((item) => !item.archived && personnelVisible(item, location.query, location.kind))
  const showCreate = location.tab === 'organizations' && data.createOrganization
  const showAdd = location.tab === 'personnel' && data.createTargets.length > 0 && !editorOpen

  const tabAction = showCreate ? (
    <Button type="button" className="shrink-0" onClick={() => setCreateOpen(true)}>
      <Plus className="h-4 w-4" />
      {t('corporation.create-organization')}
    </Button>
  ) : showAdd ? (
    <Button type="button" className="shrink-0" onClick={startAdd}>
      <Plus className="h-4 w-4" />
      {t('corporation.add-employee')}
    </Button>
  ) : null

  return (
    <WorkPage>
      <PageHeading>{t('nav.corporation')}</PageHeading>
      <div className="flex flex-col gap-3 border-b border-border sm:flex-row sm:items-end sm:justify-between">
        <div className="flex gap-4" role="tablist" aria-label={t('nav.corporation')}>
          <TabButton active={location.tab === 'organizations'} onClick={() => selectTab('organizations')}>
            {t('corporation.tab-organizations', { count: data.organizationCount })}
          </TabButton>
          <TabButton active={location.tab === 'personnel'} onClick={() => selectTab('personnel')}>
            {t('corporation.tab-personnel', { count: data.personnelCount })}
          </TabButton>
        </div>
        {tabAction ? <div className="pb-2">{tabAction}</div> : null}
      </div>
      <FilterBar
        query={location.query}
        kind={location.kind}
        onQuery={(query) => write({ query })}
        onKind={(kind) => write({ kind })}
        onReset={() => write({ query: '', kind: 'all' })}
      />
      {data.corporationEmpty ? (
        <PageState
          kind="empty"
          title={t('corporation.empty-orgs-title')}
          description={t('corporation.need-organization')}
          action={data.createOrganization ? (
            <Button type="button" onClick={() => setCreateOpen(true)}>{t('corporation.create-organization')}</Button>
          ) : undefined}
        />
      ) : location.tab === 'organizations' ? (
        organizations.length === 0 ? (
          <PageState kind="empty" description={location.query || location.kind !== 'all' ? t('corporation.empty-filter') : t('corporation.empty-orgs')} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {organizations.map((organization) => (
              <OrganizationCard
                key={organization.id}
                organization={organization}
                onOpen={() => openOrganization(organization.id)}
                onEdit={() => setEditOrg(directoryOf(organization))}
                onDelete={() => { setDeleteError(''); setDeleteTarget(organization) }}
              />
            ))}
          </div>
        )
      ) : editorOpen && edited ? (
        <PersonnelComposer
          organizationId={edited.organizationId}
          employeeId={edited.employeeId}
          organizationName={edited.organizationName}
          createTargets={data.createTargets}
          onOrganizationChange={() => undefined}
          onClose={(savedId) => {
            closeEditor()
            if (savedId) toast.success(t('corporation.saved'))
          }}
        />
      ) : location.employee && location.employee !== 'new' ? (
        <PageState kind="empty" description={t('corporation.editor-denied')} />
      ) : personnel.length === 0 ? (
        <PageState
          kind="empty"
          title={t('corporation.empty-personnel-title')}
          description={location.query || location.kind !== 'all' ? t('corporation.empty-filter') : t('corporation.empty-personnel')}
        />
      ) : (
        <PersonnelTable
          rows={personnel}
          onEdit={(row) => write({ tab: 'personnel', personnelOrg: row.organizationId, employee: row.employeeId })}
          onArchive={(row) => { setArchiveError(''); setArchiveRow(row) }}
          onOpen={(row) => openOrganization(row.organizationId)}
        />
      )}
      <AlertDialog open={deleteTarget != null} onOpenChange={(open) => { if (!open && !deleteState.isLoading) { setDeleteTarget(null); setDeleteError('') } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('corporation.delete-title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget ? t('corporation.delete-body', { name: deleteTarget.fullName }) : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError ? <p className="text-sm text-destructive" role="alert">{deleteError}</p> : null}
          <AlertDialogFooter>
            <AlertDialogCancel type="button" disabled={deleteState.isLoading}>{t('corporation.cancel')}</AlertDialogCancel>
            <Button type="button" variant="destructive" disabled={deleteState.isLoading || !deleteTarget?.canDelete} onClick={() => void confirmDelete()}>
              {t('corporation.delete')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <CreateOrganizationDialog open={createOpen} onOpenChange={setCreateOpen} />
      <EditOrganizationDialog
        key={editOrg?.id ?? 'organization'}
        organization={editOrg}
        open={editOrg != null}
        onOpenChange={(open) => { if (!open) setEditOrg(null) }}
      />
      <AddEmployeeDialog
        open={addOpen || location.employee === 'new'}
        targets={data.createTargets.map((target) => ({ id: target.id, name: target.fullName }))}
        preferredOrganizationId={location.personnelOrg}
        onOpenChange={(open) => {
          setAddOpen(open)
          if (!open && location.employee === 'new') write({ employee: null, personnelOrg: null, tab: 'personnel' })
        }}
        onCreated={() => {
          const filtersActive = location.query.trim() !== '' || location.kind !== 'all'
          setAddOpen(false)
          if (location.employee === 'new') write({ employee: null, personnelOrg: null, tab: 'personnel' })
          toast.success(filtersActive ? t('corporation.created-filtered') : t('corporation.saved'))
        }}
      />
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
          {archiveError ? (
            <div className="space-y-2" role="alert">
              <p className="text-sm text-destructive">{archiveError}</p>
              <Button type="button" variant="outline" onClick={() => { setArchiveRow(null); setArchiveError(''); void overview.refetch() }}>
                {t('corporation.refresh')}
              </Button>
            </div>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel type="button" disabled={archiveState.isLoading}>{t('corporation.cancel')}</AlertDialogCancel>
            <Button type="button" variant="destructive" disabled={archiveState.isLoading || !archiveRow?.actions.archive} onClick={() => void confirmArchive()}>
              {t('corporation.remove-confirm')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={pendingTab != null} onOpenChange={(open) => { if (!open) setPendingTab(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('forms.leave-title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('corporation.leave-body')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">{t('corporation.switch-stay')}</AlertDialogCancel>
            <Button type="button" variant="destructive" onClick={() => {
              if (pendingTab) write({ tab: pendingTab, employee: null, personnelOrg: null })
              setPendingTab(null)
            }}
            >
              {t('corporation.switch-discard')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </WorkPage>
  )
}

function LiveCorporation() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const location = readCorporateLocation(searchParams)
  const organizations = useGetOrganizationsQuery()
  const [createOpen, setCreateOpen] = useState(false)
  const rows = organizations.currentData ?? []
  const needle = location.query.trim().toLowerCase()
  const visible = rows.filter((item) => {
    const name = `${item.fullName ?? ''} ${item.shortName ?? ''} ${item.address ?? ''}`.toLowerCase()
    return !needle || name.includes(needle)
  })
  const write = (patch: Parameters<typeof writeCorporateLocation>[1]) => {
    setSearchParams((current) => writeCorporateLocation(current, patch), { replace: true })
  }
  if (organizations.isLoading && !organizations.currentData) return <WorkPage><PageState kind="loading" description={t('workspace.loading')} /></WorkPage>
  if (organizations.isError) {
    return <WorkPage><PageState kind="error" description={t('corporation.load-error')} action={<Button type="button" variant="outline" onClick={() => void organizations.refetch()}>{t('workspace.retry')}</Button>} /></WorkPage>
  }
  return (
    <WorkPage>
      <PageHeading>{t('nav.corporation')}</PageHeading>
      <div className="flex flex-col gap-3 border-b border-border sm:flex-row sm:items-end sm:justify-between">
        <div className="flex gap-4" role="tablist" aria-label={t('nav.corporation')}>
          <TabButton active={location.tab === 'organizations'} onClick={() => write({ tab: 'organizations', employee: null, personnelOrg: null })}>
            {t('corporation.tab-organizations', { count: rows.length })}
          </TabButton>
          <TabButton active={location.tab === 'personnel'} onClick={() => write({ tab: 'personnel', employee: null, personnelOrg: null })}>
            {t('corporation.tab-personnel-plain')}
          </TabButton>
        </div>
        {location.tab === 'organizations' ? (
          <div className="pb-2">
            <Button type="button" className="shrink-0" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              {t('corporation.create-organization')}
            </Button>
          </div>
        ) : null}
      </div>
      <Input
        value={location.query}
        onChange={(event) => write({ query: event.target.value })}
        placeholder={t('corporation.search')}
        aria-label={t('corporation.search')}
        className="sm:max-w-sm"
      />
      {location.tab === 'personnel' || location.employee ? (
        <PageState kind="empty" description={t('personnel.unavailable')} />
      ) : visible.length === 0 ? (
        <PageState kind="empty" description={rows.length === 0 ? t('corporation.need-organization') : t('corporation.empty-filter')} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {visible.map((organization) => (
            <article
              key={organization.id}
              className="flex cursor-pointer flex-col gap-4 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              role="link"
              tabIndex={0}
              aria-label={t('corporation.open-card', { name: organization.fullName || organization.shortName || '' })}
              onClick={() => navigate(routes.settings.organization(organization.id))}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return
                event.preventDefault()
                navigate(routes.settings.organization(organization.id))
              }}
            >
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Building2 className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-base font-semibold leading-snug">{organization.fullName || organization.shortName}</h2>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground"
                          aria-label={t('corporation.org-actions', { name: organization.fullName || organization.shortName || '' })}
                          onClick={(event) => event.stopPropagation()}
                          onKeyDown={(event) => event.stopPropagation()}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => navigate(routes.settings.organization(organization.id))}>
                          {t('corporation.open')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
              <dl className="grid gap-2 text-sm">
                <CardFact label={t('corporation.field-short')} value={organization.shortName} />
                <CardFact label={t('corporation.field-address')} value={organization.address} />
              </dl>
            </article>
          ))}
        </div>
      )}
      <CreateOrganizationDialog open={createOpen} onOpenChange={setCreateOpen} />
    </WorkPage>
  )
}

function CardFact({ label, value }: { label: string; value?: string }) {
  return (
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 font-medium">{value?.trim() ? value : '—'}</dd>
    </div>
  )
}

function FilterBar({
  query,
  kind,
  onQuery,
  onKind,
  onReset,
}: {
  query: string
  kind: CorporateKindFilter
  onQuery: (query: string) => void
  onKind: (kind: CorporateKindFilter) => void
  onReset: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder={t('corporation.search')}
          aria-label={t('corporation.search')}
          className="sm:max-w-sm"
        />
        <Select value={kind} onValueChange={(value) => onKind(value as CorporateKindFilter)}>
          <SelectTrigger className="sm:w-64" aria-label={t('corporation.filter-label')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('corporation.filter-all')}</SelectItem>
            <SelectItem value="laboratory">{t(organizationKindLabelKey('laboratory'))}</SelectItem>
            <SelectItem value="customer">{t(organizationKindLabelKey('customer'))}</SelectItem>
          </SelectContent>
        </Select>
        <Button type="button" variant="outline" onClick={onReset}>{t('corporation.reset')}</Button>
    </div>
  )
}

function OrganizationCard({
  organization,
  onOpen,
  onEdit,
  onDelete,
}: {
  organization: CorporateOverviewOrganization
  onOpen: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const { t } = useTranslation()
  return (
    <article
      className="flex cursor-pointer flex-col rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      role="link"
      tabIndex={0}
      aria-label={t('corporation.open-card', { name: organization.fullName })}
      onClick={(event) => {
        if (isMenuEvent(event)) return
        onOpen()
      }}
      onKeyDown={(event) => {
        if (isMenuEvent(event)) return
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        onOpen()
      }}
    >
      <OrganizationSummary
        organization={organization}
        menu={(
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="-mr-2 -mt-1 text-muted-foreground"
                aria-label={t('corporation.org-actions', { name: organization.fullName })}
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => event.stopPropagation()}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
            >
              <DropdownMenuItem onSelect={onOpen}>{t('corporation.open')}</DropdownMenuItem>
              {organization.canUpdate ? (
                <DropdownMenuItem onSelect={onEdit}>{t('corporation.edit-organization')}</DropdownMenuItem>
              ) : null}
              {organization.canDelete ? (
                <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={onDelete}>
                  {t('corporation.delete')}
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      />
    </article>
  )
}

function PersonnelTable({
  rows,
  onEdit,
  onArchive,
  onOpen,
}: {
  rows: CorporatePersonnelRow[]
  onEdit: (row: CorporatePersonnelRow) => void
  onArchive: (row: CorporatePersonnelRow) => void
  onOpen: (row: CorporatePersonnelRow) => void
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
            <TableHead className="px-4">{t('corporation.column-organization')}</TableHead>
            <TableHead className="w-12 px-4"><span className="sr-only">{t('corporation.actions-column')}</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const actions = [row.actions.update, row.actions.archive, row.actions.openOrganization].filter(Boolean).length
            const label = row.name || row.email || t('corporation.column-employee')
            return (
              <TableRow key={`${row.organizationId}:${row.employeeId}`}>
                <TableCell className="px-4 py-3">
                  <span className="block font-medium">{row.name || '—'}</span>
                  {row.email ? <span className="block text-xs text-muted-foreground">{row.email}</span> : null}
                </TableCell>
                <TableCell className="px-4 py-3">{row.position || '—'}</TableCell>
                <TableCell className="px-4 py-3">
                  {row.roles == null ? t('corporation.roles-hidden') : row.roles.length === 0 ? t('corporation.no-role') : row.roles.map((role) => role.displayName).join(', ')}
                </TableCell>
                <TableCell className="px-4 py-3">
                  <span className="block">{row.organizationName}</span>
                  <span className="text-xs text-muted-foreground">
                    {t(organizationKindLabelKey(row.organizationKind))}
                  </span>
                </TableCell>
                <TableCell className="px-4 py-3">
                  {actions > 0 ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button type="button" variant="ghost" size="icon" className="text-muted-foreground" aria-label={t('corporation.actions', { name: label })}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {row.actions.update ? <DropdownMenuItem onSelect={() => onEdit(row)}>{t('corporation.edit')}</DropdownMenuItem> : null}
                        {row.actions.archive ? <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => onArchive(row)}>{t('corporation.remove')}</DropdownMenuItem> : null}
                        {row.actions.openOrganization ? <DropdownMenuItem onSelect={() => onOpen(row)}>{t('corporation.open-organization')}</DropdownMenuItem> : null}
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

function isMenuEvent(event: { target: EventTarget | null }) {
  return event.target instanceof Element && event.target.closest('[role="menu"]') != null
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
    inn: organization.inn,
    kpp: organization.kpp,
  }
}
