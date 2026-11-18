import { SYSTEM_COLUMN_IDS } from '../../../entities/table-view'

export function columnTitle(column: { id: string; label: string }, t: (key: string) => string): string {
  if (column.id === SYSTEM_COLUMN_IDS.createdAt) return t('tableViews.system.createdAt')
  if (column.id === SYSTEM_COLUMN_IDS.author) return t('tableViews.system.author')
  if (column.id === SYSTEM_COLUMN_IDS.version) return t('tableViews.system.version')
  if (column.id === SYSTEM_COLUMN_IDS.recordId) return t('tableViews.system.recordId')
  return column.label
}

export function columnHeading(column: { id: string; label: string; retired: boolean; mixed: boolean }, t: (key: string) => string): string {
  const title = columnTitle(column, t)
  const notes = [column.retired ? t('tableViews.retired') : '', column.mixed ? t('tableViews.mixed') : ''].filter(Boolean)
  return notes.length > 0 ? `${title} (${notes.join(', ')})` : title
}
