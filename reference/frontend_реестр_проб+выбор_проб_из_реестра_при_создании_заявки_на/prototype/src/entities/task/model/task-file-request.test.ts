import { describe, expect, it } from 'vitest'
import { taskFileUploadRequest } from './taskSlice'

describe('task file upload request', () => {
  it('sends FormData without a manual multipart Content-Type', () => {
    const request = taskFileUploadRequest(1001, 'shared-sample', new File(['hello'], 'note.txt', { type: 'text/plain' }))
    expect(request.method).toBe('POST')
    expect(request.body).toBeInstanceOf(FormData)
    expect(request.body.get('file')).toBeInstanceOf(File)
    expect(request).not.toHaveProperty('headers')
  })
})
