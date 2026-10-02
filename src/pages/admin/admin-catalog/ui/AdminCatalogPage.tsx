import { Loader2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  useGetAdminResourcesQuery,
  useGetAdminTableRowsQuery,
} from '../../../../entities/platform-admin/model/platformAdminSlice'
import type { AdminResource } from '../../../../entities/platform-admin/model/types'
import { ADMIN_PAGE_SIZE } from '../../../../features/platform-admin/lib/format'
import { AdminPagination } from '../../../../features/platform-admin/ui/AdminPagination'
import { AdminSearchBar } from '../../../../features/platform-admin/ui/AdminSearchBar'
import { cn } from '../../../../shared/lib/utils'
import { Badge } from '../../../../shared/ui/badge'
import { Input } from '../../../../shared/ui/input'
import { Switch } from '../../../../shared/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../../shared/ui/table'

function columnFields(resource: AdminResource) {
  return resource.fields.filter((field) => !field.write_only)
}

function CatalogCell({ value }: { value: unknown }) {
  const { t } = useTranslation()
  const text = formatCell(
    value,
    t('admin-page.users-table.yes'),
    t('admin-page.users-table.no'),
  )

  return (
    <TableCell className="max-w-[240px] truncate whitespace-nowrap text-card-foreground" title={text}>
      {text}
    </TableCell>
  )
}

function formatCell(value: unknown, yes: string, no: string) {
  if (value == null || value === '') return '—'
  if (typeof value === 'boolean') return value ? yes : no
  if (Array.isArray(value)) {
    return value
      .map((item) => (item != null && typeof item === 'object' ? JSON.stringify(item) : String(item)))
      .join(', ')
  }
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export function AdminCatalogPage() {
  const { t } = useTranslation()
  const { data, isLoading, isError } = useGetAdminResourcesQuery()
  const [search, setSearch] = useState('')
  const [showCritical, setShowCritical] = useState(false)
  const [selectedModel, setSelectedModel] = useState<string | null>(null)
  const [offset, setOffset] = useState(0)
  const [rowSearch, setRowSearch] = useState('')
  const [appliedRowSearch, setAppliedRowSearch] = useState('')

  const resources = data ?? []

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase()
    return resources.filter((resource) => {
      if (!showCritical && resource.scope === 'critical') return false
      if (!query) return true
      return (
        resource.name.toLowerCase().includes(query) ||
        resource.model.toLowerCase().includes(query) ||
        resource.group.toLowerCase().includes(query)
      )
    })
  }, [resources, search, showCritical])

  const groups = useMemo(() => {
    const grouped = new Map<string, AdminResource[]>()
    for (const resource of visible) {
      const items = grouped.get(resource.group) ?? []
      items.push(resource)
      grouped.set(resource.group, items)
    }
    return [...grouped.entries()]
  }, [visible])

  useEffect(() => {
    if (!visible.length) return
    if (selectedModel && visible.some((resource) => resource.model === selectedModel)) return
    setSelectedModel(visible[0].model)
  }, [selectedModel, visible])

  const selected = visible.find((resource) => resource.model === selectedModel) ?? null
  const columns = selected ? columnFields(selected) : []
  const canSearchRows = (selected?.search_fields.length ?? 0) > 0

  useEffect(() => {
    setOffset(0)
    setRowSearch('')
    setAppliedRowSearch('')
  }, [selectedModel])

  const {
    data: rowsPage,
    isLoading: isRowsLoading,
    isFetching: isRowsFetching,
    isError: isRowsError,
  } = useGetAdminTableRowsQuery(
    {
      url: selected?.url ?? '',
      limit: ADMIN_PAGE_SIZE,
      offset,
      search: appliedRowSearch || undefined,
    },
    { skip: !selected },
  )

  const rows = rowsPage?.results ?? []

  return (
    <div className="flex h-full min-h-0 gap-4">
      <aside className="flex w-72 shrink-0 flex-col overflow-hidden rounded-lg border border-border bg-card text-card-foreground">
        <div className="space-y-3 border-b border-border p-3">
          <div>
            <h2 className="text-sm font-semibold">{t('admin-page.catalog')}</h2>
            <p className="text-xs text-card-foreground/75">
              {t('admin-page.catalog-count', { count: visible.length })}
            </p>
          </div>
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('admin-page.catalog-search')}
          />
          <label className="flex items-center justify-between gap-3 text-xs text-card-foreground/80">
            {t('admin-page.catalog-show-critical')}
            <Switch checked={showCritical} onCheckedChange={setShowCritical} />
          </label>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {isLoading && (
            <div className="flex items-center gap-2 px-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('admin-page.loading')}
            </div>
          )}

          {!isLoading && isError && (
            <p className="px-2 py-4 text-sm text-muted-foreground">
              {t('admin-page.catalog-loading-failed')}
            </p>
          )}

          {!isLoading && !isError && groups.length === 0 && (
            <p className="px-2 py-4 text-sm text-muted-foreground">{t('admin-page.catalog-empty')}</p>
          )}

          {groups.map(([group, items]) => (
            <div key={group} className="mb-3">
              <div className="px-2 py-1 text-xs font-medium text-card-foreground/70">{group}</div>
              <div className="space-y-0.5">
                {items.map((resource) => {
                  const active = resource.model === selected?.model
                  return (
                    <button
                      key={resource.model}
                      type="button"
                      onClick={() => setSelectedModel(resource.model)}
                      className={cn(
                        'flex w-full cursor-pointer flex-col rounded-md px-2 py-1.5 text-left text-sm text-card-foreground hover:bg-muted',
                        active && 'bg-primary text-primary-foreground hover:bg-primary',
                      )}
                    >
                      <span className="truncate font-medium">{resource.name}</span>
                      <span
                        className={cn(
                          'truncate text-xs',
                          active ? 'text-primary-foreground/90' : 'text-card-foreground/75',
                        )}
                      >
                        {resource.model}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </aside>

      <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card text-card-foreground">
        {!selected && (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            {t('admin-page.catalog-pick')}
          </div>
        )}

        {selected && (
          <>
            <div className="space-y-3 border-b border-border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-semibold">{selected.name}</h2>
                  <p className="truncate text-xs text-card-foreground/75">{selected.model}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="outline">{selected.scope}</Badge>
                  {selected.methods.map((method) => (
                    <Badge key={method} variant={method === 'GET' ? 'secondary' : 'default'}>
                      {method}
                    </Badge>
                  ))}
                </div>
              </div>

              {canSearchRows && (
                <AdminSearchBar
                  value={rowSearch}
                  onChange={setRowSearch}
                  onSubmit={() => {
                    setAppliedRowSearch(rowSearch.trim())
                    setOffset(0)
                  }}
                  placeholder={t('admin-page.catalog-search-rows')}
                  actionLabel={t('admin-page.search')}
                />
              )}

              <p className="truncate font-mono text-xs text-card-foreground/80" title={selected.url}>
                {t('admin-page.catalog-endpoint')}: {selected.url}
              </p>

              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-card-foreground/80">{t('admin-page.catalog-filters')}:</span>
                {selected.filters.length === 0 && (
                  <span className="text-xs text-muted-foreground">{t('admin-page.catalog-no-filters')}</span>
                )}
                {selected.filters.map((filter) => (
                  <Badge key={filter} variant="outline">
                    {filter}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto">
              {isRowsLoading && (
                <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('admin-page.loading')}
                </div>
              )}

              {!isRowsLoading && isRowsError && (
                <p className="p-6 text-sm text-muted-foreground">{t('admin-page.catalog-rows-failed')}</p>
              )}

              {!isRowsLoading && !isRowsError && rows.length === 0 && (
                <p className="p-6 text-sm text-muted-foreground">{t('admin-page.catalog-rows-empty')}</p>
              )}

              {!isRowsLoading && !isRowsError && rows.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      {columns.map((field) => (
                        <TableHead key={field.name} className="whitespace-nowrap text-card-foreground">
                          {field.label}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row, index) => (
                      <TableRow key={String(row[selected.lookup_field] ?? index)}>
                        {columns.map((field) => (
                          <CatalogCell key={field.name} value={row[field.name]} />
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>

            <AdminPagination
              count={rowsPage?.count ?? 0}
              offset={offset}
              limit={ADMIN_PAGE_SIZE}
              onChange={setOffset}
              isLoading={isRowsFetching}
            />
          </>
        )}
      </section>
    </div>
  )
}
