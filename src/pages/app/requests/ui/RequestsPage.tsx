import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import {
  REQUEST_STATUSES,
  requestMatchesTab,
  requestRegistryStats,
  requestTabs,
  useGetRequestsQuery,
  type RequestStatus,
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
import { PageHeader, PageState, WorkPage } from '../../../../shared/ui/page'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../shared/ui/select'
import { TabButton } from '../../../../shared/ui/tab-button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../shared/ui/table'
import { formatRequestWhen, requestLabel, requestMatchesQuery } from '../model/display'
import { RequestStatusBadge } from './RequestStatusBadge'
import { RequestsBoundary } from './RequestsBoundary'

type StatusFilter = 'all' | RequestStatus

const STATS = ['total', 'fresh', 'inProgress', 'closed', 'overdue'] as const

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
  const data = query.currentData
  const dash = t('requests.dash')
  if (query.isError && !data) {
    return (
      <WorkPage>
        <PageHeader title={t('requests.page-title')} description={t('requests.page-lead')} />
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
        <PageHeader title={t('requests.page-title')} description={t('requests.page-lead')} />
        <PageState kind="loading" description={t('requests.loading')} />
      </WorkPage>
    )
  }

  const tabs = requestTabs(data.organizationKind)
  const activeTab = tabs.includes(tab) ? tab : 'all'
  const stats = requestRegistryStats(data.requests)
  const statValue = {
    total: stats.total,
    fresh: stats.fresh,
    inProgress: stats.inProgress,
    closed: stats.closed,
    overdue: stats.overdue,
  }
  const rows = data.requests
    .filter((item) => requestMatchesTab(item, activeTab, { organizationId, userId: userId ?? -1 }))
    .filter((item) => status === 'all' || item.status === status)
    .filter((item) => requestMatchesQuery(
      [item.number, item.title, item.customerShortName, item.executorShortName],
      search,
    ))
    .slice()
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || right.number.localeCompare(left.number))
  const openRow = (row: (typeof rows)[number]) => {
    if (row.status === 'draft' && canUpdate) {
      navigate(href(routes.requests.edit(row.id), 'organization'))
      return
    }
    navigate(href(routes.requests.detail(row.id), 'organization'))
  }
  const filtersActive = search.trim() !== '' || status !== 'all'
  const when = (value: string) => requestLabel(formatRequestWhen(value, i18n.language), dash)

  return (
    <WorkPage>
      <PageHeader
        title={t('requests.page-title')}
        description={t('requests.page-lead')}
        actions={canCreate ? (
          <Button type="button" onClick={() => navigate(href(routes.requests.new(), 'organization'))}>
            <Plus aria-hidden />
            {t('requests.create')}
          </Button>
        ) : undefined}
      />
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5" aria-label={t('requests.stats.label')}>
        {STATS.map((key) => (
          <Card key={key} className="shadow-sm">
            <div className="p-4">
              <p className="text-xs font-medium text-muted-foreground">{t(`requests.stats.${key === 'fresh' ? 'new' : key}`)}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-foreground">{statValue[key]}</p>
            </div>
          </Card>
        ))}
      </section>
      <div className="flex gap-4 overflow-x-auto border-b border-border" role="tablist" aria-label={t('requests.tabs.label')}>
        {tabs.map((item) => (
          <TabButton key={item} active={activeTab === item} onClick={() => setTab(item)}>
            <span className="whitespace-nowrap">{t(`requests.tabs.${item}`)}</span>
          </TabButton>
        ))}
      </div>
      <Card className="min-w-0 overflow-hidden shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('requests.search')}
              aria-label={t('requests.search-label')}
              className="sm:max-w-xs"
            />
            <Select value={status} onValueChange={(value) => setStatus(value as StatusFilter)}>
              <SelectTrigger className="w-full sm:w-52" aria-label={t('requests.status-filter')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('requests.status-all')}</SelectItem>
                {REQUEST_STATUSES.map((item) => (
                  <SelectItem key={item} value={item}>{t(`requests.status.${item}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {filtersActive ? (
              <Button type="button" variant="ghost" onClick={() => { setSearch(''); setStatus('all') }}>
                {t('requests.reset')}
              </Button>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">{t('requests.results', { count: rows.length })}</p>
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
                <TableHead className="px-4">{t('requests.columns.created')}</TableHead>
                <TableHead className="px-4">{t('requests.columns.customer')}</TableHead>
                <TableHead className="px-4">{t('requests.columns.executor')}</TableHead>
                <TableHead className="px-4">{t('requests.columns.title')}</TableHead>
                <TableHead className="px-4">{t('requests.columns.status')}</TableHead>
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
                  <TableCell className="px-4 whitespace-nowrap text-muted-foreground">{when(row.createdAt)}</TableCell>
                  <TableCell className="px-4">{requestLabel(row.customerShortName, dash)}</TableCell>
                  <TableCell className="px-4">{requestLabel(row.executorShortName, dash)}</TableCell>
                  <TableCell className="px-4 max-w-xs truncate">{requestLabel(row.title, dash)}</TableCell>
                  <TableCell className="px-4"><RequestStatusBadge status={row.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </WorkPage>
  )
}
