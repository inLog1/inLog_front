import {
  REQUEST_BASIS_MAX_BYTES,
  requestBasisMimeAllowed,
  type RequestRecord,
} from '../../../entities/request'
import type { MockRequestBasisFile, MockState } from '../db/types'
import type { FlowResult } from '../auth/flow'

function done(state: MockState, status: number, body: unknown): FlowResult {
  return { state, status, body }
}

function problem(state: MockState, status: number, code: string): FlowResult {
  return done(state, status, { code })
}

export function basisFilesOf(state: MockState): MockRequestBasisFile[] {
  return state.requestBasisFiles ?? []
}

export function basisContentPath(requestId: string, fileId: string): string {
  return `/mock-api/requests/${encodeURIComponent(requestId)}/basis/${encodeURIComponent(fileId)}/content/?`
}

export function basisDto(file: MockRequestBasisFile, requestId: string) {
  return {
    id: file.id,
    filename: file.filename,
    mimeType: file.mimeType,
    size: file.size,
    url: basisContentPath(requestId, file.id),
  }
}

export function basisFileOf(state: MockState, requestId: string): MockRequestBasisFile | null {
  const files = basisFilesOf(state)
  return files.find((item) => item.requestId === requestId) ?? null
}

export function replaceBasisFile(
  state: MockState,
  requestId: string,
  file: { filename: string; mimeType: string; bytes: Uint8Array },
): { ok: true; state: MockState; stored: MockRequestBasisFile } | { ok: false; code: string } {
  if (file.bytes.byteLength <= 0) return { ok: false, code: 'invalid_file' }
  if (file.bytes.byteLength > REQUEST_BASIS_MAX_BYTES) return { ok: false, code: 'payload_too_large' }
  const mime = file.mimeType.trim().toLowerCase()
  if (!requestBasisMimeAllowed(mime)) return { ok: false, code: 'invalid_file' }
  const current = basisFilesOf(state).filter((item) => item.requestId !== requestId)
  const stored: MockRequestBasisFile = {
    id: `rb-${crypto.randomUUID()}`,
    requestId,
    filename: file.filename || 'document',
    mimeType: mime,
    size: file.bytes.byteLength,
    createdAt: new Date().toISOString(),
    bytes: file.bytes,
  }
  return { ok: true, state: { ...state, requestBasisFiles: [...current, stored] }, stored }
}

export function removeBasisFile(state: MockState, requestId: string): MockState {
  const next = basisFilesOf(state).filter((item) => item.requestId !== requestId)
  if (next.length === basisFilesOf(state).length) return state
  return { ...state, requestBasisFiles: next }
}

export function readBasisBytes(
  state: MockState,
  requestId: string,
  fileId: string,
): { ok: true; file: MockRequestBasisFile } | { ok: false; result: FlowResult } {
  const file = basisFilesOf(state).find((item) => item.id === fileId && item.requestId === requestId)
  if (!file) return { ok: false, result: problem(state, 404, 'not_found') }
  return { ok: true, file }
}

export function requestHasBasis(state: MockState, request: RequestRecord): boolean {
  if (!request.basisFileId) return false
  return basisFilesOf(state).some((item) => item.id === request.basisFileId && item.requestId === request.id)
}
