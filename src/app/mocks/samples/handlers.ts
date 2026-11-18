import { http, HttpResponse, type HttpHandler } from 'msw'
import type {
  ChangeSampleInspectionInput,
  ChangeSamplePlaceInput,
  ChangeSampleStatusInput,
  RegisterSampleBatchInput,
  RegisterSampleInput,
  RegisterSubsampleInput,
} from '../../../entities/sample'
import { bearer, commit, json, load, MOCK_PREFIX, positiveId, readJson, reply } from '../http'
import {
  addSampleDocuments,
  changeSampleInspection,
  changeSamplePlace,
  changeSampleStatus,
  deleteSampleRecord,
  linkSampleDocument,
  listSampleDocuments,
  listSamples,
  readSample,
  readSampleDocumentContent,
  readSampleHistory,
  registerSample,
  registerSampleBatch,
  registerSubsample,
  unlinkSampleDocument,
} from './service'

function organizationQuery(request: Request): number | null {
  return positiveId(new URL(request.url).searchParams.get('organization') ?? undefined)
}

function pathId(value: string | readonly string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value
  if (!raw || !/^[\w-]+$/.test(raw)) return null
  return raw
}

function bodyRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function organizationIdOf(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null
}

function optionalString(body: Record<string, unknown>, key: string): string | undefined | null {
  if (!Object.prototype.hasOwnProperty.call(body, key) || body[key] == null) return undefined
  return typeof body[key] === 'string' ? body[key] : null
}

function requiredString(body: Record<string, unknown>, key: string): string | null {
  return typeof body[key] === 'string' ? body[key] : null
}

function readRegisterSample(body: Record<string, unknown>): RegisterSampleInput | null {
  const organizationId = organizationIdOf(body.organizationId)
  const sampleType = requiredString(body, 'sampleType')
  const field = requiredString(body, 'field')
  const well = requiredString(body, 'well')
  if (organizationId == null || sampleType == null || field == null || well == null) return null
  const optional = optionalFields(body, [
    'formation', 'interval', 'collectedAt', 'receivedAt', 'location', 'stage', 'inspection',
    'inspectionNote', 'material', 'container', 'quantity', 'supplier', 'document', 'conditions', 'externalCode',
  ])
  if (!optional) return null
  return { organizationId, sampleType, field, well, ...optional }
}

function readRegisterSubsample(body: Record<string, unknown>): RegisterSubsampleInput | null {
  const organizationId = organizationIdOf(body.organizationId)
  const parentId = requiredString(body, 'parentId')
  if (organizationId == null || parentId == null) return null
  const optional = optionalFields(body, [
    'receivedAt', 'location', 'stage', 'inspection', 'inspectionNote', 'subsampleInterval',
    'material', 'container', 'quantity', 'supplier', 'document', 'conditions', 'externalCode',
    'sampleType', 'field', 'well', 'formation', 'interval', 'collectedAt',
  ])
  if (!optional) return null
  return { organizationId, parentId, ...optional }
}

function optionalFields(body: Record<string, unknown>, keys: readonly string[]): Record<string, string> | null {
  const result: Record<string, string> = {}
  for (const key of keys) {
    const value = optionalString(body, key)
    if (value === null) return null
    if (value !== undefined) result[key] = value
  }
  return result
}

function readStatus(body: Record<string, unknown>, sampleId: string): ChangeSampleStatusInput | null {
  const organizationId = organizationIdOf(body.organizationId)
  const stage = requiredString(body, 'stage')
  if (organizationId == null || stage == null) return null
  const location = optionalString(body, 'location')
  const receivedAt = optionalString(body, 'receivedAt')
  if (location === null || receivedAt === null) return null
  return {
    organizationId,
    sampleId,
    stage,
    ...(location !== undefined ? { location } : {}),
    ...(receivedAt !== undefined ? { receivedAt } : {}),
  }
}

function readInspection(body: Record<string, unknown>, sampleId: string): ChangeSampleInspectionInput | null {
  const organizationId = organizationIdOf(body.organizationId)
  const inspection = requiredString(body, 'inspection')
  const inspectionNote = requiredString(body, 'inspectionNote')
  if (organizationId == null || inspection == null || inspectionNote == null) return null
  return { organizationId, sampleId, inspection, inspectionNote }
}

function readPlace(body: Record<string, unknown>, sampleId: string): ChangeSamplePlaceInput | null {
  const organizationId = organizationIdOf(body.organizationId)
  const location = requiredString(body, 'location')
  const receivedAt = requiredString(body, 'receivedAt')
  if (organizationId == null || location == null || receivedAt == null) return null
  return { organizationId, sampleId, location, receivedAt }
}

function readBatch(body: Record<string, unknown>): RegisterSampleBatchInput | null {
  const organizationId = organizationIdOf(body.organizationId)
  const csv = requiredString(body, 'csv')
  if (organizationId == null || csv == null) return null
  return { organizationId, csv }
}

export const sampleHandlers: HttpHandler[] = [
  http.get(`${MOCK_PREFIX}/samples/`, async ({ request }) => {
    const ready = await load('samples/')
    if (ready instanceof Response) return ready
    const organizationId = organizationQuery(request)
    if (organizationId == null) return json({ code: 'invalid_organization' }, 400)
    const includeDeleted = new URL(request.url).searchParams.get('includeDeleted') === '1'
    return reply(listSamples(ready, bearer(request), organizationId, { includeDeleted }))
  }),
  http.post(`${MOCK_PREFIX}/samples/`, async ({ request }) => {
    const body = bodyRecord(await readJson(request))
    const input = body && readRegisterSample(body)
    if (!input) return json({ code: 'invalid_body' }, 400)
    return commit((state) => registerSample(state, bearer(request), input))
  }),
  http.post(`${MOCK_PREFIX}/samples/subsamples/`, async ({ request }) => {
    const body = bodyRecord(await readJson(request))
    const input = body && readRegisterSubsample(body)
    if (!input) return json({ code: 'invalid_body' }, 400)
    return commit((state) => registerSubsample(state, bearer(request), input))
  }),
  http.post(`${MOCK_PREFIX}/samples/batch/`, async ({ request }) => {
    const body = bodyRecord(await readJson(request))
    const input = body && readBatch(body)
    if (!input) return json({ code: 'invalid_body' }, 400)
    return commit((state) => registerSampleBatch(state, bearer(request), input))
  }),
  http.post(`${MOCK_PREFIX}/samples/documents/`, async ({ request }) => {
    const ready = await load('samples/documents/')
    if (ready instanceof Response) return ready
    const form = await request.formData()
    const organizationId = positiveId(String(form.get('organizationId') ?? ''))
    const type = form.get('type')
    if (organizationId == null || typeof type !== 'string' || !type) return json({ code: 'invalid_body' }, 400)
    const sampleIds = form.getAll('sampleIds').filter((item): item is string => typeof item === 'string' && item.length > 0)
    const entries = form.getAll('files')
    if (entries.some((entry) => !(entry instanceof File))) return json({ code: 'invalid_file' }, 400)
    const files = await Promise.all(entries.map(async (entry) => {
      const file = entry as File
      return { filename: file.name, mimeType: file.type, bytes: new Uint8Array(await file.arrayBuffer()) }
    }))
    const documentNumber = form.get('documentNumber')
    const documentDate = form.get('documentDate')
    return commit((state) => addSampleDocuments(state, bearer(request), {
      organizationId,
      sampleIds,
      type,
      documentNumber: typeof documentNumber === 'string' ? documentNumber : '',
      documentDate: typeof documentDate === 'string' ? documentDate : '',
      files,
    }))
  }),
  http.get(`${MOCK_PREFIX}/samples/:sampleId/`, async ({ request, params }) => {
    const ready = await load('samples/:sampleId/')
    if (ready instanceof Response) return ready
    const organizationId = organizationQuery(request)
    const sampleId = pathId(params.sampleId)
    if (organizationId == null) return json({ code: 'invalid_organization' }, 400)
    if (!sampleId) return json({ code: 'invalid_body' }, 400)
    return reply(readSample(ready, bearer(request), organizationId, sampleId))
  }),
  http.get(`${MOCK_PREFIX}/samples/:sampleId/history/`, async ({ request, params }) => {
    const ready = await load('samples/:sampleId/history/')
    if (ready instanceof Response) return ready
    const organizationId = organizationQuery(request)
    const sampleId = pathId(params.sampleId)
    if (organizationId == null) return json({ code: 'invalid_organization' }, 400)
    if (!sampleId) return json({ code: 'invalid_body' }, 400)
    return reply(readSampleHistory(ready, bearer(request), organizationId, sampleId))
  }),
  http.get(`${MOCK_PREFIX}/samples/:sampleId/documents/`, async ({ request, params }) => {
    const ready = await load('samples/:sampleId/documents/')
    if (ready instanceof Response) return ready
    const organizationId = organizationQuery(request)
    const sampleId = pathId(params.sampleId)
    if (organizationId == null) return json({ code: 'invalid_organization' }, 400)
    if (!sampleId) return json({ code: 'invalid_body' }, 400)
    return reply(listSampleDocuments(ready, bearer(request), organizationId, sampleId))
  }),
  http.get(`${MOCK_PREFIX}/samples/:sampleId/documents/:fileId/content/`, async ({ request, params }) => {
    const ready = await load('samples/:sampleId/documents/:fileId/content/')
    if (ready instanceof Response) return ready
    const organizationId = organizationQuery(request)
    const sampleId = pathId(params.sampleId)
    const fileId = pathId(params.fileId)
    if (organizationId == null) return json({ code: 'invalid_organization' }, 400)
    if (!sampleId || !fileId) return json({ code: 'invalid_body' }, 400)
    const result = readSampleDocumentContent(ready, bearer(request), organizationId, sampleId, fileId)
    if (result.status !== 200 || !result.bytes) return reply(result)
    return new HttpResponse(result.bytes, {
      status: 200,
      headers: { 'Content-Type': result.mimeType || 'application/octet-stream' },
    })
  }),
  http.post(`${MOCK_PREFIX}/samples/:sampleId/documents/link/`, async ({ request, params }) => {
    const body = bodyRecord(await readJson(request))
    const sampleId = pathId(params.sampleId)
    const organizationId = body ? organizationIdOf(body.organizationId) : null
    const fileId = body ? requiredString(body, 'fileId') : null
    if (!body || !sampleId || organizationId == null || !fileId) return json({ code: 'invalid_body' }, 400)
    return commit((state) => linkSampleDocument(state, bearer(request), { organizationId, sampleId, fileId }))
  }),
  http.delete(`${MOCK_PREFIX}/samples/:sampleId/documents/:fileId/`, async ({ request, params }) => {
    const ready = await load('samples/:sampleId/documents/:fileId/')
    if (ready instanceof Response) return ready
    const organizationId = organizationQuery(request)
    const sampleId = pathId(params.sampleId)
    const fileId = pathId(params.fileId)
    if (organizationId == null) return json({ code: 'invalid_organization' }, 400)
    if (!sampleId || !fileId) return json({ code: 'invalid_body' }, 400)
    return commit((state) => unlinkSampleDocument(state, bearer(request), { organizationId, sampleId, fileId }))
  }),
  http.patch(`${MOCK_PREFIX}/samples/:sampleId/status/`, async ({ request, params }) => {
    const body = bodyRecord(await readJson(request))
    const sampleId = pathId(params.sampleId)
    const input = body && sampleId ? readStatus(body, sampleId) : null
    if (!input) return json({ code: 'invalid_body' }, 400)
    return commit((state) => changeSampleStatus(state, bearer(request), input))
  }),
  http.patch(`${MOCK_PREFIX}/samples/:sampleId/inspection/`, async ({ request, params }) => {
    const body = bodyRecord(await readJson(request))
    const sampleId = pathId(params.sampleId)
    const input = body && sampleId ? readInspection(body, sampleId) : null
    if (!input) return json({ code: 'invalid_body' }, 400)
    return commit((state) => changeSampleInspection(state, bearer(request), input))
  }),
  http.patch(`${MOCK_PREFIX}/samples/:sampleId/place/`, async ({ request, params }) => {
    const body = bodyRecord(await readJson(request))
    const sampleId = pathId(params.sampleId)
    const input = body && sampleId ? readPlace(body, sampleId) : null
    if (!input) return json({ code: 'invalid_body' }, 400)
    return commit((state) => changeSamplePlace(state, bearer(request), input))
  }),
  http.delete(`${MOCK_PREFIX}/samples/:sampleId/`, async ({ request, params }) => {
    const ready = await load('samples/:sampleId/')
    if (ready instanceof Response) return ready
    const organizationId = organizationQuery(request)
    const sampleId = pathId(params.sampleId)
    if (organizationId == null) return json({ code: 'invalid_organization' }, 400)
    if (!sampleId) return json({ code: 'invalid_body' }, 400)
    return commit((state) => deleteSampleRecord(state, bearer(request), organizationId, sampleId))
  }),
]
