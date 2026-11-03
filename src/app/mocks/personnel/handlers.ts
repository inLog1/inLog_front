import { http, type HttpHandler } from 'msw'
import { bearer, commit, json, load, MOCK_PREFIX, positiveId, readJson, reply } from '../http'
import { agreedOrganization } from './gate'
import {
  archiveDirectoryRecord,
  createDirectoryRecord,
  deleteDirectoryRecord,
  initializeWorkspace,
  listDirectories,
  readDirectory,
  updateDirectoryDefinition,
  updateDirectoryRecord,
} from './directories'
import {
  archiveEmployee,
  createEmployee,
  linkEmployeeAccount,
  listEmployees,
  listLinkableAccounts,
  readEmployee,
  readPersonnelConfig,
  updateEmployee,
  updatePersonnelConfig,
} from './employees'
import { readCorporateOverview } from './overview'

function organizationQuery(request: Request): number | null {
  return positiveId(new URL(request.url).searchParams.get('organization') ?? undefined)
}

function revisionQuery(request: Request): number | null {
  const value = new URL(request.url).searchParams.get('expectedRevision')
  if (!value || !/^[1-9]\d*$/.test(value)) return null
  return Number(value)
}

export const personnelHandlers: HttpHandler[] = [
  http.get(`${MOCK_PREFIX}/directories/`, async ({ request }) => {
    const ready = await load('directories/')
    if (ready instanceof Response) return ready
    const organizationId = organizationQuery(request)
    if (organizationId == null) return json({ code: 'invalid_organization' }, 400)
    return reply(listDirectories(ready, bearer(request), organizationId))
  }),
  http.post(`${MOCK_PREFIX}/personnel/workspace/`, async ({ request }) => {
    const body = await readJson(request)
    const organizationId = typeof body.organizationId === 'number' ? body.organizationId : 0
    return commit((state) => initializeWorkspace(state, bearer(request), organizationId))
  }),
  http.get(`${MOCK_PREFIX}/directories/:directoryId/`, async ({ request, params }) => {
    const ready = await load('directories/:directoryId/')
    if (ready instanceof Response) return ready
    const organizationId = organizationQuery(request)
    if (organizationId == null) return json({ code: 'invalid_organization' }, 400)
    return reply(readDirectory(ready, bearer(request), organizationId, String(params.directoryId)))
  }),
  http.patch(`${MOCK_PREFIX}/directories/:directoryId/`, async ({ request, params }) => {
    const body = await readJson(request)
    return commit((state) => updateDirectoryDefinition(state, bearer(request), String(params.directoryId), body))
  }),
  http.post(`${MOCK_PREFIX}/directories/:directoryId/records/`, async ({ request, params }) => {
    const body = await readJson(request)
    return commit((state) => createDirectoryRecord(state, bearer(request), String(params.directoryId), body))
  }),
  http.patch(`${MOCK_PREFIX}/directories/:directoryId/records/:recordId/`, async ({ request, params }) => {
    const body = await readJson(request)
    return commit((state) => updateDirectoryRecord(state, bearer(request), String(params.directoryId), String(params.recordId), body))
  }),
  http.post(`${MOCK_PREFIX}/directories/:directoryId/records/:recordId/archive/`, async ({ request, params }) => {
    const body = await readJson(request)
    return commit((state) => archiveDirectoryRecord(state, bearer(request), String(params.directoryId), String(params.recordId), body))
  }),
  http.delete(`${MOCK_PREFIX}/directories/:directoryId/records/:recordId/`, async ({ request, params }) => {
    const ready = await load('directories/:directoryId/records/:recordId/')
    if (ready instanceof Response) return ready
    const organizationId = organizationQuery(request)
    if (organizationId == null) return json({ code: 'invalid_organization' }, 400)
    return commit((state) => deleteDirectoryRecord(
      state,
      bearer(request),
      organizationId,
      String(params.directoryId),
      String(params.recordId),
      revisionQuery(request),
    ))
  }),
  http.get(`${MOCK_PREFIX}/personnel/config/`, async ({ request }) => {
    const ready = await load('personnel/config/')
    if (ready instanceof Response) return ready
    const organizationId = organizationQuery(request)
    if (organizationId == null) return json({ code: 'invalid_organization' }, 400)
    return reply(readPersonnelConfig(ready, bearer(request), organizationId))
  }),
  http.put(`${MOCK_PREFIX}/personnel/config/`, async ({ request }) => {
    const body = await readJson(request)
    return commit((state) => updatePersonnelConfig(state, bearer(request), body))
  }),
  http.get(`${MOCK_PREFIX}/personnel/overview/`, async ({ request }) => {
    const ready = await load('personnel/overview/')
    if (ready instanceof Response) return ready
    return reply(readCorporateOverview(ready, bearer(request)))
  }),
  http.get(`${MOCK_PREFIX}/personnel/employees/`, async ({ request }) => {
    const ready = await load('personnel/employees/')
    if (ready instanceof Response) return ready
    const organizationId = organizationQuery(request)
    if (organizationId == null) return json({ code: 'invalid_organization' }, 400)
    const url = new URL(request.url)
    const archived = url.searchParams.get('archived') === '1'
    return reply(listEmployees(ready, bearer(request), organizationId, archived, url.searchParams.get('q') ?? ''))
  }),
  http.post(`${MOCK_PREFIX}/personnel/employees/`, async ({ request }) => {
    const body = await readJson(request)
    const queryId = organizationQuery(request)
    const agreed = agreedOrganization(queryId, body.organizationId)
    if (agreed === 'mismatch') return json({ code: 'invalid_scope' }, 400)
    return commit((state) => createEmployee(state, bearer(request), body))
  }),
  http.get(`${MOCK_PREFIX}/personnel/employees/:employeeId/`, async ({ request, params }) => {
    const ready = await load('personnel/employees/:employeeId/')
    if (ready instanceof Response) return ready
    const organizationId = organizationQuery(request)
    if (organizationId == null) return json({ code: 'invalid_organization' }, 400)
    return reply(readEmployee(ready, bearer(request), organizationId, String(params.employeeId)))
  }),
  http.put(`${MOCK_PREFIX}/personnel/employees/:employeeId/`, async ({ request, params }) => {
    const body = await readJson(request)
    const agreed = agreedOrganization(organizationQuery(request), body.organizationId)
    if (agreed === 'mismatch') return json({ code: 'invalid_scope' }, 400)
    return commit((state) => updateEmployee(state, bearer(request), String(params.employeeId), body))
  }),
  http.post(`${MOCK_PREFIX}/personnel/employees/:employeeId/archive/`, async ({ request, params }) => {
    const body = await readJson(request)
    return commit((state) => archiveEmployee(state, bearer(request), String(params.employeeId), body))
  }),
  http.post(`${MOCK_PREFIX}/personnel/employees/:employeeId/account/`, async ({ request, params }) => {
    const body = await readJson(request)
    return commit((state) => linkEmployeeAccount(state, bearer(request), String(params.employeeId), body))
  }),
  http.get(`${MOCK_PREFIX}/personnel/accounts/`, async ({ request }) => {
    const ready = await load('personnel/accounts/')
    if (ready instanceof Response) return ready
    const organizationId = organizationQuery(request)
    if (organizationId == null) return json({ code: 'invalid_organization' }, 400)
    return reply(listLinkableAccounts(ready, bearer(request), organizationId))
  }),
]
