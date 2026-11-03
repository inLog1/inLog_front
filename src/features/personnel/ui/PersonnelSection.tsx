import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { COLUMN_FIO, COLUMN_STATE, personnelError, useGetEmployeesQuery, useGetPersonnelConfigQuery, useInitializePersonnelWorkspaceMutation } from '../../../entities/personnel'
import { Button } from '../../../shared/ui/button'
import { Input } from '../../../shared/ui/input'
import { PageHeader, PageState } from '../../../shared/ui/page'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../shared/ui/table'
import { AddEmployeeDialog } from './AddEmployeeDialog'
import { EmployeeForm } from './EmployeeForm'
import { PersonnelSettings } from './PersonnelSettings'

export function PersonnelSection({ organizationId, organizationName }: { organizationId: number; organizationName: string }) {
  const { t } = useTranslation()
  const [search, setSearch] = useSearchParams()
  const employee = search.get('employee')
  const creating = employee === 'new'
  const [addOpen, setAddOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [archived, setArchived] = useState(false)
  const [settings, setSettings] = useState(false)
  const list = useGetEmployeesQuery({ organizationId, archived, q: query })
  const config = useGetPersonnelConfigQuery({ organizationId })
  const [initialize, initializeState] = useInitializePersonnelWorkspaceMutation()

  const openEmployee = (id: string | null) => {
    const next = new URLSearchParams(search)
    if (id) next.set('employee', id)
    else next.delete('employee')
    setSearch(next, { replace: true })
  }

  if (list.isLoading || config.isLoading) {
    return (
      <section className="space-y-4">
        <PageHeader title={t('nav.personnel')} description={organizationName} />
        <PageState kind="loading" description={t('personnel.loading')} />
      </section>
    )
  }
  if (list.isError) {
    return (
      <section className="space-y-4">
        <PageHeader title={t('nav.personnel')} description={organizationName} />
        <PageState kind="error" description={t(`personnel.errors.${personnelError(list.error).code}`, { defaultValue: t('personnel.errors.generic') })} />
      </section>
    )
  }
  if (list.data && !list.data.initialized) {
    return (
      <section className="space-y-4">
        <PageHeader title={t('nav.personnel')} description={organizationName} />
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

  const columns = list.data?.columns ?? []
  const fields = list.data?.fields ?? []
  const labelFor = (columnId: string) => {
    if (columnId === COLUMN_FIO) return t('personnel.columns-fio')
    if (columnId === COLUMN_STATE) return t('personnel.columns-state')
    return fields.find((field) => field.id === columnId)?.label ?? columnId
  }

  return (
    <section className="space-y-4">
      <PageHeader title={t('nav.personnel')} description={organizationName} />
      {employee != null && !creating ? (
        <div className="space-y-3">
          <Button type="button" variant="outline" onClick={() => openEmployee(null)}>{t('personnel.back')}</Button>
          <EmployeeForm
            organizationId={organizationId}
            organizationName={organizationName}
            employeeId={employee}
            onClose={(savedId) => openEmployee(savedId ?? null)}
          />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('personnel.search')} aria-label={t('personnel.search')} />
            <Button type="button" variant={archived ? 'default' : 'outline'} onClick={() => setArchived((value) => !value)}>
              {archived ? t('personnel.show-active') : t('personnel.show-archived')}
            </Button>
            {list.data?.permissions.create ? <Button type="button" onClick={() => setAddOpen(true)}>{t('personnel.add')}</Button> : null}
            {list.data?.permissions.structure ? <Button type="button" variant="outline" onClick={() => setSettings(true)}>{t('personnel.settings')}</Button> : null}
          </div>
          {list.data?.employees.length === 0 ? (
            <PageState kind="empty" title={t('personnel.empty-title')} description={t('personnel.empty')} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((columnId) => <TableHead key={columnId}>{labelFor(columnId)}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.data?.employees.map((row) => (
                  <TableRow key={row.id} className="cursor-pointer" onClick={() => openEmployee(row.id)}>
                    {columns.map((columnId) => (
                      <TableCell key={columnId}>
                        {columnId === COLUMN_STATE ? t(row.cells[columnId] === 'archived' ? 'directories.archived' : 'directories.active') : row.cells[columnId]}
                        {row.marks[columnId] === 'archived' ? ` (${t('directories.archived')})` : ''}
                        {row.marks[columnId] === 'missing' ? ` (${t('personnel.missing-value')})` : ''}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {settings && config.data?.config ? <PersonnelSettings organizationId={organizationId} data={config.data} onClose={() => setSettings(false)} /> : null}
          {list.data?.permissions.create ? (
            <AddEmployeeDialog
              open={addOpen || creating}
              targets={[{ id: organizationId, name: organizationName }]}
              onOpenChange={(open) => {
                setAddOpen(open)
                if (!open && creating) openEmployee(null)
              }}
              onCreated={() => {
                setAddOpen(false)
                if (creating) openEmployee(null)
                toast.success(t('corporation.saved'))
              }}
            />
          ) : null}
        </>
      )}
    </section>
  )
}
