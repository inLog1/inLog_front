import {
  REQUEST_LEGACY_PRIORITIES,
  REQUEST_PRIORITIES,
  isRequestPriority,
  type RequestPriority,
  type RequestStatus,
} from '../../../../entities/request'

/** Same statuses as the registry, in the order shown in the list filter. */
export const REQUEST_STATUS_FILTER_ORDER = [
  'draft',
  'sent',
  'in_review',
  'program_approval',
  'rework',
  'approved',
  'rejected',
  'withdrawn',
] as const satisfies readonly RequestStatus[]

export type RequestFilterSource = {
  status: RequestStatus
  priority?: string
  customerOrganizationId: number
  customerShortName: string
  executorOrganizationId: number
  executorShortName: string
}

export type RequestListFilterState = {
  status: 'all' | RequestStatus
  priority: 'all' | 'empty' | RequestPriority
  customerId: 'all' | number
  executorId: 'all' | number
}

export type FilterChoice = {
  value: string
  label: string
  count: number
}

type FilterText = {
  all: string
  status: (status: RequestStatus) => string
  priority: (priority: RequestPriority) => string
  priorityEmpty: string
  unnamed: string
}

type FilterDimension = 'status' | 'priority' | 'customer' | 'executor'

export function requestPartyFilterValue(value: string): 'all' | number {
  if (value === 'all') return 'all'
  const id = Number(value)
  return Number.isInteger(id) ? id : 'all'
}

export function requestMatchesListFilters(row: RequestFilterSource, filter: RequestListFilterState): boolean {
  return matches(row, filter)
}

export function requestListFilterChoices(
  rows: readonly RequestFilterSource[],
  filter: RequestListFilterState,
  text: FilterText,
): { status: FilterChoice[]; priority: FilterChoice[]; customer: FilterChoice[]; executor: FilterChoice[] } {
  return {
    status: statusChoices(rows.filter((row) => matches(row, filter, 'status')), text),
    priority: priorityChoices(rows, rows.filter((row) => matches(row, filter, 'priority')), filter, text),
    customer: partyChoices(rows, rows.filter((row) => matches(row, filter, 'customer')), 'customer', filter.customerId, text),
    executor: partyChoices(rows, rows.filter((row) => matches(row, filter, 'executor')), 'executor', filter.executorId, text),
  }
}

function matches(row: RequestFilterSource, filter: RequestListFilterState, skip?: FilterDimension): boolean {
  if (skip !== 'status' && filter.status !== 'all' && row.status !== filter.status) return false
  if (skip !== 'priority' && filter.priority !== 'all' && priorityKey(row) !== filter.priority) return false
  if (skip !== 'customer' && filter.customerId !== 'all' && row.customerOrganizationId !== filter.customerId) return false
  if (skip !== 'executor' && filter.executorId !== 'all' && row.executorOrganizationId !== filter.executorId) return false
  return true
}

function priorityKey(row: RequestFilterSource): 'empty' | RequestPriority {
  const value = row.priority ?? ''
  return isRequestPriority(value) ? value : 'empty'
}

function statusChoices(pool: readonly RequestFilterSource[], text: FilterText): FilterChoice[] {
  return [
    { value: 'all', label: text.all, count: pool.length },
    ...REQUEST_STATUS_FILTER_ORDER.map((status) => ({
      value: status,
      label: text.status(status),
      count: pool.filter((row) => row.status === status).length,
    })),
  ]
}

function priorityChoices(
  rows: readonly RequestFilterSource[],
  pool: readonly RequestFilterSource[],
  filter: RequestListFilterState,
  text: FilterText,
): FilterChoice[] {
  const present = new Set(rows.map(priorityKey))
  const legacy = REQUEST_LEGACY_PRIORITIES.filter((priority) => present.has(priority) || filter.priority === priority)
  const named = [...REQUEST_PRIORITIES, ...legacy]
  const choices: FilterChoice[] = [
    { value: 'all', label: text.all, count: pool.length },
    ...named.map((priority) => ({
      value: priority,
      label: text.priority(priority),
      count: pool.filter((row) => priorityKey(row) === priority).length,
    })),
  ]
  if (present.has('empty') || filter.priority === 'empty') {
    choices.push({
      value: 'empty',
      label: text.priorityEmpty,
      count: pool.filter((row) => priorityKey(row) === 'empty').length,
    })
  }
  return choices
}

function partyChoices(
  rows: readonly RequestFilterSource[],
  pool: readonly RequestFilterSource[],
  side: 'customer' | 'executor',
  selected: 'all' | number,
  text: FilterText,
): FilterChoice[] {
  const names = new Map<number, string>()
  for (const row of rows) rememberParty(names, partyId(row, side), partyName(row, side), text.unnamed)
  if (selected !== 'all') rememberParty(names, selected, text.unnamed, text.unnamed)
  const choices = [...names.entries()].map(([id, label]) => ({
    value: String(id),
    label,
    count: pool.filter((row) => partyId(row, side) === id).length,
  }))
  choices.sort((left, right) => {
    const leftUnnamed = left.label === text.unnamed
    const rightUnnamed = right.label === text.unnamed
    if (leftUnnamed !== rightUnnamed) return leftUnnamed ? 1 : -1
    return left.label.localeCompare(right.label, 'ru') || left.value.localeCompare(right.value)
  })
  return [{ value: 'all', label: text.all, count: pool.length }, ...choices]
}

function partyId(row: RequestFilterSource, side: 'customer' | 'executor'): number {
  return side === 'customer' ? row.customerOrganizationId : row.executorOrganizationId
}

function partyName(row: RequestFilterSource, side: 'customer' | 'executor'): string {
  return side === 'customer' ? row.customerShortName : row.executorShortName
}

function rememberParty(names: Map<number, string>, id: number, name: string, unnamed: string) {
  const label = name.trim() || unnamed
  const current = names.get(id)
  if (current == null || (current === unnamed && label !== unnamed)) names.set(id, label)
}
