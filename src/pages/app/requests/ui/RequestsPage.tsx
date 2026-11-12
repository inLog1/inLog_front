import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import {
  isRequestPriority,
  requestMatchesTab,
  requestTabs,
  useGetRequestsQuery,
  type RequestTab,
} from '../../../../entities/request'
import { selectSession } from '../../../../entities/session'
import { selectUser } from '../../../../entities/user/model/selectors'
import { WorkspaceStatus } from '../../../../features/org-project-selector'
import { useWorkspaceHref } from '../../../../features/org-project-selector/model/useEnsureOrgProjectParams'
import { useHasOrganizationGrant, useWorkspaceSection } from '../../../../features/org-project-selector/model/useWorkspaceSection'
import { routes } from '../../../../shared/lib/routes'
import { Button } from '../../../../shared/ui/button'
import { Card } from '../../../../shared/ui/card'
import { Input } from '../../../../shared/ui/input'
import { Label } from '../../../../shared/ui/label'
import { PageState, WorkPage } from '../../../../shared/ui/page'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../shared/ui/select'
import { TabButton } from '../../../../shared/ui/tab-button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../shared/ui/table'
import { formatRequestWhen, requestLabel, requestMatchesQuery } from '../model/display'
import {
  requestListFilterChoices,
  requestMatchesListFilters,
  requestPartyFilterValue,
  type FilterChoice,
  type RequestListFilterState,
} from '../model/list-filters'
import { RequestStatusBadge } from './RequestStatusBadge'
import { RequestsBoundary } from './RequestsBoundary'

type StatusFilter = RequestListFilterState['status']
type PriorityFilter = RequestListFilterState['priority']
type PartyFilter = RequestListFilterState['customerId']

export function RequestsPage() {
  return (
    <RequestsBoundary>
      <RequestsScreen />
    </RequestsBoundary>
  )
}

function RequestsScreen() {
  const section = useWorkspaceSection('organization', { resource: 'requests', action: 'read' })
  if (section.kind !== 'ready') {
    return (
      <WorkspaceStatus
        status={section.status}
        reason={section.reason}
        onRetry={section.refetch}
      />
    )
  }
  return <RequestsDesk key={section.organizationId} organizationId={section.organizationId} />
}

function RequestsDesk({ organizationId }: { organizationId: number }) {
  const { t, i18n } = useTranslation()
  const session = useSelector(selectSession)
  const account = useSelector(selectUser)
  const userId = session.subjectId ?? account?.id ?? null
  const navigate = useNavigate()
  const href = useWorkspaceHref()
  const canCreate = useHasOrganizationGrant('requests', 'create', organizationId)
  const canUpdate = useHasOrganizationGrant('requests', 'update', organizationId)
  const query = useGetRequestsQuery({ organizationId })
  const [tab, setTab] = useState<RequestTab>('all')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [priority, setPriority] = useState<PriorityFilter>('all')
  const [customerId, setCustomerId] = useState<PartyFilter>('all')
  const [executorId, setExecutorId] = useState<PartyFilter>('all')
  const data = query.currentData
  const dash = t('requests.dash')
  if (query.isError && !data) {
    return (
      <WorkPage>
        <PageState
          kind="error"
          description={t('requests.load-error')}
          action={<Button type="button" variant="outline" onClick={() => void query.refetch()}>{t('requests.retry')}</Button>}
        />
      </WorkPage>
    )
  }
  if (!data || (data.organizationKind !== 'customer' && data.organizationKind !== 'laboratory')) {
    return (
      <WorkPage>
        <PageState kind="loading" description={t('requests.loading')} />
      </WorkPage>
    )
  }

  const tabs = requestTabs(data.organizationKind)
  const activeTab = tabs.includes(tab) ? tab : 'all'
  const listFilter: RequestListFilterState = { status, priority, customerId, executorId }
  const scoped = data.requests
    .filter((item) => requestMatchesTab(item, activeTab, { organizationId, userId: userId ?? -1 }))
    .filter((item) => requestMatchesQuery(
      [item.number, item.title, item.customerShortName, item.executorShortName],
      search,
    ))
  const sources = scoped.map((item) => ({
    status: item.status,
    priority: item.details?.priority,
    customerOrganizationId: item.customerOrganizationId,
    customerShortName: item.customerShortName,
    executorOrganizationId: item.executorOrganizationId,
    executorShortName: item.executorShortName,
  }))
  const filterChoices = requestListFilterChoices(sources, listFilter, {
    all: t('requests.filter-all'),
    status: (item) => t(`requests.status.${item}`),
    priority: (item) => t(`requests.draft.priority-${item}`),
    priorityEmpty: t('requests.priority-empty'),
    unnamed: dash,
  })
  const rows = scoped
    .filter((_, index) => requestMatchesListFilters(sources[index], listFilter))
    .slice()
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || right.number.localeCompare(left.number))
  const openRow = (row: (typeof rows)[number]) => {
    if (row.status === 'draft' && canUpdate) {
      navigate(href(routes.requests.edit(row.id), 'organization'))
      return
    }
    navigate(href(routes.requests.detail(row.id), 'organization'))
  }
  const filtersActive = search.trim() !== '' || status !== 'all' || priority !== 'all' || customerId !== 'all' || executorId !== 'all'
  const resetFilters = () => {
    setSearch('')
    setStatus('all')
    setPriority('all')
    setCustomerId('all')
    setExecutorId('all')
  }
  const when = (value: string) => requestLabel(formatRequestWhen(value, i18n.language), dash)
  const priorityText = (value: string | undefined) => {
    if (!value?.trim() || !isRequestPriority(value)) return t('requests.priority-empty')
    return t(`requests.draft.priority-${value}`)
  }

  return (
    <WorkPage>
      <div className="flex flex-col gap-3 border-b border-border sm:flex-row sm:items-end sm:justify-between">
        <div className="flex gap-4 overflow-x-auto" role="tablist" aria-label={t('requests.tabs.label')}>
          {tabs.map((item) => (
            <TabButton key={item} active={activeTab === item} onClick={() => setTab(item)}>
              <span className="whitespace-nowrap">{t(`requests.tabs.${item}`)}</span>
            </TabButton>
          ))}
        </div>
        {canCreate ? (
          <div className="pb-2">
            <Button type="button" className="shrink-0" onClick={() => navigate(href(routes.requests.new(), 'organization'))}>
              <Plus className="h-4 w-4" aria-hidden />
              {t('requests.create')}
            </Button>
          </div>
        ) : null}
      </div>
      <Card className="min-w-0 overflow-hidden shadow-sm">
        <div className="flex flex-col gap-4 border-b border-border p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('requests.search')}
              aria-label={t('requests.search-label')}
              className="sm:max-w-xs"
            />
            <div className="flex items-center gap-3">
              {filtersActive ? (
                <Button type="button" variant="ghost" onClick={resetFilters}>
                  {t('requests.reset')}
                </Button>
              ) : null}
              <p className="text-sm text-muted-foreground">{t('requests.results', { count: rows.length })}</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <CountedFilter
              label={t('requests.status-filter')}
              value={status}
              options={filterChoices.status}
              onChange={(value) => setStatus(value as StatusFilter)}
            />
            <CountedFilter
              label={t('requests.priority-filter')}
              value={priority}
              options={filterChoices.priority}
              onChange={(value) => setPriority(value as PriorityFilter)}
            />
            <CountedFilter
              label={t('requests.customer-filter')}
              value={customerId === 'all' ? 'all' : String(customerId)}
              options={filterChoices.customer}
              onChange={(value) => setCustomerId(requestPartyFilterValue(value))}
            />
            <CountedFilter
              label={t('requests.executor-filter')}
              value={executorId === 'all' ? 'all' : String(executorId)}
              options={filterChoices.executor}
              onChange={(value) => setExecutorId(requestPartyFilterValue(value))}
            />
          </div>
        </div>
        {rows.length === 0 ? (
          <div className="p-4">
            <PageState kind="empty" description={filtersActive || activeTab !== 'all' ? t('requests.empty-filter') : t('requests.empty')} />
          </div>
        ) : (
          <Table className="min-w-[52rem]">
            <TableHeader>
              <TableRow>
                <TableHead className="px-4">{t('requests.columns.number')}</TableHead>
                <TableHead className="px-4">{t('requests.columns.title')}</TableHead>
                <TableHead className="px-4">{t('requests.columns.customer')}</TableHead>
                <TableHead className="px-4">{t('requests.columns.executor')}</TableHead>
                <TableHead className="px-4">{t('requests.columns.status')}</TableHead>
                <TableHead className="px-4">{t('requests.columns.priority')}</TableHead>
                <TableHead className="px-4">{t('requests.columns.created')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow
                  key={row.id}
                  tabIndex={0}
                  className="cursor-pointer"
                  aria-label={t('requests.open-row', { number: row.number })}
                  onClick={() => openRow(row)}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return
                    event.preventDefault()
                    openRow(row)
                  }}
                >
                  <TableCell className="px-4 whitespace-nowrap">
                    <button
                      type="button"
                      className="font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={(event) => {
                        event.stopPropagation()
                        openRow(row)
                      }}
                    >
                      {row.number}
                    </button>
                  </TableCell>
                  <TableCell className="px-4 max-w-xs truncate">{requestLabel(row.title, dash)}</TableCell>
                  <TableCell className="px-4">{requestLabel(row.customerShortName, dash)}</TableCell>
                  <TableCell className="px-4">{requestLabel(row.executorShortName, dash)}</TableCell>
                  <TableCell className="px-4"><RequestStatusBadge status={row.status} /></TableCell>
                  <TableCell className="px-4 text-muted-foreground">{priorityText(row.details?.priority)}</TableCell>
                  <TableCell className="px-4 whitespace-nowrap text-muted-foreground">{when(row.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
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
  options: FilterChoice[]
  onChange: (value: string) => void
}) {
  const id = useId()
  const { t } = useTranslation()
  const counted = (option: FilterChoice) => t('requests.filter-counted', { label: option.label, count: option.count })
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
              {counted(option)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
