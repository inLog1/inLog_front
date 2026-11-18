import { describe, expect, it } from 'vitest'
import {
  isReadRequest,
  responseBypassedWorker,
  shouldRecoverMockQuery,
} from './mock-worker-wake'

describe('mock worker recovery', () => {
  it('replays reads only', () => {
    expect(isReadRequest('session/access/')).toBe(true)
    expect(isReadRequest({ url: 'access/users/' })).toBe(true)
    expect(isReadRequest({ url: 'access/users/', method: 'HEAD' })).toBe(true)
    expect(isReadRequest({ url: 'auth/dev/reset/', method: 'POST' })).toBe(false)
  })

  it('recognises a static document that skipped the mock worker', () => {
    expect(responseBypassedWorker({ data: '<!doctype html><title>inLog</title>' })).toBe(true)
    expect(responseBypassedWorker({ error: { status: 'PARSING_ERROR', data: '<html>' } })).toBe(true)
    expect(responseBypassedWorker({ error: { status: 404, data: ' <html></html>' } })).toBe(true)
    expect(responseBypassedWorker({ data: { users: [] } })).toBe(false)
    expect(responseBypassedWorker({ error: { status: 404, data: { code: 'not_found' } } })).toBe(false)
    expect(responseBypassedWorker({ error: { status: 'FETCH_ERROR' } })).toBe(false)
  })

  it('retries a dropped mock read and leaves a real status alone', () => {
    expect(shouldRecoverMockQuery('PARSING_ERROR')).toBe(true)
    expect(shouldRecoverMockQuery('FETCH_ERROR')).toBe(true)
    expect(shouldRecoverMockQuery('TIMEOUT_ERROR')).toBe(true)
    expect(shouldRecoverMockQuery(401)).toBe(false)
    expect(shouldRecoverMockQuery(403)).toBe(false)
    expect(shouldRecoverMockQuery(500)).toBe(false)
  })
})
