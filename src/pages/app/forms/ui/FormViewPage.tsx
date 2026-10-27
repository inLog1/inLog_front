import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  acceptTableResponse,
  effectiveWork,
  readTableError,
  readWorkQuery,
  useGetColumnCatalogQuery,
  useGetTableViewQuery,
  useQueryTableRowsQuery,
  workDiffers,
  writeWorkQuery,
  type TableViewConfig,
} from '../../../../entities/table-view'
import { useGetFormsQuery } from '../../../../entities/form'
import { useGetSessionAccessQuery } from '../../../../entities/access'
import { RecordTable } from '../../../../features/table-view/ui/RecordTable'
import { ViewSettings } from '../../../../features/table-view/ui/ViewSettings'
import { WorkspaceStatus } from '../../../../features/org-project-selector'
import { useHasOrganizationGrant, useWorkspaceSection } from '../../../../features/org-project-selector/model/useWorkspaceSection'
import { useWorkspaceHref } from '../../../../features/org-project-selector/model/useEnsureOrgProjectParams'
import { routes } from '../../../../shared/lib/routes'
import { Button } from '../../../../shared/ui/button'
import { FormsBoundary } from './FormsBoundary'

export function FormViewPage() {
  return (
    <FormsBoundary>
      <TableGate />
    </FormsBoundary>
  )
}

function TableGate() {
  const { t } = useTranslation()
  const { formId = '', viewId = '' } = useParams()
  const href = useWorkspaceHref()
  const [search, setSearch] = useSearchParams()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const section = useWorkspaceSection('organization', { resource: 'forms', action: 'read' })
  const organizationId = section.kind === 'ready' ? section.organizationId : null
  const canViews = useHasOrganizationGrant('table-views', 'read', organizationId)
  const canRecords = useHasOrganizationGrant('form-records', 'read', organizationId)
  const canUpdate = useHasOrganizationGrant('table-views', 'update', organizationId)
  const access = useGetSessionAccessQuery(undefined, { skip: organizationId == null })
  const grantsReady = access.isSuccess && access.data?.accessState === 'ready'
  const allowed = grantsReady && canViews && canRecords
  const view = useGetTableViewQuery(
    { organizationId: organizationId ?? 0, formId, viewId },
    { skip: organizationId == null || !allowed || formId === '' || viewId === '' },
  )
  const forms = useGetFormsQuery({ organizationId: organizationId ?? 0 }, { skip: organizationId == null || !allowed })
  const catalog = useGetColumnCatalogQuery(
    { organizationId: organizationId ?? 0, formId },
    { skip: organizationId == null || !allowed || formId === '' },
  )
  const parsed = readWorkQuery(search)
  const saved = view.data
  const effective = saved && parsed.ok ? effectiveWork(parsed.work, saved) : null
  const rows = useQueryTableRowsQuery({
    organizationId: organizationId ?? 0,
    formId,
    viewId,
    offset: effective ? (effective.page - 1) * effective.pageSize : 0,
    limit: effective?.pageSize ?? saved?.pageSize ?? 25,
    ...(parsed.ok && parsed.work.filters != null ? { filters: parsed.work.filters } : {}),
    ...(parsed.ok && parsed.work.sort != null ? { sort: parsed.work.sort } : {}),
  }, {
    skip: organizationId == null || !allowed || !saved || saved.schemaVersion !== 1 || !parsed.ok || effective == null,
  })
  const sourceKey = effective && saved ? JSON.stringify({ filters: effective.filters, sort: effective.sort, pageSize: effective.pageSize }) : ''
  const [draftKey, setDraftKey] = useState('')
  const [draft, setDraft] = useState<TableViewConfig | null>(null)
  if (saved && effective && sourceKey !== draftKey) {
    setDraftKey(sourceKey)
    setDraft({
      schemaVersion: 1,
      title: saved.title,
      description: saved.description,
      columns: saved.columns,
      filters: effective.filters,
      sort: effective.sort,
      pageSize: effective.pageSize,
    })
  }
  if (section.kind !== 'ready' || organizationId == null) {
    return (
      <WorkspaceStatus
        status={section.kind === 'ready' ? 'loading' : section.status}
        reason={section.kind === 'ready' ? null : section.reason}
        onRetry={section.kind === 'ready' ? undefined : section.refetch}
      />
    )
  }
  if (!grantsReady) return <WorkspaceStatus status="loading" reason={null} />
  if (!canViews || !canRecords) return <WorkspaceStatus status="forbidden" reason="missing-permission" />
  if (view.isLoading) return <p className="p-4 text-sm text-muted-foreground">{t('tableViews.loading')}</p>
  if (view.isError || !saved) {
    const parsedError = readTableError(view.error)
    return (
      <div className="space-y-2 p-4">
        <p className="text-sm text-muted-foreground">{t(`tableViews.errors.${parsedError.code ?? 'generic'}`, { defaultValue: t('tableViews.errors.generic') })}</p>
        <Button type="button" variant="outline" onClick={() => void view.refetch()}>{t('tableViews.retry')}</Button>
      </div>
    )
  }
  if (saved.schemaVersion !== 1) return <p className="p-4 text-sm text-muted-foreground">{t('tableViews.errors.unknown_schema')}</p>
  if (!parsed.ok || !effective || !draft) {
    return (
      <div className="space-y-2 p-4">
        <p className="text-sm text-muted-foreground">{t('tableViews.invalid-work')}</p>
        <Button type="button" variant="outline" onClick={() => setSearch((current) => writeWorkQuery(current, { page: 1, pageSize: null, sort: null, filters: null }, saved))}>{t('tableViews.reset')}</Button>
      </div>
    )
  }
  const formTitle = forms.data?.forms.find((form) => form.id === formId)?.title ?? ''
  const rowError = readTableError(rows.error)
  const accepted = rows.currentData && acceptTableResponse({
    organizationId,
    formId,
    viewId,
    offset: (effective.page - 1) * effective.pageSize,
    limit: effective.pageSize,
    filters: effective.filters,
    sort: effective.sort,
    columns: saved.columns,
  }, rows.currentData) ? rows.currentData : null
  const pages = accepted ? Math.max(1, Math.ceil(accepted.total / accepted.limit)) : 1
  const apply = () => {
    setSearch((current) => writeWorkQuery(current, {
      page: 1,
      pageSize: draft.pageSize,
      sort: draft.sort,
      filters: draft.filters,
    }, saved))
    setFiltersOpen(false)
  }
  const reset = () => {
    setSearch((current) => writeWorkQuery(current, { page: 1, pageSize: null, sort: null, filters: null }, saved))
    setFiltersOpen(false)
  }
  return (
    <div className="mx-auto flex min-w-0 max-w-full flex-col gap-4 overflow-x-hidden p-4 pb-20">
      <Link className="text-sm text-primary underline-offset-4 hover:underline" to={href(routes.forms.views(formId), 'organization')}>{t('tableViews.back')}</Link>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="min-w-0 text-lg font-semibold">{saved.title}</h2>
        {canUpdate ? (
          <Button asChild variant="outline">
            <Link to={href(routes.forms.viewEdit(formId, viewId), 'organization')}>{t('tableViews.edit')}</Link>
          </Button>
        ) : null}
      </div>
      {formTitle ? <p className="text-sm text-muted-foreground">{t('tableViews.form')}: {formTitle}</p> : null}
      {workDiffers(parsed.work, saved) ? <p className="rounded-md border border-border bg-card p-3 text-sm" role="status">{t('tableViews.dirty')}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" className="md:hidden" onClick={() => setFiltersOpen((open) => !open)}>{t('tableViews.filters')}</Button>
        <Button type="button" variant="outline" onClick={reset}>{t('tableViews.reset')}</Button>
      </div>
      <div className={filtersOpen ? 'min-w-0 rounded-md border border-border p-3 md:block' : 'hidden min-w-0 rounded-md border border-border p-3 md:block'}>
        <ViewSettings catalog={catalog.data?.columns ?? []} draft={draft} onChange={setDraft} mode="query" />
        <Button type="button" className="mt-3" onClick={apply}>{t('tableViews.apply')}</Button>
      </div>
      {rowError.code === 'incompatible_view' ? (
        <div className="space-y-2 rounded-md border border-border p-3" role="alert">
          <p className="text-sm">{t('tableViews.incompatible')}</p>
          <ul className="list-disc pl-5 text-sm text-muted-foreground">
            {rowError.issues.map((issue, index) => (
              <li key={`${issue.code}-${issue.columnId ?? index}`}>{t(`tableViews.issues.${issue.code}`, { defaultValue: issue.code })}{issue.columnId ? ` (${issue.columnId})` : ''}</li>
            ))}
          </ul>
          {canUpdate ? <Link className="text-sm text-primary underline-offset-4 hover:underline" to={href(routes.forms.viewEdit(formId, viewId), 'organization')}>{t('tableViews.fix')}</Link> : null}
        </div>
      ) : null}
      {rows.isError && rowError.code !== 'incompatible_view' ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{rowError.issues[0]
            ? t(`tableViews.issues.${rowError.issues[0].code}`, { defaultValue: t(`tableViews.errors.${rowError.code ?? 'generic'}`, { defaultValue: t('tableViews.errors.generic') }) })
            : t(`tableViews.errors.${rowError.code ?? 'generic'}`, { defaultValue: t('tableViews.errors.generic') })}</p>
          <Button type="button" variant="outline" onClick={() => void rows.refetch()}>{t('tableViews.retry')}</Button>
        </div>
      ) : null}
      {rows.isFetching && !accepted ? <p className="text-sm text-muted-foreground">{t('tableViews.loading')}</p> : null}
      {accepted && accepted.total === 0 && effective.filters.length === 0 ? <p className="text-sm text-muted-foreground">{t('tableViews.no-records')}</p> : null}
      {accepted && accepted.total === 0 && effective.filters.length > 0 ? <p className="text-sm text-muted-foreground">{t('tableViews.no-matches')}</p> : null}
      {accepted && accepted.total > 0 ? (
        <>
          <p className="text-sm text-muted-foreground">{t('tableViews.found', { count: accepted.total })}</p>
          <RecordTable columns={accepted.columns} rows={accepted.rows} recordHref={(recordId) => href(routes.forms.record(formId, recordId), 'organization')} />
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" disabled={effective.page <= 1} onClick={() => setSearch((current) => writeWorkQuery(current, { ...parsed.work, page: effective.page - 1 }, saved))}>{t('tableViews.previous')}</Button>
            <span className="text-sm text-muted-foreground">{t('tableViews.page', { page: effective.page, pages })}</span>
            <Button type="button" variant="outline" disabled={effective.page >= pages} onClick={() => setSearch((current) => writeWorkQuery(current, { ...parsed.work, page: effective.page + 1 }, saved))}>{t('tableViews.next')}</Button>
          </div>
        </>
      ) : null}
    </div>
  )
}
