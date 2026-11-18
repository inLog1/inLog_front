import { beforeEach, describe, expect, it } from 'vitest'
import { indexedDB } from 'fake-indexeddb'
import {
  MAX_ATTACHMENT_BYTES,
  MAX_BATCH_BYTES,
  SAMPLE_BATCH_COLUMNS,
  registrationYear,
  sampleBatchTemplateCsv,
  type RegisterSampleInput,
  type Sample,
} from '../../../entities/sample'
import { loginWithPassword } from '../auth/flow'
import { PUBLIC_FIXTURE_PASSWORD, MOCK_SCHEMA_VERSION } from '../db/constants'
import { migrateMockDocument } from '../db/migrate'
import { readMockState, resetMockNamespace, setMockWriterId, updateMockState } from '../db/repository'
import { createSeed } from '../db/seed'
import type { MockState } from '../db/types'
import { withOrganizationAdministrator } from '../organizations/organization-admin-role'
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
  readSampleHistory,
  registerSample,
  registerSampleBatch,
  registerSubsample,
  unlinkSampleDocument,
} from './service'
function session(email: string, state: MockState = createSeed()) {
  const login = loginWithPassword(state, email, PUBLIC_FIXTURE_PASSWORD)
  const token = (login.body as { access_token?: string }).access_token ?? ''
  return { state: login.state, token }
}

function codeOf(result: { body: unknown }) {
  return (result.body as { code?: string }).code
}

function sampleOf(result: { body: unknown }) {
  return (result.body as { sample: Sample }).sample
}

function samplesOf(result: { body: unknown }) {
  return (result.body as { samples: Sample[] }).samples
}

function root(overrides: Partial<RegisterSampleInput> = {}): RegisterSampleInput {
  return {
    organizationId: 101,
    sampleType: 'Керн',
    field: 'Северное',
    well: '101',
    interval: '1138–1150',
    collectedAt: '2026-09-12',
    receivedAt: '2026-11-17',
    location: 'Склад',
    ...overrides,
  }
}

function line(overrides: Record<string, string> = {}) {
  const fields: Record<string, string> = {
    kind: 'Вода',
    material: 'Пластовая вода',
    field: 'Северное',
    well: '001',
    receivedAt: '17.11.2026',
    location: 'Склад',
    ...overrides,
  }
  return SAMPLE_BATCH_COLUMNS.map(([key]) => fields[key] ?? '').join(';')
}

function csv(...lines: string[]) {
  return sampleBatchTemplateCsv() + lines.join('\r\n')
}

describe('sample mock storage', () => {
  beforeEach(() => {
    globalThis.indexedDB = indexedDB
    setMockWriterId(`samples-${crypto.randomUUID()}`)
  })

  it('migrates an existing database without dropping requests, users, sessions or organizations', () => {
    const seed = createSeed()
    const legacy: MockState = {
      ...seed,
      schemaVersion: 15,
      samples: undefined,
      sampleAttachments: undefined,
      sampleCodeCounters: undefined,
      sessions: [{ id: 'kept-session', userId: 2, accessToken: 'kept-token', refreshToken: 'kept-refresh' }],
    }
    const migrated = migrateMockDocument(legacy)
    expect(migrated?.changed).toBe(true)
    expect(migrated?.state.schemaVersion).toBe(MOCK_SCHEMA_VERSION)
    expect(migrated?.state.requests).toEqual(seed.requests)
    expect(migrated?.state.users).toEqual(seed.users)
    expect(migrated?.state.organizations).toEqual(seed.organizations)
    expect(migrated?.state.sessions).toEqual(legacy.sessions)
    expect(migrated?.state.samples).toEqual([])
    expect(migrated?.state.sampleAttachments).toEqual([])
    expect(migrated?.state.sampleCodeCounters).toEqual({})
    const again = migrated && migrateMockDocument(migrated.state)
    expect(again?.changed).toBe(false)
    expect(again?.state.requests).toEqual(seed.requests)
  })

  it('keeps samples and counters that were already stored', () => {
    const seed = createSeed()
    const stored: Sample = {
      id: 'kept-sample',
      organizationId: 101,
      code: 'PRB-2024-000004',
      kind: 'Керн',
      material: '',
      sampleType: 'Керн',
      field: 'Старое',
      well: '1',
      formation: '',
      interval: '',
      collectedAt: '',
      receivedAt: '2024-01-02',
      container: '',
      quantity: '',
      supplier: '',
      document: '',
      conditions: '',
      location: 'Архив',
      inspection: 'Не проведён',
      inspectionNote: '',
      events: [{ at: '2024-01-02T00:00:00.000Z', text: 'Зарегистрировано поступление' }],
    }
    const legacy: MockState = {
      ...seed,
      schemaVersion: 15,
      samples: [stored],
      sampleAttachments: [],
      sampleCodeCounters: { 2024: 4 },
    }
    const migrated = migrateMockDocument(legacy)
    expect(migrated?.state.samples).toEqual([stored])
    expect(migrated?.state.sampleCodeCounters).toEqual({ 2024: 4 })
    expect(migrated?.state.requests).toEqual(seed.requests)
    expect(migrateMockDocument(migrated!.state)?.changed).toBe(false)
  })

  it('resets the namespace onto the new empty registry and leaves another namespace alone', async () => {
    const target = `inlog:mock:samples-reset-${crypto.randomUUID()}`
    const kept = `inlog:mock:samples-kept-${crypto.randomUUID()}`
    const admin = session('admin.a@example.test')
    await updateMockState(() => admin.state, target)
    await updateMockState((state) => registerSample(state, admin.token, root()).state, target)
    await updateMockState((state) => ({ ...state, accessVersion: 4 }), kept)
    const before = await readMockState(target)
    expect(before.ok && before.state.samples).toHaveLength(1)
    const reset = await resetMockNamespace(target)
    const other = await readMockState(kept)
    expect(reset.schemaVersion).toBe(MOCK_SCHEMA_VERSION)
    expect(reset.samples).toEqual([])
    expect(reset.sampleAttachments).toEqual([])
    expect(reset.sampleCodeCounters).toEqual({})
    expect(reset.requests).toEqual(createSeed().requests)
    expect(reset.users.map((user) => user.id)).toEqual(createSeed().users.map((user) => user.id))
    expect(other.ok && other.state.accessVersion).toBe(4)
    expect(other.ok && other.state.samples).toEqual([])
  })
})

describe('sample mock service', () => {
  beforeEach(() => {
    globalThis.indexedDB = indexedDB
    setMockWriterId(`samples-${crypto.randomUUID()}`)
  })

  it('registers a root sample and does not reuse a deleted number', () => {
    const admin = session('admin.a@example.test')
    const requests = admin.state.requests
    const created = registerSample(admin.state, admin.token, root())
    expect(created.status).toBe(201)
    const sample = sampleOf(created)
    const year = registrationYear(sample.events[0].at)
    expect(sample.code).toBe(`PRB-${year}-000001`)
    expect(sample.id).not.toBe(sample.code)
    expect(sample.organizationId).toBe(101)
    expect(sample.events[0].actor).toBe('Лебедев Борис Ильич')
    expect(created.state.requests).toBe(requests)
    const removed = deleteSampleRecord(created.state, admin.token, 101, sample.id)
    expect(removed.status).toBe(200)
    expect(sampleOf(removed).deletedAt).toBeTruthy()
    const next = registerSample(removed.state, admin.token, root({ well: '102' }))
    expect(sampleOf(next).code).toBe(`PRB-${year}-000002`)
    expect(listSamples(next.state, admin.token, 101).body).toMatchObject({
      organizationKind: 'laboratory',
      samples: [expect.objectContaining({ id: sampleOf(next).id })],
    })
    expect(samplesOf(listSamples(next.state, admin.token, 101, { includeDeleted: true })).map((item) => item.id).sort())
      .toEqual([sample.id, sampleOf(next).id].sort())
  })

  it('registers a subsample, keeps inherited origin, and allows its own interval', () => {
    const admin = session('admin.a@example.test')
    const created = registerSample(admin.state, admin.token, root())
    const parent = sampleOf(created)
    const substituted = registerSubsample(created.state, admin.token, {
      organizationId: 101,
      parentId: parent.id,
      field: 'Другое',
      receivedAt: '2026-11-17',
      location: 'Стол 1',
    })
    expect(substituted.status).toBe(400)
    expect(codeOf(substituted)).toBe('inherited_mismatch')
    expect(substituted.state.samples).toEqual(created.state.samples)
    const child = registerSubsample(created.state, admin.token, {
      organizationId: 101,
      parentId: parent.id,
      receivedAt: '2026-11-17',
      location: 'Стол 1',
      subsampleInterval: '1140–1141',
    })
    expect(child.status).toBe(201)
    const registered = sampleOf(child)
    expect(registered.code).toBe(`${parent.code}-01`)
    expect(registered.parentId).toBe(parent.id)
    expect(registered.sampleType).toBe('Керн')
    expect(registered.field).toBe(parent.field)
    expect(registered.well).toBe(parent.well)
    expect(registered.interval).toBe(parent.interval)
    expect(registered.collectedAt).toBe(parent.collectedAt)
    expect(registered.subsampleInterval).toBe('1140–1141')
    const nested = registerSubsample(child.state, admin.token, {
      organizationId: 101,
      parentId: registered.id,
      receivedAt: '2026-11-18',
      location: 'Стол 2',
    })
    expect(sampleOf(nested).code).toBe(`${registered.code}-01`)
    const removedChild = deleteSampleRecord(nested.state, admin.token, 101, registered.id)
    expect(removedChild.status).toBe(409)
    expect(codeOf(removedChild)).toBe('has_children')
    const withoutNested = deleteSampleRecord(nested.state, admin.token, 101, sampleOf(nested).id)
    const withoutChild = deleteSampleRecord(withoutNested.state, admin.token, 101, registered.id)
    expect(withoutChild.status).toBe(200)
    const sibling = registerSubsample(withoutChild.state, admin.token, {
      organizationId: 101,
      parentId: parent.id,
      receivedAt: '2026-11-18',
      location: 'Стол 3',
    })
    expect(sampleOf(sibling).code).toBe(`${parent.code}-02`)
  })

  it('rejects a missing, foreign, disposed or cyclic parent', () => {
    const admin = session('admin.a@example.test')
    const created = registerSample(admin.state, admin.token, root())
    const parent = sampleOf(created)
    expect(registerSubsample(created.state, admin.token, {
      organizationId: 101,
      parentId: 'missing',
      receivedAt: '2026-11-17',
      location: 'Стол',
    }).status).toBe(400)
    const customer = session('customer@example.test', created.state)
    expect(codeOf(registerSubsample(customer.state, customer.token, {
      organizationId: 201,
      parentId: parent.id,
      receivedAt: '2026-11-17',
      location: 'Стол',
    }))).toBe('invalid_parent')
    const disposed: MockState = {
      ...created.state,
      samples: created.state.samples?.map((item) => item.id === parent.id ? { ...item, stage: 'Утилизирована' } : item),
    }
    expect(codeOf(registerSubsample(disposed, admin.token, {
      organizationId: 101,
      parentId: parent.id,
      receivedAt: '2026-11-17',
      location: 'Стол',
    }))).toBe('invalid_parent')
    const cyclic: MockState = {
      ...created.state,
      samples: created.state.samples?.map((item) => item.id === parent.id ? { ...item, parentId: parent.id } : item),
    }
    expect(codeOf(registerSubsample(cyclic, admin.token, {
      organizationId: 101,
      parentId: parent.id,
      receivedAt: '2026-11-17',
      location: 'Стол',
    }))).toBe('invalid_parent')
    expect(cyclic.samples).toHaveLength(1)
  })

  it('saves a batch in one result and saves nothing when one row fails', () => {
    const admin = session('admin.a@example.test')
    const requests = admin.state.requests
    const broken = registerSampleBatch(admin.state, admin.token, {
      organizationId: 101,
      csv: csv(line({ code: 'A-1' }), line({ code: 'A-2', receivedAt: '31.02.2026', location: '' })),
    })
    expect(broken.status).toBe(400)
    expect(codeOf(broken)).toBe('invalid_batch')
    expect(broken.state.samples).toEqual([])
    expect(broken.state.sampleCodeCounters).toEqual({})
    expect(broken.state.requests).toBe(requests)
    const duplicate = registerSampleBatch(admin.state, admin.token, {
      organizationId: 101,
      csv: csv(line({ code: 'SAME' }), line({ code: 'SAME' })),
    })
    expect(duplicate.status).toBe(400)
    expect(duplicate.state.samples).toEqual([])
    const saved = registerSampleBatch(admin.state, admin.token, {
      organizationId: 101,
      csv: csv(line({ code: 'B-1', well: '001' }), line({ code: 'B-2', well: '002' })),
    })
    expect(saved.status).toBe(201)
    const created = samplesOf(saved)
    expect(created).toHaveLength(2)
    const year = registrationYear(created[0].events[0].at)
    expect(created.map((item) => item.code)).toEqual([`PRB-${year}-000001`, `PRB-${year}-000002`])
    expect(new Set(created.map((item) => item.id)).size).toBe(2)
    expect(saved.state.requests).toBe(requests)
    const parentCode = created[0].code
    const child = registerSampleBatch(saved.state, admin.token, {
      organizationId: 101,
      csv: csv(line({ parentCode, kind: '', field: '', well: '', subsampleInterval: '1–2' })),
    })
    expect(child.status).toBe(201)
    expect(samplesOf(child)[0].code).toBe(`${parentCode}-01`)
    expect(samplesOf(child)[0].parentId).toBe(created[0].id)
    const oversized = registerSampleBatch(saved.state, admin.token, {
      organizationId: 101,
      csv: 'x'.repeat(MAX_BATCH_BYTES + 1),
    })
    expect(codeOf(oversized)).toBe('file_size')
    expect(oversized.state.samples).toHaveLength(2)
  })

  it('issues different numbers for overlapping registrations', async () => {
    const namespace = `inlog:mock:samples-parallel-${crypto.randomUUID()}`
    const admin = session('admin.a@example.test')
    await updateMockState(() => admin.state, namespace)
    await Promise.all([
      updateMockState((state) => {
        const result = registerSample(state, admin.token, root({ well: '1', field: 'Первое' }))
        if (result.status !== 201) throw new Error(codeOf(result) ?? 'first failed')
        return result.state
      }, namespace),
      updateMockState((state) => {
        const result = registerSample(state, admin.token, root({ well: '2', field: 'Второе' }))
        if (result.status !== 201) throw new Error(codeOf(result) ?? 'second failed')
        return result.state
      }, namespace),
    ])
    const opened = await readMockState(namespace)
    expect(opened.ok).toBe(true)
    if (!opened.ok) return
    const codes = (opened.state.samples ?? []).map((item) => item.code).sort()
    const year = registrationYear((opened.state.samples ?? [])[0].events[0].at)
    expect(codes).toEqual([`PRB-${year}-000001`, `PRB-${year}-000002`])
    expect(new Set((opened.state.samples ?? []).map((item) => item.id)).size).toBe(2)
  })

  it('keeps each organization on its own samples and grants', () => {
    const laboratory = session('admin.a@example.test')
    const created = registerSample(laboratory.state, laboratory.token, root())
    const sample = sampleOf(created)
    const customer = session('customer@example.test', created.state)
    const own = registerSample(customer.state, customer.token, root({ organizationId: 201, field: 'Южное', sampleType: 'Вода' }))
    expect(own.status).toBe(201)
    expect(sampleOf(own).organizationId).toBe(201)
    expect(listSamples(own.state, laboratory.token, 101).status).toBe(200)
    expect(samplesOf(listSamples(own.state, laboratory.token, 101)).map((item) => item.id)).toEqual([sample.id])
    expect(listSamples(own.state, laboratory.token, 201).status).toBe(403)
    expect(listSamples(own.state, customer.token, 101).status).toBe(403)
    expect(listSamples(own.state, customer.token, 101, { includeDeleted: true }).status).toBe(403)
    expect(samplesOf(listSamples(own.state, laboratory.token, 101, { includeDeleted: true })).every((item) => item.organizationId === 101)).toBe(true)
    expect(samplesOf(listSamples(own.state, customer.token, 201)).map((item) => item.id)).toEqual([sampleOf(own).id])
    expect(readSample(own.state, customer.token, 201, sample.id).status).toBe(404)
    const projectOnly = session('project.only@example.test', own.state)
    expect(listSamples(projectOnly.state, projectOnly.token, 101).status).toBe(403)
    const employee = session('employee.a@example.test', own.state)
    expect(registerSample(employee.state, employee.token, root()).status).toBe(403)
    expect(changeSampleStatus(employee.state, employee.token, {
      organizationId: 101,
      sampleId: sample.id,
      stage: 'На хранении',
    }).status).toBe(403)
    const renamed: MockState = {
      ...employee.state,
      roles: employee.state.roles.map((role) => role.id === 'role-employee'
        ? { ...role, displayName: 'Администратор организации' }
        : role),
    }
    expect(listSamples(renamed, employee.token, 101).status).toBe(403)
  })

  it('lets a new organization administrator and the installation superadmin use the registry', () => {
    const seed = createSeed()
    const organization = {
      id: 301,
      corporationId: 1,
      kind: 'customer' as const,
      fullName: 'Новый заказчик',
      shortName: 'НЗ',
      address: 'Офис',
      revision: 1,
    }
    const withRole = withOrganizationAdministrator({
      ...seed,
      organizations: [...seed.organizations, organization],
      memberships: [...seed.memberships, { id: 'mem-6-301', userId: 6, organizationId: 301, kind: 'customer' }],
    }, organization, 1)
    expect(withRole).not.toBeNull()
    const role = withRole!.roles.find((item) =>
      item.origin?.template === 'organization-administrator'
      && item.ownerScope?.type === 'organization'
      && item.ownerScope.organizationId === 301)
    const state: MockState = {
      ...withRole!,
      assignments: [...withRole!.assignments, {
        id: 'asg-new-admin',
        userId: 6,
        roleId: role!.id,
        scope: { type: 'organization', organizationId: 301, corporationId: 1 },
      }],
    }
    const admin = session('pending@example.test', state)
    const created = registerSample(admin.state, admin.token, root({ organizationId: 301, sampleType: 'Газ', field: 'Восточное', well: '7' }))
    expect(created.status).toBe(201)
    expect(sampleOf(created).organizationId).toBe(301)
    expect(listSamples(created.state, admin.token, 101).status).toBe(403)
    const owner = session('owner@example.test', created.state)
    expect(listSamples(owner.state, owner.token, 301).status).toBe(200)
    expect(listSamples(owner.state, owner.token, 102).status).toBe(200)
    const abroad = registerSample(owner.state, owner.token, root({ organizationId: 102, well: '9' }))
    expect(abroad.status).toBe(201)
    expect(sampleOf(abroad).organizationId).toBe(102)
    expect(samplesOf(listSamples(abroad.state, admin.token, 301)).some((item) => item.organizationId === 102)).toBe(false)
  })

  it('records status, receipt, inspection and place on the sample history', async () => {
    const namespace = `inlog:mock:samples-history-${crypto.randomUUID()}`
    const admin = session('admin.a@example.test')
    const planned = registerSample(admin.state, admin.token, root({
      stage: 'Запланирован отбор',
      receivedAt: '',
      location: '',
    }))
    const sampleId = sampleOf(planned).id
    const early = changeSampleStatus(planned.state, admin.token, {
      organizationId: 101,
      sampleId,
      stage: 'Поступила',
      location: 'Зона приёмки',
    })
    expect(codeOf(early)).toBe('received_at_required')
    expect(early.state.samples?.find((item) => item.id === sampleId)?.stage).toBe('Запланирован отбор')
    const received = changeSampleStatus(planned.state, admin.token, {
      organizationId: 101,
      sampleId,
      stage: 'Поступила',
      location: 'Зона приёмки',
      receivedAt: '2026-11-17',
    })
    expect(received.status).toBe(200)
    expect(sampleOf(received)).toMatchObject({ stage: 'Поступила', receivedAt: '2026-11-17', location: 'Зона приёмки' })
    const missingNote = changeSampleInspection(received.state, admin.token, {
      organizationId: 101,
      sampleId,
      inspection: 'Не соответствует',
      inspectionNote: ' ',
    })
    expect(codeOf(missingNote)).toBe('note_required')
    const inspected = changeSampleInspection(received.state, admin.token, {
      organizationId: 101,
      sampleId,
      inspection: 'С ограничениями',
      inspectionNote: 'Трещина тары',
    })
    const moved = changeSamplePlace(inspected.state, admin.token, {
      organizationId: 101,
      sampleId,
      location: 'Стеллаж Б',
      receivedAt: '2026-11-18',
    })
    const stored = changeSampleStatus(moved.state, admin.token, {
      organizationId: 101,
      sampleId,
      stage: 'На хранении',
    })
    const texts = sampleOf(stored).events.map((event) => event.text)
    expect(texts.some((text) => text.includes('Дата поступления'))).toBe(true)
    expect(texts.some((text) => text.includes('Статус:'))).toBe(true)
    expect(texts.some((text) => text.includes('Входной контроль:'))).toBe(true)
    expect(texts.some((text) => text.includes('Местонахождение:'))).toBe(true)
    expect(sampleOf(stored).events.every((event) => event.actor === 'Лебедев Борис Ильич' && event.at)).toBe(true)
    const history = readSampleHistory(stored.state, admin.token, 101, sampleId)
    expect(history.status).toBe(200)
    expect((history.body as { events: Sample['events'] }).events).toEqual(sampleOf(stored).events)
    await updateMockState(() => stored.state, namespace)
    const opened = await readMockState(namespace)
    expect(opened.ok).toBe(true)
    if (!opened.ok) return
    expect(opened.state.samples?.find((item) => item.id === sampleId)?.events).toEqual(sampleOf(stored).events)
    expect(opened.state.requests).toEqual(stored.state.requests)
  })

  it('shares one document across samples and keeps the other link after unlinking', () => {
    const admin = session('admin.a@example.test')
    const first = registerSample(admin.state, admin.token, root({ well: '1' }))
    const second = registerSample(first.state, admin.token, root({ well: '2' }))
    const left = sampleOf(first).id
    const right = sampleOf(second).id
    const bytes = new Uint8Array([7, 8, 9])
    const added = addSampleDocuments(second.state, admin.token, {
      organizationId: 101,
      sampleIds: [left, right],
      type: 'Акт приёма-передачи',
      documentNumber: '14',
      documentDate: '2026-11-17',
      files: [{ filename: 'act.pdf', mimeType: 'application/pdf', bytes }],
    })
    expect(added.status).toBe(201)
    const fileId = (added.body as { documents: Array<{ id: string; sampleIds: string[] }> }).documents[0].id
    expect(added.state.sampleAttachments).toHaveLength(1)
    expect(added.state.sampleAttachments?.[0].sampleIds).toEqual([left, right])
    expect(Array.from(added.state.sampleAttachments?.[0].bytes ?? [])).toEqual([7, 8, 9])
    const listed = listSampleDocuments(added.state, admin.token, 101, right)
    expect(listed.status).toBe(200)
    const linked = linkSampleDocument(added.state, admin.token, { organizationId: 101, sampleId: right, fileId })
    expect(linked.status).toBe(200)
    expect(linked.state.sampleAttachments).toHaveLength(1)
    const unlinked = unlinkSampleDocument(added.state, admin.token, { organizationId: 101, sampleId: left, fileId })
    expect(unlinked.status).toBe(200)
    expect(unlinked.state.sampleAttachments).toHaveLength(1)
    expect(unlinked.state.sampleAttachments?.[0].sampleIds).toEqual([right])
    expect(Array.from(unlinked.state.sampleAttachments?.[0].bytes ?? [])).toEqual([7, 8, 9])
    const texts = unlinked.state.samples?.find((item) => item.id === left)?.events.map((event) => event.text) ?? []
    expect(texts.some((text) => text.includes('Убран файл'))).toBe(true)
    expect(unlinked.state.samples?.find((item) => item.id === right)?.events.some((event) => event.text.includes('Добавлен файл'))).toBe(true)
    const rejected = addSampleDocuments(unlinked.state, admin.token, {
      organizationId: 101,
      sampleIds: [right],
      type: 'Фото входного контроля',
      files: [{ filename: 'act.pdf', mimeType: 'application/pdf', bytes }],
    })
    expect(codeOf(rejected)).toBe('invalid_file')
    expect(rejected.state.sampleAttachments).toHaveLength(1)
    const huge = new Uint8Array(MAX_ATTACHMENT_BYTES + 1)
    const oversized = addSampleDocuments(unlinked.state, admin.token, {
      organizationId: 101,
      sampleIds: [right],
      type: 'Сопроводительный документ',
      files: [{ filename: 'note.pdf', mimeType: 'application/pdf', bytes: huge }],
    })
    expect(codeOf(oversized)).toBe('file_size')
    const removed = deleteSampleRecord(unlinked.state, admin.token, 101, right)
    expect(removed.status).toBe(200)
    expect(removed.state.sampleAttachments).toHaveLength(1)
    expect(removed.state.sampleAttachments?.[0].sampleIds).toEqual([right])
  })
})
