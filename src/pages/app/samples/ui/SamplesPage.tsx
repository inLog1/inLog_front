import { useId, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, Plus, Search, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import {
  ALL_SAMPLE_INSPECTIONS,
  ALL_SAMPLE_STAGES,
  ALL_SAMPLE_TYPES,
  SAMPLE_ROOT_PAGE_SIZES,
  SAMPLE_STAGES,
  useGetSamplesQuery,
  type SampleRootPageSize,
} from '../../../../entities/sample'
import { organizationOptionLabel } from '../../../../features/org-project-selector/model/request-organizations'
import { useRequestOrganizations } from '../../../../features/org-project-selector/model/useRequestOrganizations'
import { WorkspaceStatus } from '../../../../features/org-project-selector'
import { useWorkspaceHref } from '../../../../features/org-project-selector/model/useEnsureOrgProjectParams'
import { useHasOrganizationGrant, useWorkspaceSection } from '../../../../features/org-project-selector/model/useWorkspaceSection'
import { routes } from '../../../../shared/lib/routes'
import { Button } from '../../../../shared/ui/button'
import { Card } from '../../../../shared/ui/card'
import { Input } from '../../../../shared/ui/input'
import { Label } from '../../../../shared/ui/label'
import { PageHeader, PageState, WorkPage } from '../../../../shared/ui/page'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../shared/ui/select'
import { sampleQueryStatus } from '../model/display'
import {
  emptyRegistryFilters,
  facetOptions,
  inspectionFilterValues,
  isSampleRootPageSize,
  registryFiltersActive,
  registryPage,
  stageFilterValues,
  typeFilterValues,
  type RegistryFilters,
} from '../model/registry-view'
import { SAMPLE_INSPECTION_MESSAGE_KEY, SAMPLE_STAGE_MESSAGE_KEY, sampleTypeMessageKey } from '../model/labels'
import { SamplesBoundary } from './SamplesBoundary'
import { SampleTable } from './SampleTable'

export function SamplesPage() {
  return (
    <SamplesBoundary>
      <SamplesScreen />
    </SamplesBoundary>
  )
}

function SamplesScreen() {
  const section = useWorkspaceSection('organization', { resource: 'requests', action: 'read' })
  if (section.kind !== 'ready') {
    return <WorkspaceStatus status={section.status} reason={section.reason} onRetry={section.refetch} />
  }
  return <SamplesDesk key={section.organizationId} organizationId={section.organizationId} />
}

function SamplesDesk({ organizationId }: { organizationId: number }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const href = useWorkspaceHref()
  const organizations = useRequestOrganizations()
  const canCreate = useHasOrganizationGrant('requests', 'create', organizationId)
  const query = useGetSamplesQuery({ organizationId })
  const [filters, setFilters] = useState<RegistryFilters>(emptyRegistryFilters)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<SampleRootPageSize>(SAMPLE_ROOT_PAGE_SIZES[0])
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())
  const data = query.currentData
  const samples = useMemo(() => (data?.samples ?? []).filter((item) => !item.deletedAt), [data])
  const view = useMemo(
    () => registryPage(samples, filters, page, pageSize, expanded, collapsed),
    [collapsed, expanded, filters, page, pageSize, samples],
  )
  const active = registryFiltersActive(filters)
  const organizationName = organizations.selected ? organizationOptionLabel(organizations.selected) : ''
  const openSample = (sampleId: string) => navigate(href(routes.samples.detail(sampleId), 'organization'))
  const hrefFor = (sampleId: string) => href(routes.samples.detail(sampleId), 'organization')

  function updateFilters(patch: Partial<RegistryFilters>) {
    setFilters((current) => ({ ...current, ...patch }))
    setPage(1)
    setExpanded(new Set())
    setCollapsed(new Set())
  }

  function resetFilters() {
    setFilters(emptyRegistryFilters())
    setPage(1)
    setExpanded(new Set())
    setCollapsed(new Set())
  }

  function toggleTree(sampleId: string, isOpen: boolean) {
    setExpanded((previous) => {
      const next = new Set(previous)
      if (isOpen) next.delete(sampleId)
      else next.add(sampleId)
      return next
    })
    setCollapsed((previous) => {
      const next = new Set(previous)
      if (isOpen) next.add(sampleId)
      else next.delete(sampleId)
      return next
    })
  }

  const status = sampleQueryStatus(query.error)
  if (status === 403) {
    return (
      <WorkPage width="form">
        <h1 className="text-lg font-semibold">{t('samples.forbidden-title')}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t('samples.forbidden')}</p>
      </WorkPage>
    )
  }
  if (query.isError && !data) {
    return (
      <WorkPage>
        <PageHeader title={t('samples.page-title')} description={t('samples.page-lead')} />
        <PageState
          kind="error"
          description={t('samples.load-error')}
          action={<Button type="button" variant="outline" onClick={() => void query.refetch()}>{t('samples.retry')}</Button>}
        />
      </WorkPage>
    )
  }
  if (!data) {
    return (
      <WorkPage>
        <PageHeader title={t('samples.page-title')} description={t('samples.page-lead')} />
        <PageState kind="loading" description={t('samples.loading')} />
      </WorkPage>
    )
  }

  const typeOptions = facetOptions(view.counts.sampleType, typeFilterValues()).map((option) => ({
    ...option,
    label: option.value === ALL_SAMPLE_TYPES ? t('samples.filter.all') : messageLabel(t, sampleTypeMessageKey(option.value), option.value),
  }))
  const stageOptions = facetOptions(view.counts.stage, stageFilterValues(samples)).map((option) => ({
    ...option,
    label: stageOptionLabel(t, option.value),
  }))
  const inspectionOptions = facetOptions(view.counts.inspection, inspectionFilterValues()).map((option) => ({
    ...option,
    label: option.value === ALL_SAMPLE_INSPECTIONS ? t('samples.filter.all') : messageLabel(t, SAMPLE_INSPECTION_MESSAGE_KEY[option.value], option.value),
  }))

  return (
    <WorkPage>
      <PageHeader
        title={t('samples.page-title')}
        description={(
          <span className="block">
            <span className="block">{t('samples.page-lead')}</span>
            {organizationName ? <span className="mt-1 block">{t('samples.organization', { name: organizationName })}</span> : null}
          </span>
        )}
        actions={canCreate ? (
          <Button type="button" onClick={() => navigate(href(routes.samples.register(), 'organization'))}>
            <Plus aria-hidden />
            {t('samples.register')}
          </Button>
        ) : undefined}
      />
      <Card className="min-w-0 overflow-hidden shadow-sm">
        <div className="border-b border-border p-4">
          <div className="grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="relative min-w-0">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
              <Input
                className="bg-card pl-9"
                aria-label={t('samples.search-label')}
                placeholder={t('samples.search')}
                value={filters.search}
                onChange={(event) => updateFilters({ search: event.target.value })}
              />
            </div>
            <CountedFilter label={t('samples.filter.type')} value={filters.sampleType} options={typeOptions} onChange={(value) => updateFilters({ sampleType: value })} />
            <CountedFilter label={t('samples.filter.stage')} value={filters.stage} options={stageOptions} onChange={(value) => updateFilters({ stage: value })} />
            <CountedFilter label={t('samples.filter.inspection')} value={filters.inspection} options={inspectionOptions} onChange={(value) => updateFilters({ inspection: value })} />
          </div>
          {active ? (
            <div className="mt-2 flex justify-end">
              <Button type="button" variant="ghost" size="sm" onClick={resetFilters}>
                <X aria-hidden />
                {t('samples.reset')}
              </Button>
            </div>
          ) : null}
        </div>
        {view.filteredCount === 0 ? (
          <div className="p-4">
            <PageState
              kind="empty"
              title={active ? t('samples.empty-filter-title') : t('samples.empty-title')}
              description={active ? t('samples.empty-filter') : t('samples.empty')}
              action={active ? <Button type="button" variant="outline" size="sm" onClick={resetFilters}>{t('samples.reset')}</Button> : undefined}
            />
          </div>
        ) : (
          <SampleTable rows={view.rows} samples={samples} hrefFor={hrefFor} onOpen={openSample} onToggle={toggleTree} />
        )}
        {view.rootCount > 0 ? (
          <div className="flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span id="samples-page-size-label">{t('samples.page-size')}</span>
              <Select
                value={String(pageSize)}
                onValueChange={(value) => {
                  const next = Number(value)
                  if (!isSampleRootPageSize(next)) return
                  setPageSize(next)
                  setPage(1)
                }}
              >
                <SelectTrigger className="h-8 w-[4.5rem]" aria-labelledby="samples-page-size-label">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SAMPLE_ROOT_PAGE_SIZES.map((size) => <SelectItem key={size} value={String(size)}>{size}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" disabled={view.page <= 1} aria-label={t('samples.previous')} onClick={() => setPage(view.page - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm tabular-nums text-muted-foreground">{t('samples.page-status', { page: view.page, pages: view.pages })}</span>
              <Button type="button" variant="outline" size="sm" disabled={view.page >= view.pages} aria-label={t('samples.next')} onClick={() => setPage(view.page + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : null}
      </Card>
    </WorkPage>
  )
}

function CountedFilter({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: { value: string; label: string; count: number }[]
  onChange: (value: string) => void
}) {
  const id = useId()
  const { t } = useTranslation()
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={id} className="text-xs font-normal text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-full bg-card">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              className="pr-2 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground focus:data-[state=checked]:bg-primary focus:data-[state=checked]:text-primary-foreground [&>span:first-child]:hidden"
            >
              {t('samples.filter-counted', { label: option.label, total: option.count })}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function messageLabel(t: (key: string) => string, key: string | null | undefined, fallback: string): string {
  return key ? t(key) : fallback
}

function stageOptionLabel(t: (key: string, options?: { label: string }) => string, value: string): string {
  if (value === ALL_SAMPLE_STAGES) return t('samples.filter.all')
  const key = SAMPLE_STAGE_MESSAGE_KEY[value]
  const label = key ? t(key) : value
  if (value === 'Не указан' || (SAMPLE_STAGES as readonly string[]).includes(value)) return label
  return t('samples.stage.legacy', { label })
}
