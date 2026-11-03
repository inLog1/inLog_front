import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { personnelError, useGetDirectoriesQuery, useGetDirectoryQuery, type DirectoryRecord } from '../../../entities/personnel'
import { routes } from '../../../shared/lib/routes'
import { Button } from '../../../shared/ui/button'
import { PageState } from '../../../shared/ui/page'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../shared/ui/table'

export function PersonnelOrgStructure({ organizationId }: { organizationId: number }) {
  const { t } = useTranslation()
  const list = useGetDirectoriesQuery({ organizationId })
  const departments = list.data?.directories.find((item) => item.key === 'departments') ?? null
  const workplaces = list.data?.directories.find((item) => item.key === 'workplaces') ?? null
  const departmentDetail = useGetDirectoryQuery(
    { organizationId, directoryId: departments?.id ?? '' },
    { skip: departments == null },
  )
  const workplaceDetail = useGetDirectoryQuery(
    { organizationId, directoryId: workplaces?.id ?? '' },
    { skip: workplaces == null },
  )

  if (list.isLoading) return <PageState kind="loading" description={t('directories.loading')} />
  if (list.isError) {
    return (
      <PageState
        kind="error"
        description={t(`directories.errors.${personnelError(list.error).code}`, { defaultValue: t('directories.errors.generic') })}
      />
    )
  }
  if (list.data && !list.data.initialized) {
    return <PageState kind="empty" description={t('directories.missing')} />
  }

  const referenceHref = `${routes.settings.organizationReference(organizationId)}?org=${organizationId}&directoryOrg=${organizationId}`
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{t('personnel.structure-departments')}</p>
        <Button asChild variant="outline" size="sm">
          <Link to={referenceHref}>{t('personnel.structure-open-reference')}</Link>
        </Button>
      </div>
      <RegistryTable
        title={t('personnel.structure-departments')}
        loading={departmentDetail.isLoading}
        error={departmentDetail.isError ? departmentDetail.error : null}
        records={(departmentDetail.data?.records ?? []).filter((record) => !record.archived)}
        columns={[
          { id: 'name', label: t('personnel.structure-name'), value: (record) => record.name || record.label },
          { id: 'code', label: t('personnel.structure-code'), value: (record) => record.code ?? '' },
          { id: 'parent', label: t('personnel.structure-parent'), value: (record) => record.parentLabel ?? '' },
        ]}
      />
      <RegistryTable
        title={t('personnel.structure-workplaces')}
        loading={workplaceDetail.isLoading}
        error={workplaceDetail.isError ? workplaceDetail.error : null}
        records={(workplaceDetail.data?.records ?? []).filter((record) => !record.archived)}
        columns={[
          { id: 'name', label: t('personnel.structure-name'), value: (record) => record.name || record.label },
          { id: 'department', label: t('personnel.filter-department'), value: (record) => record.departmentLabel ?? '' },
        ]}
      />
    </div>
  )
}

function RegistryTable({
  title,
  loading,
  error,
  records,
  columns,
}: {
  title: string
  loading: boolean
  error: unknown
  records: DirectoryRecord[]
  columns: { id: string; label: string; value: (record: DirectoryRecord) => string }[]
}) {
  const { t } = useTranslation()
  if (loading) return <PageState kind="loading" description={t('directories.loading')} />
  if (error) {
    return <PageState kind="error" description={t(`directories.errors.${personnelError(error).code}`, { defaultValue: t('directories.errors.generic') })} />
  }
  return (
    <section className="min-w-0 overflow-x-auto rounded-xl border border-border bg-card">
      <h2 className="border-b border-border px-4 py-3 text-sm font-semibold">{title}</h2>
      {records.length === 0 ? (
        <p className="px-4 py-5 text-sm text-muted-foreground">{t('personnel.structure-empty')}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => <TableHead key={column.id}>{column.label}</TableHead>)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map((record) => (
              <TableRow key={record.id}>
                {columns.map((column) => (
                  <TableCell key={column.id}>{column.value(record).trim() || t('personnel.dash')}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  )
}
