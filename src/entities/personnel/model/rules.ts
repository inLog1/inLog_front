import type { Department, Employee, PersonnelValue } from './types'

export type ParentCheck = 'ok' | 'missing' | 'other-organization' | 'cycle'

export function departmentParent(
  departments: readonly Pick<Department, 'id' | 'organizationId' | 'parentId'>[],
  organizationId: number,
  departmentId: string,
  parentId: string | null,
): ParentCheck {
  if (parentId == null) return 'ok'
  if (parentId === departmentId) return 'cycle'
  const byId = new Map(departments.map((item) => [item.id, item]))
  const parent = byId.get(parentId)
  if (!parent) return 'missing'
  if (parent.organizationId !== organizationId) return 'other-organization'
  const seen = new Set<string>([departmentId])
  let cursor: string | null = parentId
  while (cursor) {
    if (seen.has(cursor)) return 'cycle'
    seen.add(cursor)
    const node = byId.get(cursor)
    if (!node || node.organizationId !== organizationId) return 'other-organization'
    cursor = node.parentId
  }
  return 'ok'
}

export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

/** A stored choice that must not be discarded by a type change. Unchecked boxes do not count. */
export function valueOccupied(value: PersonnelValue | undefined): boolean {
  if (value == null) return false
  if (typeof value === 'string') return value.trim() !== ''
  if (typeof value === 'number') return Number.isFinite(value)
  return value === true
}

export function externalIdentityClash(
  employees: readonly Pick<Employee, 'id' | 'organizationId' | 'source' | 'sourceId' | 'externalId'>[],
  candidate: Pick<Employee, 'id' | 'organizationId' | 'source' | 'sourceId' | 'externalId'>,
): boolean {
  if (!candidate.externalId) return false
  const sourceId = candidate.sourceId ?? ''
  return employees.some((item) =>
    item.id !== candidate.id
    && item.organizationId === candidate.organizationId
    && item.source === candidate.source
    && (item.sourceId ?? '') === sourceId
    && item.externalId === candidate.externalId,
  )
}
