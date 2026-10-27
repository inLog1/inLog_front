import { HttpResponse } from 'msw'
import {
  ensureMockState,
  isMockWriteLocked,
  MockWriterHeldError,
  SchemaMismatchError,
  StaleMockWriteError,
  updateMockState,
} from './db/repository'
import type { MockFault, MockState } from './db/types'
import type { FlowResult } from './auth/flow'

export const MOCK_PREFIX = '/mock-api'

export function json(body: object, status = 200) {
  return HttpResponse.json(body, { status })
}

export function bearer(request: Request): string | null {
  const header = request.headers.get('Authorization')
  if (!header?.startsWith('Bearer ')) return null
  const token = header.slice('Bearer '.length).trim()
  return token.length > 0 ? token : null
}

function mismatch(foundVersion: number) {
  return json({ code: 'schema_mismatch', foundVersion }, 409)
}

export function persistenceFailure(error: unknown): Response | null {
  if (error instanceof SchemaMismatchError) return mismatch(error.foundVersion)
  if (error instanceof MockWriterHeldError) {
    return json({
      code: 'mock_writer_held',
      detail: 'Another tab is the writer for this mock namespace. This tab did not change it.',
    }, 409)
  }
  if (error instanceof StaleMockWriteError) {
    return json({
      code: 'stale_write',
      detail: 'The write used an older snapshot. The stored mock data was left unchanged.',
    }, 409)
  }
  if (error instanceof DOMException && error.name === 'QuotaExceededError') {
    return json({ code: 'quota_exceeded' }, 507)
  }
  return null
}

function faultResponse(fault: Exclude<MockFault, null>) {
  if (fault.kind === 'network') return HttpResponse.error()
  const status = fault.kind === 'unauthorized'
    ? 401
    : fault.kind === 'forbidden'
      ? 403
      : fault.kind === 'cancel'
        ? 400
        : 500
  return json({ code: fault.kind }, status)
}

export async function load(path?: string): Promise<MockState | Response> {
  const read = await ensureMockState()
  if (!read.ok) return mismatch(read.foundVersion)
  if (!path || read.state.fault?.path !== path) return read.state
  const fault = read.state.fault
  try {
    await updateMockState((current) => ({ ...current, fault: null }))
  } catch (error) {
    const failure = persistenceFailure(error)
    if (failure) return failure
    throw error
  }
  return faultResponse(fault)
}

export function positiveId(raw: string | readonly string[] | undefined): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw
  if (!value || !/^[1-9]\d*$/.test(value)) return null
  const id = Number(value)
  return Number.isSafeInteger(id) ? id : null
}

export function reply(result: FlowResult) {
  if (result.status === 204) return new HttpResponse(null, { status: 204 })
  const body = result.body && typeof result.body === 'object' ? result.body : { code: 'empty' }
  return json(body, result.status)
}

export async function commit(produce: (state: MockState) => FlowResult) {
  const box: { result?: FlowResult } = {}
  try {
    await updateMockState((state) => {
      const result = produce(state)
      box.result = result
      return result.state
    })
  } catch (error) {
    const failure = persistenceFailure(error)
    if (failure) return failure
    throw error
  }
  if (!box.result) return json({ code: 'empty' }, 500)
  return reply(box.result)
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await request.json()
    return body && typeof body === 'object' ? body as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

export async function writeLockedFlag(): Promise<boolean> {
  return isMockWriteLocked()
}
