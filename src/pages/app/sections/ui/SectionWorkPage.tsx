import { useEffect, useState } from 'react'
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
  type WorkQuery,
} from '../../../../entities/table-view'
import {
  isSectionId,
  readSectionError,
  sectionReturnPath,
  sectionTableSearch,
  useGetPublishedSectionQuery,
  useGetSectionPreviewQuery,
} from '../../../../entities/section'
import { RecordTable } from '../../../../features/table-view/ui/RecordTable'
import { ViewSettings } from '../../../../features/table-view/ui/ViewSettings'
import { WorkspaceStatus } from '../../../../features/org-project-selector'
import { useHasOrganizationGrant, useOrganizationAccessReady, useWorkspaceSection } from '../../../../features/org-project-selector/model/useWorkspaceSection'
import { useWorkspaceHref } from '../../../../features/org-project-selector/model/useEnsureOrgProjectParams'
import { routes } from '../../../../shared/lib/routes'
import { Button } from '../../../../shared/ui/button'
import { SectionsBoundary } from './SectionsBoundary'

export function SectionWorkPage() {
  return (
    <SectionsBoundary>
      <WorkGate mode="published" />
    </SectionsBoundary>
  )
}

export function SectionPreviewPage() {
  return (
    <SectionsBoundary>
      <WorkGate mode="preview" />
    </SectionsBoundary>
  )
}

function WorkGate({ mode }: { mode: 'published' | 'preview' }) {
  const { t } = useTranslation()
  const { sectionId = '' } = useParams()
  const section = useWorkspaceSection('organization')
  const organizationId = section.kind === 'ready' ? section.organizationId : null
  const accessReady = useOrganizationAccessReady(organizationId)
  const canRead = useHasOrganizationGrant('sections', 'read', organizationId)
  const canUpdate = useHasOrganizationGrant('sections', 'update', organizationId)
  const canForms = useHasOrganizationGrant('forms', 'read', organizationId)
  const canViews = useHasOrganizationGrant('table-views', 'read', organizationId)
  const canRecords = useHasOrganizationGrant('form-records', 'read', organizationId)
  const canCreate = useHasOrganizationGrant('form-records', 'create', organizationId)
  const allowed = mode === 'preview' ? canUpdate : canRead && canForms && canViews && canRecords
  const published = useGetPublishedSectionQuery(
    { organizationId: organizationId ?? 0, sectionId },
    { skip: mode !== 'published' || organizationId == null || !allowed || !isSectionId(sectionId) },
  )
  const preview = useGetSectionPreviewQuery(
    { organizationId: organizationId ?? 0, sectionId },
    { skip: mode !== 'preview' || organizationId == null || !allowed || !isSectionId(sectionId) },
  )
  if (!isSectionId(sectionId)) return <p className="p-4 text-sm text-muted-foreground">{t('sections.errors.not_found')}</p>
  if (section.kind !== 'ready' || organizationId == null) {
    return (
      <WorkspaceStatus
        status={section.kind === 'ready' ? 'loading' : section.status}
        reason={section.kind === 'ready' ? null : section.reason}
        onRetry={section.kind === 'ready' ? undefined : section.refetch}
      />
    )
  }
  if (!accessReady) return <WorkspaceStatus status="loading" reason={null} />
  if (!allowed) return <WorkspaceStatus status="forbidden" reason="missing-permission" />
  const query = mode === 'preview' ? preview : published
  if (query.isLoading || query.isUninitialized) return <p className="p-4 text-sm text-muted-foreground">{t('sections.loading')}</p>
  if (query.isError || !query.isSuccess || !query.currentData) {
    const parsedError = readSectionError(query.error)
    return (
      <div className="space-y-2 p-4">
        <p className="text-sm text-muted-foreground">{t(`sections.errors.${parsedError.code ?? 'generic'}`, { defaultValue: t('sections.errors.generic') })}</p>
        <Button type="button" variant="outline" onClick={() => void query.refetch()}>{t('sections.retry')}</Button>
      </div>
    )
  }
  const body = query.currentData
  return (
    <SectionScreen
      mode={mode}
      organizationId={organizationId}
      sectionId={sectionId}
      title={body.title}
      description={body.description}
      formId={body.formId}
      tableViewId={body.tableViewId}
      showCreate={'showCreate' in body ? body.showCreate : false}
      createLabel={'createLabel' in body ? body.createLabel : ''}
      dependency={'dependency' in body ? body.dependency : null}
      canCreate={canCreate}
      canRecords={canRecords && canViews && canForms}
    />
  )
}

function stampWork(current: URLSearchParams, work: WorkQuery, saved: { pageSize: number; sort: WorkQuery['sort']; filters: WorkQuery['filters'] }, sectionId: string) {
  const savedSort = saved.sort ?? { columnId: 'sys:createdAt', direction: 'desc' as const }
  const savedFilters = saved.filters ?? []
  const next = writeWorkQuery(current, work, { pageSize: saved.pageSize, sort: savedSort, filters: savedFilters })
  const differs = work.page > 1 || workDiffers(work, { pageSize: saved.pageSize, sort: savedSort, filters: savedFilters })
  if (differs) next.set('for', sectionId)
  else next.delete('for')
  return next
}

function SectionScreen({
  mode,
  organizationId,
  sectionId,
  title,
  description,
  formId,
  tableViewId,
  showCreate,
  createLabel,
  dependency,
  canCreate,
  canRecords,
}: {
  mode: 'published' | 'preview'
  organizationId: number
  sectionId: string
  title: string
  description: string
  formId: string
  tableViewId: string
  showCreate: boolean
  createLabel: string
  dependency: string | null
  canCreate: boolean
  canRecords: boolean
}) {
  const { t } = useTranslation()
  const href = useWorkspaceHref()
  const [search, setSearch] = useSearchParams()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const owned = sectionTableSearch(sectionId, search)
  useEffect(() => {
    if (mode === 'published' && owned.changed) setSearch(owned.params, { replace: true })
  }, [mode, owned.changed, owned.params, setSearch])
  const parsed = mode === 'published' && !owned.changed ? readWorkQuery(owned.params) : { ok: true as const, work: { page: 1, pageSize: null, sort: null, filters: null } }
  const view = useGetTableViewQuery(
    { organizationId, formId, viewId: tableViewId },
    { skip: dependency != null || formId === '' || tableViewId === '' || !canRecords },
  )
  const catalog = useGetColumnCatalogQuery(
    { organizationId, formId },
    { skip: dependency != null || formId === '' || !canRecords },
  )
  const saved = view.currentData
  const effective = saved && parsed.ok ? effectiveWork(parsed.work, saved) : null
  const rows = useQueryTableRowsQuery({
    organizationId,
    formId,
    viewId: tableViewId,
    offset: effective ? (effective.page - 1) * effective.pageSize : 0,
    limit: effective?.pageSize ?? saved?.pageSize ?? 25,
    ...(mode === 'published' && parsed.ok && parsed.work.filters != null ? { filters: parsed.work.filters } : {}),
    ...(mode === 'published' && parsed.ok && parsed.work.sort != null ? { sort: parsed.work.sort } : {}),
  }, {
    skip: dependency != null || !canRecords || !saved || saved.schemaVersion !== 1 || !parsed.ok || effective == null,
  })
  const sourceKey = effective && saved ? `${sectionId}:${JSON.stringify({ filters: effective.filters, sort: effective.sort, pageSize: effective.pageSize })}` : ''
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
  const back = sectionReturnPath(sectionId, organizationId)
  const fill = formId ? href(routes.forms.fill(formId), 'organization') : ''
  const createTo = fill ? `${fill}${fill.includes('?') ? '&' : '?'}returnTo=${encodeURIComponent(back)}` : ''
  const recordTo = (recordId: string) => {
    const path = href(routes.forms.record(formId, recordId), 'organization')
    if (mode !== 'published') return path
    return `${path}${path.includes('?') ? '&' : '?'}returnTo=${encodeURIComponent(back)}`
  }
  const rowError = readTableError(rows.error)
  const accepted = rows.currentData && effective && saved && acceptTableResponse({
    organizationId,
    formId,
    viewId: tableViewId,
    offset: (effective.page - 1) * effective.pageSize,
    limit: effective.pageSize,
    filters: effective.filters,
    sort: effective.sort,
    columns: saved.columns,
  }, rows.currentData) ? rows.currentData : null
  const pages = accepted ? Math.max(1, Math.ceil(accepted.total / accepted.limit)) : 1
  return (
    <div className="mx-auto flex min-w-0 max-w-full flex-col gap-4 overflow-x-hidden p-4 pb-24">
      {mode === 'preview' ? <p className="rounded-md border border-border bg-card p-3 text-sm" role="status">{t('sections.preview-banner')}</p> : null}
      <h2 className="min-w-0 text-lg font-semibold break-words">{title}</h2>
      {description ? <p className="whitespace-pre-wrap text-sm text-muted-foreground">{description}</p> : null}
      {mode === 'published' && showCreate && canCreate && createTo ? (
        <Button asChild className="w-fit"><Link to={createTo}>{createLabel || t('sections.add-record')}</Link></Button>
      ) : null}
      {mode === 'preview' ? <p className="text-sm text-muted-foreground">{t('sections.preview-no-create')}</p> : null}
      {dependency ? <p className="text-sm text-muted-foreground" role="alert">{t(`sections.errors.${dependency}`)}</p> : null}
      {!canRecords ? <p className="text-sm text-muted-foreground">{t('sections.preview-need')}</p> : null}
      {canRecords && !dependency && view.isError ? (
        <p className="text-sm text-muted-foreground">{t(`tableViews.errors.${readTableError(view.error).code ?? 'generic'}`, { defaultValue: t('tableViews.errors.generic') })}</p>
      ) : null}
      {draft && saved && parsed.ok ? (
        <>
          {mode === 'published' && workDiffers(parsed.work, saved) ? <p className="rounded-md border border-border bg-card p-3 text-sm" role="status">{t('tableViews.dirty')}</p> : null}
          {mode === 'published' ? (
            <>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" className="md:hidden" onClick={() => setFiltersOpen((open) => !open)}>{t('tableViews.filters')}</Button>
                <Button type="button" variant="outline" onClick={() => setSearch((current) => stampWork(current, { page: 1, pageSize: null, sort: null, filters: null }, saved, sectionId))}>{t('tableViews.reset')}</Button>
              </div>
              <div className={filtersOpen ? 'min-w-0 rounded-md border border-border p-3 md:block' : 'hidden min-w-0 rounded-md border border-border p-3 md:block'}>
                <ViewSettings catalog={catalog.data?.columns ?? []} draft={draft} onChange={setDraft} mode="query" />
                <Button type="button" className="mt-3" onClick={() => setSearch((current) => stampWork(current, {
                  page: 1,
                  pageSize: draft.pageSize,
                  sort: draft.sort,
                  filters: draft.filters,
                }, saved, sectionId))}>{t('tableViews.apply')}</Button>
              </div>
            </>
          ) : null}
          {rows.isError ? (
            <p className="text-sm text-muted-foreground">{rowError.issues[0]
              ? t(`tableViews.issues.${rowError.issues[0].code}`, { defaultValue: t('tableViews.errors.generic') })
              : t(`tableViews.errors.${rowError.code ?? 'generic'}`, { defaultValue: t('tableViews.errors.generic') })}</p>
          ) : null}
          {accepted && accepted.total === 0 ? <p className="text-sm text-muted-foreground">{effective && effective.filters.length > 0 ? t('tableViews.no-matches') : t('tableViews.no-records')}</p> : null}
          {accepted && accepted.total > 0 ? (
            <>
              <p className="text-sm text-muted-foreground">{t('tableViews.found', { count: accepted.total })}</p>
              <RecordTable columns={accepted.columns} rows={accepted.rows} recordHref={recordTo} />
              {mode === 'published' && effective ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant="outline" disabled={effective.page <= 1} onClick={() => setSearch((current) => stampWork(current, { ...parsed.work, page: effective.page - 1 }, saved, sectionId))}>{t('tableViews.previous')}</Button>
                  <span className="text-sm text-muted-foreground">{t('tableViews.page', { page: effective.page, pages })}</span>
                  <Button type="button" variant="outline" disabled={effective.page >= pages} onClick={() => setSearch((current) => stampWork(current, { ...parsed.work, page: effective.page + 1 }, saved, sectionId))}>{t('tableViews.next')}</Button>
                </div>
              ) : null}
            </>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
