import { describe, expect, it } from 'vitest'
import { taskListQueryMatchesProject } from './task-cache'

describe('task list cache identity', () => {
  it('does not treat the same slug in another project as the same list', () => {
    expect(taskListQueryMatchesProject({ projectId: 1001, params: {} }, 1001)).toBe(true)
    expect(taskListQueryMatchesProject({ projectId: 1002, params: {} }, 1001)).toBe(false)
    expect(taskListQueryMatchesProject(null, 1001)).toBe(false)
    expect(taskListQueryMatchesProject({ params: {} }, 1001)).toBe(false)
  })
})