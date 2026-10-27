import { http, type HttpHandler } from 'msw'
import { bearer, commit, json, load, MOCK_PREFIX, positiveId, readJson, reply } from '../http'
import {
  createField,
  createNode,
  createRecord,
  createTab,
  deleteField,
  deleteNode,
  deleteRecord,
  deleteTab,
  listFields,
  listNodes,
  listTabs,
  readNode,
  updateField,
  updateNode,
  updateRecord,
  updateTabs,
} from './service'

function organizationIdOf(raw: string | readonly string[] | undefined): number | null {
  return positiveId(raw)
}

function optionalQueryId(raw: string | null): number | null | 'invalid' {
  if (raw == null || raw === '') return null
  if (!/^[1-9]\d*$/.test(raw)) return 'invalid'
  const id = Number(raw)
  return Number.isSafeInteger(id) ? id : 'invalid'
}

export const constructorHandlers: HttpHandler[] = [
  http.get(`${MOCK_PREFIX}/organizations/:organizationId/structure-element-group/`, async ({ request, params }) => {
    const ready = await load('organizations/:organizationId/structure-element-group/')
    if (ready instanceof Response) return ready
    const organizationId = organizationIdOf(params.organizationId)
    if (organizationId == null) return json({ code: 'not_found' }, 404)
    return reply(listNodes(ready, bearer(request), organizationId))
  }),

  http.post(`${MOCK_PREFIX}/organizations/:organizationId/structure-element-group/`, async ({ request, params }) => {
    const ready = await load('organizations/:organizationId/structure-element-group/')
    if (ready instanceof Response) return ready
    const organizationId = organizationIdOf(params.organizationId)
    if (organizationId == null) return json({ code: 'not_found' }, 404)
    const body = await readJson(request)
    return commit((state) => createNode(state, bearer(request), organizationId, body))
  }),

  http.get(`${MOCK_PREFIX}/organizations/:organizationId/structure-element-group/:nodeId/`, async ({ request, params }) => {
    const ready = await load('organizations/:organizationId/structure-element-group/:nodeId/')
    if (ready instanceof Response) return ready
    const organizationId = organizationIdOf(params.organizationId)
    const nodeId = positiveId(params.nodeId)
    if (organizationId == null || nodeId == null) return json({ code: 'not_found' }, 404)
    return reply(readNode(ready, bearer(request), organizationId, nodeId))
  }),

  http.patch(`${MOCK_PREFIX}/organizations/:organizationId/structure-element-group/:nodeId/`, async ({ request, params }) => {
    const ready = await load('organizations/:organizationId/structure-element-group/:nodeId/')
    if (ready instanceof Response) return ready
    const organizationId = organizationIdOf(params.organizationId)
    const nodeId = positiveId(params.nodeId)
    if (organizationId == null || nodeId == null) return json({ code: 'not_found' }, 404)
    const body = await readJson(request)
    return commit((state) => updateNode(state, bearer(request), organizationId, nodeId, body))
  }),

  http.delete(`${MOCK_PREFIX}/organizations/:organizationId/structure-element-group/:nodeId/`, async ({ request, params }) => {
    const ready = await load('organizations/:organizationId/structure-element-group/:nodeId/')
    if (ready instanceof Response) return ready
    const organizationId = organizationIdOf(params.organizationId)
    const nodeId = positiveId(params.nodeId)
    if (organizationId == null || nodeId == null) return json({ code: 'not_found' }, 404)
    return commit((state) => deleteNode(state, bearer(request), organizationId, nodeId))
  }),

  http.get(`${MOCK_PREFIX}/organizations/:organizationId/structure-element/`, async ({ request, params }) => {
    const ready = await load('organizations/:organizationId/structure-element/')
    if (ready instanceof Response) return ready
    const organizationId = organizationIdOf(params.organizationId)
    if (organizationId == null) return json({ code: 'not_found' }, 404)
    return reply(listTabs(ready, bearer(request), organizationId))
  }),

  http.post(`${MOCK_PREFIX}/organizations/:organizationId/structure-element/`, async ({ request, params }) => {
    const ready = await load('organizations/:organizationId/structure-element/')
    if (ready instanceof Response) return ready
    const organizationId = organizationIdOf(params.organizationId)
    if (organizationId == null) return json({ code: 'not_found' }, 404)
    const body = await readJson(request)
    return commit((state) => createTab(state, bearer(request), organizationId, body))
  }),

  http.patch(`${MOCK_PREFIX}/organizations/:organizationId/structure-element/multiple-update/`, async ({ request, params }) => {
    const ready = await load('organizations/:organizationId/structure-element/multiple-update/')
    if (ready instanceof Response) return ready
    const organizationId = organizationIdOf(params.organizationId)
    if (organizationId == null) return json({ code: 'not_found' }, 404)
    const body = await readJson(request)
    return commit((state) => updateTabs(state, bearer(request), organizationId, body))
  }),

  http.delete(`${MOCK_PREFIX}/organizations/:organizationId/structure-element/:tabId/`, async ({ request, params }) => {
    const ready = await load('organizations/:organizationId/structure-element/:tabId/')
    if (ready instanceof Response) return ready
    const organizationId = organizationIdOf(params.organizationId)
    const tabId = positiveId(params.tabId)
    if (organizationId == null || tabId == null) return json({ code: 'not_found' }, 404)
    return commit((state) => deleteTab(state, bearer(request), organizationId, tabId))
  }),

  http.get(`${MOCK_PREFIX}/organizations/:organizationId/structure-element-field/`, async ({ request, params }) => {
    const ready = await load('organizations/:organizationId/structure-element-field/')
    if (ready instanceof Response) return ready
    const organizationId = organizationIdOf(params.organizationId)
    if (organizationId == null) return json({ code: 'not_found' }, 404)
    const url = new URL(request.url)
    const group = optionalQueryId(url.searchParams.get('group'))
    const structureElement = optionalQueryId(url.searchParams.get('structure_element'))
    if (group === 'invalid' || structureElement === 'invalid') return json({ code: 'invalid_relation', detail: 'A filter id is not valid. Nothing was returned.' }, 400)
    return reply(listFields(ready, bearer(request), organizationId, { group, structureElement }))
  }),

  http.post(`${MOCK_PREFIX}/organizations/:organizationId/structure-element-field/`, async ({ request, params }) => {
    const ready = await load('organizations/:organizationId/structure-element-field/')
    if (ready instanceof Response) return ready
    const organizationId = organizationIdOf(params.organizationId)
    if (organizationId == null) return json({ code: 'not_found' }, 404)
    const body = await readJson(request)
    return commit((state) => createField(state, bearer(request), organizationId, body))
  }),

  http.patch(`${MOCK_PREFIX}/organizations/:organizationId/structure-element-field/:fieldId/`, async ({ request, params }) => {
    const ready = await load('organizations/:organizationId/structure-element-field/:fieldId/')
    if (ready instanceof Response) return ready
    const organizationId = organizationIdOf(params.organizationId)
    const fieldId = positiveId(params.fieldId)
    if (organizationId == null || fieldId == null) return json({ code: 'not_found' }, 404)
    const body = await readJson(request)
    return commit((state) => updateField(state, bearer(request), organizationId, fieldId, body))
  }),

  http.delete(`${MOCK_PREFIX}/organizations/:organizationId/structure-element-field/:fieldId/`, async ({ request, params }) => {
    const ready = await load('organizations/:organizationId/structure-element-field/:fieldId/')
    if (ready instanceof Response) return ready
    const organizationId = organizationIdOf(params.organizationId)
    const fieldId = positiveId(params.fieldId)
    if (organizationId == null || fieldId == null) return json({ code: 'not_found' }, 404)
    return commit((state) => deleteField(state, bearer(request), organizationId, fieldId))
  }),

  http.post(`${MOCK_PREFIX}/organizations/:organizationId/structure-element-object/`, async ({ request, params }) => {
    const ready = await load('organizations/:organizationId/structure-element-object/')
    if (ready instanceof Response) return ready
    const organizationId = organizationIdOf(params.organizationId)
    if (organizationId == null) return json({ code: 'not_found' }, 404)
    const body = await readJson(request)
    return commit((state) => createRecord(state, bearer(request), organizationId, body))
  }),

  http.patch(`${MOCK_PREFIX}/organizations/:organizationId/structure-element-object/:rowId/`, async ({ request, params }) => {
    const ready = await load('organizations/:organizationId/structure-element-object/:rowId/')
    if (ready instanceof Response) return ready
    const organizationId = organizationIdOf(params.organizationId)
    const rowId = positiveId(params.rowId)
    if (organizationId == null || rowId == null) return json({ code: 'not_found' }, 404)
    const body = await readJson(request)
    return commit((state) => updateRecord(state, bearer(request), organizationId, rowId, body))
  }),

  http.delete(`${MOCK_PREFIX}/organizations/:organizationId/structure-element-object/:rowId/`, async ({ request, params }) => {
    const ready = await load('organizations/:organizationId/structure-element-object/:rowId/')
    if (ready instanceof Response) return ready
    const organizationId = organizationIdOf(params.organizationId)
    const rowId = positiveId(params.rowId)
    if (organizationId == null || rowId == null) return json({ code: 'not_found' }, 404)
    return commit((state) => deleteRecord(state, bearer(request), organizationId, rowId))
  }),
]
