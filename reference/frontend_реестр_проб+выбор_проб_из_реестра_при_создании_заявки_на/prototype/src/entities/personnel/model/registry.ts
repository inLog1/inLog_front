import { personnelFieldId } from './template'
import { COLUMN_FIO, COLUMN_STATE } from './types'

export type DeadlineTone = 'empty' | 'current' | 'soon' | 'overdue'
export type QualificationTone = 'current' | 'soon' | 'overdue' | 'neutral'
export type RegistryStatusFilter = 'all' | 'confirmed' | 'needs-confirmation' | 'soon' | 'overdue' | 'empty'

const SOON_DAYS = 30

export function daysUntil(isoDate: string, today: Date): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null
  const [year, month, day] = isoDate.split('-').map(Number)
  if (!year || !month || !day) return null
  const target = Date.UTC(year, month - 1, day)
  const start = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.round((target - start) / 86_400_000)
}

export function certificationTone(isoDate: string, today = new Date()): DeadlineTone {
  const days = daysUntil(isoDate, today)
  if (days == null) return 'empty'
  if (days < 0) return 'overdue'
  if (days > 0 && days <= SOON_DAYS) return 'soon'
  return 'current'
}

/** Color follows the stored qualification entry and its certification date. A job title is not an input. */
export function qualificationTone(
  qualificationId: string,
  certificationUntil: string,
  today = new Date(),
): QualificationTone {
  const confirmed = qualificationId.endsWith(':confirmed')
  const needsConfirmation = qualificationId.endsWith(':needs-confirmation')
  if (!confirmed && !needsConfirmation) return 'neutral'
  const certification = certificationTone(certificationUntil, today)
  if (certification === 'overdue') return 'overdue'
  if (certification === 'soon' || needsConfirmation) return 'soon'
  return 'current'
}

export type RegistryMetrics = {
  total: number
  overdueCertifications: number
  soonCertifications: number
}

export function registryMetrics(
  rows: readonly { archived: boolean; certificationUntil: string }[],
  today = new Date(),
): RegistryMetrics {
  const active = rows.filter((row) => !row.archived)
  return {
    total: active.length,
    overdueCertifications: active.filter((row) => certificationTone(row.certificationUntil, today) === 'overdue').length,
    soonCertifications: active.filter((row) => certificationTone(row.certificationUntil, today) === 'soon').length,
  }
}

export function matchesQuery(
  row: { name: string; email: string; personnelNumber: string },
  query: string,
): boolean {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  return [row.name, row.email, row.personnelNumber].join(' ').toLowerCase().includes(needle)
}

export function matchesStatus(
  row: { qualificationId: string; certificationUntil: string },
  filter: RegistryStatusFilter,
  today = new Date(),
): boolean {
  if (filter === 'all') return true
  const tone = certificationTone(row.certificationUntil, today)
  if (filter === 'confirmed') return row.qualificationId.endsWith(':confirmed') && tone !== 'overdue'
  if (filter === 'needs-confirmation') return row.qualificationId.endsWith(':needs-confirmation') && tone !== 'overdue'
  if (filter === 'soon') return tone === 'soon'
  if (filter === 'overdue') return tone === 'overdue'
  return !row.qualificationId || row.qualificationId.endsWith(':unspecified')
}

export function legacyPersonnelColumns(organizationId: number): string[] {
  return [
    COLUMN_FIO,
    personnelFieldId(organizationId, 'department'),
    personnelFieldId(organizationId, 'position'),
    personnelFieldId(organizationId, 'email'),
    COLUMN_STATE,
  ]
}

export function isLegacyPersonnelColumns(columns: readonly string[], organizationId: number): boolean {
  const legacy = legacyPersonnelColumns(organizationId)
  if (columns.length !== legacy.length) return false
  return legacy.every((id) => columns.includes(id))
}

export function systemColumnVisible(
  columns: readonly string[],
  organizationId: number,
  field: { id: string; visible: boolean; archived: boolean } | undefined,
): boolean {
  if (!field || !field.visible || field.archived) return false
  if (columns.includes(field.id)) return true
  return isLegacyPersonnelColumns(columns, organizationId)
}

export function personInitials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean).slice(0, 2)
  const letters = parts.map((part) => part[0]?.toUpperCase() ?? '').join('')
  return letters || ''
}

export function avatarIndex(seed: string): number {
  let hash = 0
  for (const char of seed) hash = (hash + char.charCodeAt(0)) % 5
  return hash
}

export function csvDocument(headers: readonly string[], rows: readonly (readonly string[])[]): string {
  const lines = [headers, ...rows].map((row) => row.map(csvCell).join(','))
  return lines.join('\r\n')
}

function csvCell(value: string): string {
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}
