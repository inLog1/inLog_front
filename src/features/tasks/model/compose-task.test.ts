import { describe, expect, it, vi } from 'vitest'
import { clearCreateTaskRequest, peekCreateTaskRequest, requestCreateTask } from './compose-task'

describe('task compose request', () => {
  it('survives until the tasks screen consumes it', () => {
    const values = new Map<string, string>()
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value) },
      removeItem: (key: string) => { values.delete(key) },
    })
    requestCreateTask()
    expect(peekCreateTaskRequest()).toBe(true)
    expect(peekCreateTaskRequest()).toBe(true)
    clearCreateTaskRequest()
    expect(peekCreateTaskRequest()).toBe(false)
    vi.unstubAllGlobals()
  })
})
