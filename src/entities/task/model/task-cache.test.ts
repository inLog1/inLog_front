import { describe, expect, it } from 'vitest'
import { applyClientTaskTypeFilter, applyOptimisticTaskPatch, taskListQueryMatchesProject } from './task-cache'
import type { Task } from './types'

describe('task list cache identity', () => {
  it('does not treat the same slug in another project as the same list', () => {
    expect(taskListQueryMatchesProject({ projectId: 1001, params: {} }, 1001)).toBe(true)
    expect(taskListQueryMatchesProject({ projectId: 1002, params: {} }, 1001)).toBe(false)
    expect(taskListQueryMatchesProject(null, 1001)).toBe(false)
    expect(taskListQueryMatchesProject({ params: {} }, 1001)).toBe(false)
  })

  it('drops a task from the filtered page and rolls the count back only for that project', () => {
    const task = {
      id: 1,
      slug: 'shared-sample',
      name: 'Образец А-1',
      project: 1001,
      status: { id: 501, name_en: 'No status' },
      status_position: 2,
      parent: null,
      is_template: false,
      created_at: '2026-03-01',
    } as unknown as Task
    const other = { ...task, id: 2, project: 1002, name: 'Образец Б-1' }
    const draft = { count: 2, next: null, previous: null, results: [task, other] }
    applyOptimisticTaskPatch(draft, { status: '501' }, 1001, 'shared-sample', { status: 503, status_position: 1 }, 'status_position')
    expect(draft.results.map((item) => item.project)).toEqual([1002])
    expect(draft.count).toBe(1)
    expect(other.name).toBe('Образец Б-1')
  })

  it('does not replace the server count with the length of one partial page', () => {
    const parent = { id: 1, parent: null, status: { name_en: 'No status' } } as unknown as Task
    const child = { id: 2, parent: 1, status: { name_en: 'No status' } } as Task
    const partial = applyClientTaskTypeFilter({
      count: 20,
      next: '/tasks/?offset=2',
      previous: null,
      results: [parent, child],
    }, 'parent')
    expect(partial.count).toBe(20)
    expect(partial.results).toHaveLength(2)
    const complete = applyClientTaskTypeFilter({
      count: 2,
      next: null,
      previous: null,
      results: [parent, child],
    }, 'parent')
    expect(complete.count).toBe(1)
    expect(complete.results.map((item) => item.id)).toEqual([1])
  })
})