import { useMemo, useState, type ReactNode } from 'react'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import {
  AlertTriangle,
  Download,
  GraduationCap,
  MoreHorizontal,
  Search,
  Settings,
  ShieldCheck,
  UserRound,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  COLUMN_FIO,
  COLUMN_STATE,
  avatarIndex,
  certificationTone,
  csvDocument,
  daysUntil,
  matchesQuery,
  matchesStatus,
  personInitials,
  personnelError,
  qualificationTone,
  registryMetrics,
  systemColumnVisible,
  useArchiveEmployeeMutation,
  type DirectoryOptions,
  type EmployeeListResponse,
  type PersonnelField,
  type PersonnelPermissions,
  type RegistryStatusFilter,
} from '../../../entities/personnel'
import { cn } from '../../../shared/lib/utils'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../shared/ui/alert-dialog'
import { Button } from '../../../shared/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../shared/ui/dropdown-menu'
import { Input } from '../../../shared/ui/input'
import { PageState } from '../../../shared/ui/page'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../shared/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../shared/ui/table'

const PAGE_SIZES = [10, 20, 50]
const AVATAR_CLASS = [
  'bg-emerald-100 text-emerald-800',
  'bg-sky-100 text-sky-800',
  'bg-violet-100 text-violet-800',
  'bg-amber-100 text-amber-900',
  'bg-rose-100 text-rose-800',
]
const TONE_CLASS = {
  current: 'bg-emerald-100 text-emerald-800',
  soon: 'bg-amber-100 text-amber-900',
  overdue: 'bg-red-100 text-red-800',
}
const DATE_CLASS = {
  empty: 'text-muted-foreground',
  current: 'text-emerald-700',
  soon: 'text-amber-700',
  overdue: 'text-red-700',
}

type ListRow = EmployeeListResponse['employees'][number]
type SortKey = 'name' | 'position' | 'department' | 'qualification' | 'certification' | `cell:${string}`
type PendingArchive = { id: string; revision: number; name: string; archived: boolean }

export function PersonnelRegistry({
  organizationId,
  rows,
  metricRows,
  fields,
  columns,
  options,
  permissions,
  archived,
  onArchivedChange,
  onOpen,
  onCreate,
  onOpenSettings,
}: {
  organizationId: number
  rows: ListRow[]
  metricRows: ListRow[]
  fields: PersonnelField[]
  columns: string[]
  options: Record<string, DirectoryOptions> | undefined
  permissions: PersonnelPermissions
  archived: boolean
  onArchivedChange: (archived: boolean) => void
  onOpen: (employeeId: string) => void
  onCreate: () => void
  onOpenSettings: () => void
}) {
  const { t } = useTranslation()
  const today = useMemo(() => new Date(), [])
  const [query, setQuery] = useState('')
  const [departmentId, setDepartmentId] = useState('all')
  const [positionId, setPositionId] = useState('all')
  const [status, setStatus] = useState<RegistryStatusFilter>('all')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [pending, setPending] = useState<PendingArchive | null>(null)
  const [archiveEmployee, archiveState] = useArchiveEmployeeMutation()
  const metrics = registryMetrics(metricRows.map((row) => ({
    archived: row.archived,
    certificationUntil: row.summary?.certificationUntil ?? '',
  })), today)
  const departmentChoices = choices(options?.departments?.records, rows.map((row) => ({
    id: row.summary?.departmentId ?? '',
    label: row.summary?.department ?? '',
  })))
  const positionChoices = choices(options?.positions?.records, rows.map((row) => ({
    id: row.summary?.positionId ?? '',
    label: row.summary?.position ?? '',
  })))
  const filtered = rows.filter((row) => {
    const summary = row.summary
    if (!summary) return false
    if (!matchesQuery(summary, query)) return false
    if (departmentId !== 'all' && summary.departmentId !== departmentId) return false
    if (positionId !== 'all' && summary.positionId !== positionId) return false
    return matchesStatus(summary, status, today)
  }).sort((left, right) => compareRows(left, right, sortKey, sortDirection))
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, pageCount)
  const visible = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)
  const tableColumns = registryColumns(t, fields, columns, organizationId, today)
  const dash = t('personnel.dash')

  const sortBy = (key: SortKey) => {
    setPage(1)
    if (sortKey === key) {
      setSortDirection((direction) => direction === 'asc' ? 'desc' : 'asc')
      return
    }
    setSortKey(key)
    setSortDirection('asc')
  }

  const exportCsv = () => {
    const header = tableColumns.map((column) => column.label)
    const body = filtered.map((row) => tableColumns.map((column) => column.text(row)))
    const blob = new Blob([`\uFEFF${csvDocument(header, body)}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'personnel.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  const confirmArchive = async () => {
    if (!pending) return
    try {
      await archiveEmployee({
        employeeId: pending.id,
        organizationId,
        expectedRevision: pending.revision,
        archived: !pending.archived,
      }).unwrap()
      toast.success(t(pending.archived ? 'personnel.restored' : 'corporation.removed'))
      setPending(null)
    } catch (caught) {
      toast.error(t(`personnel.errors.${personnelError(caught).code}`, { defaultValue: t('personnel.errors.generic') }))
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard icon={<Users className="h-5 w-5" />} tone="emerald" value={String(metrics.total)} label={t('personnel.metrics.total')} />
        <MetricCard icon={<ShieldCheck className="h-5 w-5" />} tone="emerald" value={t('personnel.metrics.no-data')} label={t('personnel.metrics.admitted')} muted />
        <MetricCard icon={<GraduationCap className="h-5 w-5" />} tone="amber" value={t('personnel.metrics.no-data')} label={t('personnel.metrics.training')} muted />
        <MetricCard
          icon={<AlertTriangle className="h-5 w-5" />}
          tone="red"
          value={String(metrics.overdueCertifications)}
          label={t('personnel.metrics.overdue')}
          hint={t('personnel.metrics.overdue-hint')}
        />
        <MetricCard icon={<UserRound className="h-5 w-5" />} tone="slate" value={t('personnel.metrics.no-data')} label={t('personnel.metrics.without-permit')} muted />
      </div>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {permissions.create ? (
            <Button type="button" onClick={onCreate}>{t('personnel.add')}</Button>
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline">
                {t('personnel.export')}
                <Download className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onSelect={exportCsv}>{t('personnel.export-csv')}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button type="button" variant={archived ? 'default' : 'outline'} onClick={() => { setPage(1); onArchivedChange(!archived) }}>
            {archived ? t('personnel.show-active') : t('personnel.show-archived')}
          </Button>
        </div>
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
          <div className="relative min-w-[220px] flex-1 xl:max-w-sm">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => { setQuery(event.target.value); setPage(1) }}
              placeholder={t('personnel.search')}
              aria-label={t('personnel.search')}
              className="pl-8"
            />
          </div>
          <FilterSelect
            label={t('personnel.filter-department')}
            value={departmentId}
            allLabel={t('personnel.filter-all-departments')}
            options={departmentChoices}
            onChange={(value) => { setDepartmentId(value); setPage(1) }}
          />
          <FilterSelect
            label={t('personnel.filter-status')}
            value={status}
            allLabel={t('personnel.filter-all-statuses')}
            options={[
              { id: 'confirmed', label: t('personnel.status-confirmed') },
              { id: 'needs-confirmation', label: t('personnel.status-needs') },
              { id: 'soon', label: t('personnel.status-soon') },
              { id: 'overdue', label: t('personnel.status-overdue') },
              { id: 'empty', label: t('personnel.status-empty') },
            ]}
            onChange={(value) => { setStatus(value as RegistryStatusFilter); setPage(1) }}
          />
          <FilterSelect
            label={t('personnel.filter-position')}
            value={positionId}
            allLabel={t('personnel.filter-all-positions')}
            options={positionChoices}
            onChange={(value) => { setPositionId(value); setPage(1) }}
          />
          {permissions.structure ? (
            <Button type="button" variant="outline" size="icon" aria-label={t('personnel.settings-gear')} onClick={onOpenSettings}>
              <Settings className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </div>

      {rows.length === 0 ? (
        <PageState kind="empty" title={t('personnel.empty-title')} description={t('personnel.empty')} />
      ) : filtered.length === 0 ? (
        <PageState kind="empty" title={t('personnel.no-match')} description={t('personnel.search')} />
      ) : (
        <div className="min-w-0 overflow-x-auto rounded-xl border border-border bg-card">
          <Table className="min-w-[1080px]">
            <TableHeader>
              <TableRow>
                {tableColumns.map((column) => (
                  <TableHead key={column.id}>
                    {column.sortKey ? (
                      <button type="button" className="inline-flex items-center gap-1" onClick={() => sortBy(column.sortKey as SortKey)}>
                        {column.label}
                        {sortKey === column.sortKey ? (sortDirection === 'asc' ? ' ↑' : ' ↓') : ''}
                      </button>
                    ) : column.label}
                  </TableHead>
                ))}
                <TableHead className="w-12 text-right">{t('personnel.table.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((row) => {
                const summary = row.summary
                const name = summary?.name || dash
                return (
                  <TableRow key={row.id} className="cursor-pointer" onClick={() => onOpen(row.id)}>
                    {tableColumns.map((column) => <TableCell key={column.id}>{column.render(row)}</TableCell>)}
                    <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button type="button" variant="ghost" size="icon" aria-label={t('personnel.row-actions', { name })}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => onOpen(row.id)}>{t('personnel.open-card')}</DropdownMenuItem>
                          {permissions.update ? (
                            <DropdownMenuItem onSelect={() => onOpen(row.id)}>{t('personnel.edit')}</DropdownMenuItem>
                          ) : null}
                          {permissions.archive ? (
                            <DropdownMenuItem onSelect={() => setPending({
                              id: row.id,
                              revision: row.revision,
                              name,
                              archived: row.archived,
                            })}
                            >
                              {row.archived ? t('directories.restore') : t('personnel.archive-action')}
                            </DropdownMenuItem>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {filtered.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>{t('personnel.page-size')}</span>
            <Select value={String(pageSize)} onValueChange={(value) => { setPageSize(Number(value)); setPage(1) }}>
              <SelectTrigger className="h-8 w-[76px]" aria-label={t('personnel.page-size')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map((size) => <SelectItem key={size} value={String(size)}>{size}</SelectItem>)}
              </SelectContent>
            </Select>
            <span>{t('personnel.records', { count: filtered.length })}</span>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {Array.from({ length: pageCount }, (_, index) => index + 1).slice(0, 8).map((number) => (
              <Button
                key={number}
                type="button"
                size="sm"
                variant={number === safePage ? 'default' : 'outline'}
                className="h-8 min-w-8 px-2"
                onClick={() => setPage(number)}
              >
                {number}
              </Button>
            ))}
          </div>
        </div>
      ) : null}

      <AlertDialog open={pending != null} onOpenChange={(open) => { if (!open) setPending(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t(pending?.archived ? 'personnel.restore-title' : 'personnel.archive-title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {pending ? `${pending.name}. ` : ''}
              {t(pending?.archived ? 'personnel.restore-body' : 'personnel.archive-body')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">{t('directories.cancel')}</AlertDialogCancel>
            <Button type="button" disabled={archiveState.isLoading} onClick={() => void confirmArchive()}>
              {pending?.archived ? t('directories.restore') : t('personnel.archive-action')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function MetricCard({
  icon,
  tone,
  value,
  label,
  hint,
  muted = false,
}: {
  icon: ReactNode
  tone: 'emerald' | 'amber' | 'red' | 'slate'
  value: string
  label: string
  hint?: string
  muted?: boolean
}) {
  const well = {
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
    slate: 'bg-muted text-muted-foreground',
  }[tone]
  return (
    <article className="flex min-w-0 items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
      <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', well)}>{icon}</span>
      <div className="min-w-0">
        <p className={cn('truncate font-semibold', muted ? 'text-sm text-muted-foreground' : 'text-xl')}>{value}</p>
        <p className="truncate text-xs text-muted-foreground">{label}</p>
        {hint ? <p className="truncate text-xs text-muted-foreground">{hint}</p> : null}
      </div>
    </article>
  )
}

function FilterSelect({
  label,
  value,
  allLabel,
  options,
  onChange,
}: {
  label: string
  value: string
  allLabel: string
  options: { id: string; label: string }[]
  onChange: (value: string) => void
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[180px]" aria-label={label}>
        <SelectValue placeholder={allLabel} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{allLabel}</SelectItem>
        {options.map((option) => <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>)}
      </SelectContent>
    </Select>
  )
}

function choices(
  records: { id: string; label: string; archived: boolean }[] | undefined,
  fromRows: { id: string; label: string }[],
): { id: string; label: string }[] {
  const source = (records ?? []).filter((item) => !item.archived && item.label.trim())
  if (source.length > 0) return source.map((item) => ({ id: item.id, label: item.label }))
  const seen = new Set<string>()
  return fromRows.flatMap((item) => {
    if (!item.id || !item.label.trim() || seen.has(item.id)) return []
    seen.add(item.id)
    return [{ id: item.id, label: item.label }]
  })
}

function compareRows(left: ListRow, right: ListRow, key: SortKey, direction: 'asc' | 'desc'): number {
  const sign = direction === 'asc' ? 1 : -1
  const read = (row: ListRow) => {
    if (key === 'name') return row.summary?.name ?? ''
    if (key === 'position') return row.summary?.position ?? ''
    if (key === 'department') return row.summary?.department ?? ''
    if (key === 'qualification') return row.summary?.qualification ?? ''
    if (key === 'certification') return row.summary?.certificationUntil ?? ''
    if (key.startsWith('cell:')) return row.cells[key.slice(5)] ?? ''
    return ''
  }
  return read(left).localeCompare(read(right), 'ru', { numeric: true }) * sign
}

type RegistryColumn = {
  id: string
  label: string
  sortKey?: SortKey
  render: (row: ListRow) => ReactNode
  text: (row: ListRow) => string
}

function registryColumns(
  t: TFunction,
  fields: PersonnelField[],
  columns: string[],
  organizationId: number,
  today: Date,
): RegistryColumn[] {
  const dash = t('personnel.dash')
  const fieldByKey = (key: string) => fields.find((field) => field.key === key)
  const visibleValue = (key: string, value: string) => {
    const field = fieldByKey(key)
    if (field && (!field.visible || field.archived)) return ''
    return value.trim()
  }
  const result: RegistryColumn[] = [{
    id: 'employee',
    label: t('personnel.table.employee'),
    sortKey: 'name',
    text: (row) => [row.summary?.name, visibleValue('email', row.summary?.email ?? ''), visibleValue('personnel-number', row.summary?.personnelNumber ?? '')].filter(Boolean).join(' '),
    render: (row) => {
      const name = row.summary?.name?.trim() || dash
      const email = visibleValue('email', row.summary?.email ?? '')
      const number = visibleValue('personnel-number', row.summary?.personnelNumber ?? '')
      const initials = personInitials(name === dash ? '' : name)
      return (
        <div className="flex min-w-[220px] items-center gap-3">
          <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold', AVATAR_CLASS[avatarIndex(name)])}>
            {initials || dash}
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">
              {name}
              {row.archived ? <span className="ml-2 text-xs font-normal text-muted-foreground">{t('directories.archived')}</span> : null}
            </p>
            <p className="truncate text-xs text-muted-foreground">{email || dash}</p>
            <p className="truncate text-xs text-muted-foreground">{number ? t('personnel.personnel-number-short', { value: number }) : dash}</p>
          </div>
        </div>
      )
    },
  }]
  const system: Array<{ key: string; id: string; label: string; sortKey: SortKey }> = [
    { key: 'position', id: 'position', label: t('personnel.table.position'), sortKey: 'position' },
    { key: 'department', id: 'department', label: t('personnel.table.department'), sortKey: 'department' },
  ]
  for (const column of system) {
    if (!systemColumnVisible(columns, organizationId, fieldByKey(column.key))) continue
    result.push({
      id: column.id,
      label: column.label,
      sortKey: column.sortKey,
      text: (row) => visibleValue(column.key, row.summary?.[column.key === 'position' ? 'position' : 'department'] ?? '') || dash,
      render: (row) => textOrDash(visibleValue(column.key, row.summary?.[column.key === 'position' ? 'position' : 'department'] ?? ''), dash),
    })
  }
  if (systemColumnVisible(columns, organizationId, fieldByKey('qualification-status'))) {
    result.push({
      id: 'qualification',
      label: t('personnel.table.qualification'),
      sortKey: 'qualification',
      text: (row) => visibleValue('qualification-status', row.summary?.qualification ?? '') || dash,
      render: (row) => {
        const label = visibleValue('qualification-status', row.summary?.qualification ?? '')
        if (!label) return dash
        const tone = qualificationTone(row.summary?.qualificationId ?? '', row.summary?.certificationUntil ?? '', today)
        if (tone === 'neutral') return <span className="text-muted-foreground">{label}</span>
        return <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', TONE_CLASS[tone])}>{label}</span>
      },
    })
  }
  if (systemColumnVisible(columns, organizationId, fieldByKey('certification-until'))) {
    result.push({
      id: 'certification',
      label: t('personnel.table.certification'),
      sortKey: 'certification',
      text: (row) => certificationText(t, visibleValue('certification-until', row.summary?.certificationUntil ?? ''), today, dash),
      render: (row) => {
        const value = visibleValue('certification-until', row.summary?.certificationUntil ?? '')
        const tone = certificationTone(value, today)
        return <span className={DATE_CLASS[tone]}>{certificationText(t, value, today, dash)}</span>
      },
    })
  }
  result.push(
    {
      id: 'permits',
      label: t('personnel.table.permits'),
      text: () => dash,
      render: () => <span className="text-muted-foreground" title={t('personnel.column-unavailable')}>{dash}</span>,
    },
    {
      id: 'training',
      label: t('personnel.table.training'),
      text: () => dash,
      render: () => <span className="text-muted-foreground" title={t('personnel.column-unavailable')}>{dash}</span>,
    },
  )
  const absorbed = new Set(['email', 'personnel-number', 'position', 'department', 'qualification-status', 'certification-until'])
  for (const columnId of columns) {
    if (columnId === COLUMN_FIO || columnId === COLUMN_STATE) continue
    const field = fields.find((item) => item.id === columnId)
    if (!field || !field.visible || field.archived || absorbed.has(field.key)) continue
    result.push({
      id: columnId,
      label: field.label,
      sortKey: `cell:${columnId}`,
      text: (row) => row.cells[columnId] || dash,
      render: (row) => {
        const value = row.cells[columnId] || ''
        const mark = row.marks[columnId]
        return `${value || dash}${mark === 'archived' ? ` (${t('directories.archived')})` : ''}${mark === 'missing' ? ` (${t('personnel.missing-value')})` : ''}`
      },
    })
  }
  return result
}

function textOrDash(value: string, dash: string) {
  return value.trim() || dash
}

function certificationText(
  t: TFunction,
  value: string,
  today: Date,
  dash: string,
): string {
  const days = daysUntil(value, today)
  if (!value || days == null) return dash
  return `${value} (${t('personnel.days', { count: days })})`
}
