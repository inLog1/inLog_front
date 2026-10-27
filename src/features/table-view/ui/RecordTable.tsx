import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import type { CatalogColumn, TableCell } from '../../../entities/table-view'
import { Table, TableBody, TableCell as Cell, TableHead, TableHeader, TableRow } from '../../../shared/ui/table'
import { columnHeading } from './labels'

function cellText(cell: TableCell, t: (key: string, options?: Record<string, unknown>) => string): string {
  if (cell.state === 'absent') return t('tableViews.cell.absent')
  if (cell.state === 'empty') return t('tableViews.cell.empty')
  if (cell.type === 'boolean') return cell.value === true ? t('tableViews.cell.yes') : t('tableViews.cell.no')
  if (cell.type === 'single_choice') return cell.optionLabel ?? (cell.value == null ? '' : String(cell.value))
  if (cell.type === 'createdAt' && typeof cell.value === 'string') return cell.value.replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC')
  if (cell.value == null) return ''
  return String(cell.value)
}

/** The same table for a saved view and for preview. The open-record link is always present. */
export function RecordTable({
  columns,
  rows,
  recordHref,
}: {
  columns: CatalogColumn[]
  rows: Array<{ recordId: string; formVersionId: string; cells: Record<string, TableCell> }>
  recordHref: (recordId: string) => string
}) {
  const { t } = useTranslation()
  return (
    <div className="min-w-0 max-w-full">
      <Table className="min-w-max">
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead key={column.id} className="whitespace-nowrap">{columnHeading(column, t)}</TableHead>
            ))}
            <TableHead className="whitespace-nowrap">{t('tableViews.open')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.recordId}>
              {columns.map((column) => {
                const cell = row.cells[column.id]
                const text = cell ? cellText(cell, t) : ''
                const muted = cell?.state === 'absent' || cell?.state === 'empty'
                return (
                  <Cell key={column.id} className={muted ? 'whitespace-nowrap text-muted-foreground' : 'whitespace-nowrap'}>
                    {text}
                  </Cell>
                )
              })}
              <Cell className="whitespace-nowrap">
                <Link className="text-primary underline-offset-4 hover:underline" to={recordHref(row.recordId)}>
                  {t('tableViews.open')}
                </Link>
              </Cell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
