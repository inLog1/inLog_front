import { describe, expect, it, vi } from 'vitest'
import { revokeObjectUrls } from './task-file-url'

describe('task file object urls', () => {
  it('releases a blob url and leaves a stored content path alone', () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    revokeObjectUrls(['blob:http://localhost/preview', '/mock-api/projects/1001/tasks/task/sample/file/1/content/'])
    expect(revoke).toHaveBeenCalledTimes(1)
    expect(revoke).toHaveBeenCalledWith('blob:http://localhost/preview')
    revoke.mockRestore()
  })
})
