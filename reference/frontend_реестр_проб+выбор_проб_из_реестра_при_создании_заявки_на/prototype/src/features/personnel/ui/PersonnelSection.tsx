import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  personnelError,
  useGetEmployeesQuery,
  useGetPersonnelConfigQuery,
  useInitializePersonnelWorkspaceMutation,
} from '../../../entities/personnel'
import { Button } from '../../../shared/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../../shared/ui/dialog'
import { PageState } from '../../../shared/ui/page'
import { TabButton } from '../../../shared/ui/tab-button'
import { AddEmployeeDialog } from './AddEmployeeDialog'
import { EditEmployeeDialog } from './EditEmployeeDialog'
import { PersonnelOrgStructure } from './PersonnelOrgStructure'
import { PersonnelRegistry } from './PersonnelRegistry'
import { PersonnelSettings } from './PersonnelSettings'

const VIEWS = ['registry', 'structure', 'schedules', 'admitted', 'courses', 'documents'] as const
type PersonnelView = (typeof VIEWS)[number]

export function PersonnelSection({ organizationId, organizationName }: { organizationId: number; organizationName: string }) {
  const { t } = useTranslation()
  const [search, setSearch] = useSearchParams()
  const requested = search.get('view')
  const view: PersonnelView = VIEWS.includes(requested as PersonnelView) ? requested as PersonnelView : 'registry'
  const employee = search.get('employee')
  const creating = employee === 'new'
  const [archived, setArchived] = useState(false)
  const [settings, setSettings] = useState(false)
  const active = useGetEmployeesQuery({ organizationId, archived: false, q: '' })
  const archivedList = useGetEmployeesQuery({ organizationId, archived: true, q: '' }, { skip: !archived })
  const config = useGetPersonnelConfigQuery({ organizationId })
  const [initialize, initializeState] = useInitializePersonnelWorkspaceMutation()

  const setView = (next: PersonnelView) => {
    const params = new URLSearchParams(search)
    if (next === 'registry') params.delete('view')
    else params.set('view', next)
    setSearch(params, { replace: true })
  }

  const openEmployee = (id: string | null) => {
    const next = new URLSearchParams(search)
    if (id) next.set('employee', id)
    else next.delete('employee')
    setSearch(next, { replace: true })
  }

  if (active.isLoading || config.isLoading) {
    return <PageState kind="loading" description={t('personnel.loading')} />
  }
  if (active.isError || (archived && archivedList.isError)) {
    const error = active.isError ? active.error : archivedList.error
    return <PageState kind="error" description={t(`personnel.errors.${personnelError(error).code}`, { defaultValue: t('personnel.errors.generic') })} />
  }
  if (active.data && !active.data.initialized) {
    return (
      <section className="space-y-4">
        <PageState
          kind="empty"
          description={t('personnel.missing')}
          action={config.data?.canInitialize ? (
            <Button type="button" disabled={initializeState.isLoading} onClick={() => void initialize({ organizationId })}>
              {t('directories.prepare')}
            </Button>
          ) : undefined}
        />
      </section>
    )
  }

  const source = archived ? archivedList.data : active.data
  const permissions = source?.permissions ?? active.data?.permissions
  const rows = source?.employees ?? []
  const metricRows = active.data?.employees ?? []
  const registryLoading = archived && archivedList.isLoading

  return (
    <section className="space-y-4">
      <header className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">{t('nav.personnel')}</h1>
        <nav className="-mx-1 flex gap-5 overflow-x-auto border-b border-border px-1" role="tablist" aria-label={t('nav.personnel')}>
          {VIEWS.map((item) => (
            <TabButton key={item} active={view === item} onClick={() => setView(item)}>
              <span className="whitespace-nowrap">{t(`personnel.views.${item}`)}</span>
            </TabButton>
          ))}
        </nav>
      </header>

      {view === 'registry' && registryLoading ? <PageState kind="loading" description={t('personnel.loading')} /> : null}
      {view === 'registry' && !registryLoading && permissions ? (
        <PersonnelRegistry
          organizationId={organizationId}
          rows={rows}
          metricRows={metricRows}
          fields={source?.fields ?? active.data?.fields ?? []}
          columns={source?.columns ?? active.data?.columns ?? []}
          options={config.data?.options}
          permissions={permissions}
          archived={archived}
          onArchivedChange={setArchived}
          onOpen={(id) => openEmployee(id)}
          onCreate={() => openEmployee('new')}
          onOpenSettings={() => setSettings(true)}
        />
      ) : null}
      {view === 'structure' ? <PersonnelOrgStructure organizationId={organizationId} /> : null}
      {view === 'schedules' ? <PageState kind="empty" title={t('personnel.views.schedules')} description={t('personnel.empty-tabs.schedules')} /> : null}
      {view === 'admitted' ? <PageState kind="empty" title={t('personnel.views.admitted')} description={t('personnel.empty-tabs.admitted')} /> : null}
      {view === 'courses' ? <PageState kind="empty" title={t('personnel.views.courses')} description={t('personnel.empty-tabs.courses')} /> : null}
      {view === 'documents' ? <PageState kind="empty" title={t('personnel.views.documents')} description={t('personnel.empty-tabs.documents')} /> : null}

      {permissions?.create ? (
        <AddEmployeeDialog
          open={creating}
          targets={[{ id: organizationId, name: organizationName }]}
          onOpenChange={(open) => { if (!open) openEmployee(null) }}
          onCreated={() => {
            openEmployee(null)
            toast.success(t('corporation.saved'))
          }}
        />
      ) : null}
      {employee && employee !== 'new' ? (
        <EditEmployeeDialog
          open
          organizationId={organizationId}
          organizationName={organizationName}
          employeeId={employee}
          onOpenChange={(open) => { if (!open) openEmployee(null) }}
          onSaved={() => {
            openEmployee(null)
            toast.success(t('corporation.saved'))
          }}
        />
      ) : null}
      <Dialog open={settings} onOpenChange={setSettings}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('personnel.settings')}</DialogTitle>
          </DialogHeader>
          {config.data?.config ? (
            <PersonnelSettings organizationId={organizationId} data={config.data} onClose={() => setSettings(false)} />
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  )
}
