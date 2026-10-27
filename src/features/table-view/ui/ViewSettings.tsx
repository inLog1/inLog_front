import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  PAGE_SIZES,
  allowedOps,
  columnKind,
  createdAtDay,
  createdAtToken,
  moveColumn,
  type CatalogColumn,
  type TableViewConfig,
  type ViewFilter,
} from '../../../entities/table-view'
import { Button } from '../../../shared/ui/button'
import { Checkbox } from '../../../shared/ui/checkbox'
import { Input } from '../../../shared/ui/input'
import { Label } from '../../../shared/ui/label'
import { Textarea } from '../../../shared/ui/textarea'
import { columnTitle } from './labels'

const selectClass = 'h-9 min-w-0 rounded-md border border-border bg-background px-2 text-sm text-foreground'

function strictNumber(raw: string): number | null {
  if (!/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(raw.trim())) return null
  const value = Number(raw)
  return Number.isFinite(value) ? value : null
}

export function ViewSettings({
  catalog,
  draft,
  onChange,
  mode,
}: {
  catalog: CatalogColumn[]
  draft: TableViewConfig
  onChange: (next: TableViewConfig) => void
  mode: 'editor' | 'query'
}) {
  const { t } = useTranslation()
  const [numberText, setNumberText] = useState<Record<string, string>>({})
  const selected = draft.columns
    .map((id) => catalog.find((column) => column.id === id))
    .filter((column): column is CatalogColumn => column != null)
  const sortable = catalog.filter((column) => column.sortable)
  const patch = (next: Partial<TableViewConfig>) => onChange({ ...draft, ...next })
  const setFilter = (index: number, filter: ViewFilter) => {
    const filters = draft.filters.map((item, itemIndex) => itemIndex === index ? filter : item)
    patch({ filters })
  }
  return (
    <div className="flex min-w-0 flex-col gap-4">
      {mode === 'editor' ? (
        <>
          <div className="space-y-1">
            <Label htmlFor="view-title">{t('tableViews.name')}</Label>
            <Input id="view-title" value={draft.title} onChange={(event) => patch({ title: event.target.value })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="view-description">{t('tableViews.description')}</Label>
            <Textarea id="view-description" value={draft.description} onChange={(event) => patch({ description: event.target.value })} />
          </div>
          <fieldset className="min-w-0 space-y-2">
            <legend className="text-sm font-medium">{t('tableViews.columns')}</legend>
            {catalog.map((column) => {
              const checked = draft.columns.includes(column.id)
              const last = checked && draft.columns.length === 1
              return (
                <label key={column.id} className="flex min-w-0 items-center gap-2 text-sm">
                  <Checkbox
                    checked={checked}
                    disabled={last}
                    onCheckedChange={(value) => {
                      if (value === true) patch({ columns: [...draft.columns, column.id] })
                      else if (!last) patch({ columns: draft.columns.filter((id) => id !== column.id) })
                    }}
                  />
                  <span className="min-w-0 break-words">{columnTitle(column, t)}{column.retired ? ` (${t('tableViews.retired')})` : ''}{column.mixed ? ` (${t('tableViews.mixed')})` : ''}</span>
                </label>
              )
            })}
          </fieldset>
          <div className="space-y-2">
            <p className="text-sm font-medium">{t('tableViews.column-order')}</p>
            {selected.map((column, index) => (
              <div key={column.id} className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
                <span className="min-w-0 flex-1 break-words">{columnTitle(column, t)}</span>
                <Button type="button" variant="outline" size="sm" disabled={index === 0} onClick={() => patch({ columns: moveColumn(draft.columns, column.id, -1) })}>{t('tableViews.move-up')}</Button>
                <Button type="button" variant="outline" size="sm" disabled={index === selected.length - 1} onClick={() => patch({ columns: moveColumn(draft.columns, column.id, 1) })}>{t('tableViews.move-down')}</Button>
              </div>
            ))}
          </div>
        </>
      ) : null}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium">{t('tableViews.filters')}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const column = catalog[0]
              if (!column) return
              const filters = [...draft.filters, { columnId: column.id, op: allowedOps(column)[0], value: null }]
              patch({ filters })
            }}
          >
            {t('tableViews.add-filter')}
          </Button>
        </div>
        {draft.filters.map((filter, index) => {
          const column = catalog.find((item) => item.id === filter.columnId) ?? catalog[0]
          if (!column) return null
          const ops = allowedOps(column)
          const kind = columnKind(column)
          const numberKey = `${index}:${filter.columnId}:${filter.op}`
          return (
            <div key={`${filter.columnId}-${index}`} className="grid min-w-0 gap-2 rounded-md border border-border p-2 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
              <select
                className={selectClass}
                aria-label={t('tableViews.columns')}
                value={column.id}
                onChange={(event) => {
                  const nextColumn = catalog.find((item) => item.id === event.target.value) ?? column
                  setFilter(index, { columnId: nextColumn.id, op: allowedOps(nextColumn)[0], value: null })
                }}
              >
                {catalog.map((item) => <option key={item.id} value={item.id}>{columnTitle(item, t)}</option>)}
              </select>
              <select
                className={selectClass}
                aria-label={t('tableViews.filters')}
                value={ops.includes(filter.op) ? filter.op : ops[0]}
                onChange={(event) => {
                  const op = ops.find((item) => item === event.target.value) ?? ops[0]
                  setFilter(index, { ...filter, op, value: op === 'present' || op === 'blank' ? null : filter.value })
                }}
              >
                {ops.map((op) => <option key={op} value={op}>{t(`tableViews.op.${op}`)}</option>)}
              </select>
              {filter.op === 'present' || filter.op === 'blank' ? <span /> : kind === 'boolean' ? (
                <select
                  className={selectClass}
                  aria-label={t('tableViews.value')}
                  value={filter.value === true ? 'true' : filter.value === false ? 'false' : ''}
                  onChange={(event) => setFilter(index, { ...filter, value: event.target.value === 'true' ? true : event.target.value === 'false' ? false : null })}
                >
                  <option value="">{t('tableViews.value')}</option>
                  <option value="true">{t('tableViews.yes')}</option>
                  <option value="false">{t('tableViews.no')}</option>
                </select>
              ) : kind === 'choice' ? (
                <select
                  className={selectClass}
                  aria-label={t('tableViews.value')}
                  value={typeof filter.value === 'string' ? filter.value : ''}
                  onChange={(event) => setFilter(index, { ...filter, value: event.target.value || null })}
                >
                  <option value="">{t('tableViews.value')}</option>
                  {column.options.map((option) => {
                    const shared = column.options.filter((item) => item.label === option.label).length > 1
                    return <option key={option.id} value={option.id}>{shared ? `${option.label} · ${option.id}` : option.label}</option>
                  })}
                </select>
              ) : kind === 'date' ? (
                <Input
                  type="date"
                  aria-label={t('tableViews.value')}
                  value={typeof filter.value === 'string' ? filter.value : ''}
                  onChange={(event) => setFilter(index, { ...filter, value: event.target.value || null })}
                />
              ) : kind === 'createdAt' ? (
                <div className="min-w-0 space-y-1">
                  <Input
                    type="date"
                    aria-label={t('tableViews.value')}
                    value={createdAtDay(filter.value) ?? ''}
                    onChange={(event) => setFilter(index, { ...filter, value: event.target.value ? createdAtToken(event.target.value) : null })}
                  />
                  <p className="text-xs text-muted-foreground">{t('tableViews.created-at-utc')}</p>
                  {typeof filter.value === 'string' && filter.value !== '' && createdAtDay(filter.value) == null ? (
                    <p className="text-xs text-muted-foreground">{t('tableViews.legacy-created-at')}</p>
                  ) : null}
                </div>
              ) : kind === 'number' || kind === 'version' ? (
                <Input
                  inputMode="decimal"
                  aria-label={t('tableViews.value')}
                  value={numberText[numberKey] ?? (typeof filter.value === 'number' ? String(filter.value) : '')}
                  onChange={(event) => {
                    const raw = event.target.value
                    setNumberText((current) => ({ ...current, [numberKey]: raw }))
                    setFilter(index, { ...filter, value: raw.trim() === '' ? null : strictNumber(raw) })
                  }}
                />
              ) : (
                <Input
                  aria-label={t('tableViews.value')}
                  value={typeof filter.value === 'string' ? filter.value : ''}
                  onChange={(event) => setFilter(index, { ...filter, value: event.target.value })}
                />
              )}
              <Button type="button" variant="outline" size="sm" onClick={() => patch({ filters: draft.filters.filter((_item, itemIndex) => itemIndex !== index) })}>
                {t('tableViews.remove-filter')}
              </Button>
            </div>
          )
        })}
      </div>
      <div className="grid min-w-0 gap-2 md:grid-cols-3">
        <label className="min-w-0 space-y-1 text-sm">
          {t('tableViews.sort')}
          <select
            className={selectClass}
            value={sortable.some((column) => column.id === draft.sort.columnId) ? draft.sort.columnId : (sortable[0]?.id ?? '')}
            onChange={(event) => patch({ sort: { columnId: event.target.value, direction: draft.sort.direction } })}
          >
            {sortable.map((column) => <option key={column.id} value={column.id}>{columnTitle(column, t)}</option>)}
          </select>
        </label>
        <label className="min-w-0 space-y-1 text-sm">
          {t('tableViews.asc')}
          <select
            className={selectClass}
            value={draft.sort.direction}
            onChange={(event) => patch({ sort: { ...draft.sort, direction: event.target.value === 'asc' ? 'asc' : 'desc' } })}
          >
            <option value="asc">{t('tableViews.asc')}</option>
            <option value="desc">{t('tableViews.desc')}</option>
          </select>
        </label>
        <label className="min-w-0 space-y-1 text-sm">
          {t('tableViews.page-size')}
          <select
            className={selectClass}
            value={draft.pageSize}
            onChange={(event) => patch({ pageSize: Number(event.target.value) })}
          >
            {PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
        </label>
      </div>
    </div>
  )
}
