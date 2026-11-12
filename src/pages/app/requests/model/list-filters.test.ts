import { describe, expect, it } from 'vitest'
import { REQUEST_STATUSES } from '../../../../entities/request'
import {
  REQUEST_STATUS_FILTER_ORDER,
  requestListFilterChoices,
  requestMatchesListFilters,
  type RequestFilterSource,
  type RequestListFilterState,
} from './list-filters'

const text = {
  all: 'Все',
  status: (status: RequestFilterSource['status']) => status,
  priority: (priority: string) => priority,
  priorityEmpty: 'Не указан',
  unnamed: '—',
}

const open: RequestListFilterState = {
  status: 'all',
  priority: 'all',
  customerId: 'all',
  executorId: 'all',
}

function row(patch: Partial<RequestFilterSource> & Pick<RequestFilterSource, 'status'>): RequestFilterSource {
  return {
    priority: 'medium',
    customerOrganizationId: 1,
    customerShortName: 'Заказчик',
    executorOrganizationId: 2,
    executorShortName: 'Лаб',
    ...patch,
  }
}

describe('request list filters', () => {
  const rows = [
    row({ status: 'draft', priority: '', customerShortName: 'Газпром', customerOrganizationId: 10, executorShortName: 'Керн', executorOrganizationId: 20 }),
    row({ status: 'in_review', priority: 'medium', customerShortName: 'Газпром', customerOrganizationId: 10, executorShortName: 'Керн', executorOrganizationId: 20 }),
    row({ status: 'in_review', priority: 'high', customerShortName: 'НОВАТЭК', customerOrganizationId: 11, executorShortName: 'Флюид', executorOrganizationId: 21 }),
    row({ status: 'approved', priority: 'urgent', customerShortName: 'НОВАТЭК', customerOrganizationId: 11, executorShortName: 'Керн', executorOrganizationId: 20 }),
  ]

  it('lists every status, including a zero count, in the filter order', () => {
    expect([...REQUEST_STATUS_FILTER_ORDER].sort()).toEqual([...REQUEST_STATUSES].sort())
    const { status } = requestListFilterChoices(rows, open, text)
    expect(status.map((item) => [item.value, item.count])).toEqual([
      ['all', 4],
      ['draft', 1],
      ['sent', 0],
      ['in_review', 2],
      ['program_approval', 0],
      ['rework', 0],
      ['approved', 1],
      ['rejected', 0],
      ['withdrawn', 0],
    ])
  })

  it('counts a facet from the other filters, not from its own selection', () => {
    const filter: RequestListFilterState = { ...open, status: 'in_review', customerId: 10 }
    const choices = requestListFilterChoices(rows, filter, text)
    expect(choices.status.find((item) => item.value === 'all')?.count).toBe(2)
    expect(choices.status.find((item) => item.value === 'draft')?.count).toBe(1)
    expect(choices.status.find((item) => item.value === 'in_review')?.count).toBe(1)
    expect(choices.customer.find((item) => item.value === 'all')?.count).toBe(2)
    expect(choices.customer.find((item) => item.value === '11')?.count).toBe(1)
    expect(choices.priority.find((item) => item.value === 'high')?.count).toBe(0)
    expect(choices.priority.find((item) => item.value === 'medium')?.count).toBe(1)
    expect(rows.filter((item) => requestMatchesListFilters(item, filter))).toHaveLength(1)
  })

  it('keeps an empty priority and a stored legacy priority as their own options', () => {
    const { priority } = requestListFilterChoices(rows, open, text)
    expect(priority.map((item) => [item.value, item.count])).toEqual([
      ['all', 4],
      ['critical', 0],
      ['high', 1],
      ['medium', 1],
      ['low', 0],
      ['urgent', 1],
      ['empty', 1],
    ])
  })

  it('sorts parties by name and keeps a selected party that the current rows do not contain', () => {
    const { customer, executor } = requestListFilterChoices(rows, { ...open, customerId: 99 }, text)
    expect(customer.map((item) => item.label)).toEqual(['Все', 'Газпром', 'НОВАТЭК', '—'])
    expect(customer.find((item) => item.value === '99')?.count).toBe(0)
    expect(executor.map((item) => item.count)).toEqual([0, 0, 0])
    const openExecutor = requestListFilterChoices(rows, open, text).executor
    expect(openExecutor.map((item) => [item.label, item.count])).toEqual([
      ['Все', 4],
      ['Керн', 3],
      ['Флюид', 1],
    ])
  })
})
