import { describe, expect, it } from 'vitest'
import type { RequestLinkedSample } from '../../../../entities/request'
import { buildSampleTree, flattenSampleTree, type Sample } from '../../../../entities/sample'
import {
  classifyLinkedSample,
  idsOutsideRegistry,
  inspectionWarnings,
  linkedProjectionRecord,
  originMismatchIds,
  resolveRequestSample,
  sampleOriginMismatch,
  sampleRegistryRequest,
  samplesForRequestWarnings,
  samplesKeptForPicker,
  selectableSampleIds,
  selectionHasLineage,
  toggleFoundSamples,
  toggleSampleId,
} from './sample-selection'

const filters = { search: '', stage: '', inspection: '' }

function row(patch: Partial<Sample>): Sample {
  return {
    id: 'sample-1',
    organizationId: 101,
    code: 'PRB-2026-000001',
    kind: 'Керн',
    material: '',
    sampleType: 'Керн',
    field: 'Северное',
    well: '12',
    formation: 'П1',
    interval: '10–20',
    collectedAt: '',
    receivedAt: '2026-11-01',
    container: '',
    quantity: '',
    supplier: '',
    document: '',
    conditions: '',
    location: 'Склад',
    inspection: 'Соответствует',
    inspectionNote: '',
    stage: 'На хранении',
    events: [],
    ...patch,
  }
}

describe('sample selection for a request row', () => {
  it('asks only for the named organization, and only when that registry can be read', () => {
    expect(sampleRegistryRequest({ apiMode: 'mock', organizationId: 101, canRead: true })).toEqual({
      organizationId: 101,
      includeDeleted: true,
    })
    expect(sampleRegistryRequest({ apiMode: 'mock', organizationId: 201, canRead: true })?.organizationId).toBe(201)
    expect(sampleRegistryRequest({ apiMode: 'live', organizationId: 101, canRead: true })).toBeNull()
    expect(sampleRegistryRequest({ apiMode: 'mock', organizationId: 101, canRead: false })).toBeNull()
    expect(sampleRegistryRequest({ apiMode: 'mock', organizationId: null, canRead: true })).toBeNull()
  })

  it('searches and filters without treating request sample types as registry materials', () => {
    const core = row({ id: 'core', code: 'PRB-2026-000001', sampleType: 'Керн' })
    const oil = row({ id: 'oil', code: 'PRB-2026-000002', sampleType: 'Нефть', field: 'Восточное', well: '18' })
    const planned = row({ id: 'plan', code: 'PRB-2026-000003', stage: 'Запланирован отбор', receivedAt: '' })
    const disposed = row({ id: 'gone', code: 'PRB-2026-000004', stage: 'Утилизирована' })
    const deleted = row({ id: 'removed', code: 'PRB-2026-000005', deletedAt: '2026-11-02T00:00:00.000Z' })
    const limited = row({ id: 'limited', code: 'PRB-2026-000006', inspection: 'С ограничениями', inspectionNote: 'Скол' })
    const records = [core, oil, planned, disposed, deleted, limited]
    expect(selectableSampleIds(records, filters).sort()).toEqual(['core', 'limited', 'oil', 'plan'])
    expect(selectableSampleIds(records, { ...filters, search: 'восточное' })).toEqual(['oil'])
    expect(selectableSampleIds(records, { ...filters, search: '000003' })).toEqual(['plan'])
    expect(selectableSampleIds(records, { ...filters, stage: 'Запланирован отбор' })).toEqual(['plan'])
    expect(selectableSampleIds(records, { ...filters, stage: 'Утилизирована' })).toEqual([])
    expect(selectableSampleIds(records, { ...filters, inspection: 'С ограничениями' })).toEqual(['limited'])
  })

  it('selects a parent and a subsample independently, including matches hidden by a collapsed group', () => {
    const parent = row({ id: 'parent', code: 'PRB-2026-000010', stage: 'На хранении' })
    const child = row({ id: 'child', code: 'PRB-2026-000010-01', parentId: 'parent', stage: 'Поступила', interval: '12–13' })
    const records = [parent, child]
    let selected = toggleSampleId([], 'parent')
    selected = toggleSampleId(selected, 'child')
    expect(selected).toEqual(['parent', 'child'])
    expect(toggleSampleId(selected, 'parent')).toEqual(['child'])

    const stage = { ...filters, stage: 'Поступила' }
    expect(selectableSampleIds(records, stage)).toEqual(['child'])
    const tree = buildSampleTree(samplesKeptForPicker(records), [child])
    expect(tree[0]?.matches).toBe(false)
    expect(tree[0]?.children[0]?.matches).toBe(true)
    const collapsed = flattenSampleTree(tree, new Set(), new Set(['parent']), true)
    expect(collapsed.map((item) => item.sample.id)).toEqual(['parent'])
    expect(toggleFoundSamples(['parent'], selectableSampleIds(records, stage))).toEqual(['parent', 'child'])
  })

  it('warns about inspection, lineage and origin, and keeps a missing id', () => {
    const parent = row({ id: 'parent', inspection: 'Не проведён' })
    const child = row({
      id: 'child',
      code: 'PRB-2026-000010-01',
      parentId: 'parent',
      inspection: 'Не соответствует',
      inspectionNote: 'Трещина',
      field: 'Восточное',
      well: '№ 18',
    })
    const limited = row({ id: 'limited', code: 'PRB-2026-000011', inspection: 'С ограничениями', inspectionNote: 'Скол' })
    const disposed = row({ id: 'disposed', stage: 'Утилизирована' })
    const deleted = row({ id: 'deleted', deletedAt: '2026-11-02T00:00:00.000Z', code: 'PRB-2026-000012' })
    const records = [parent, child, limited, disposed, deleted]
    expect(classifyLinkedSample('deleted', records).kind).toBe('deleted')
    expect(classifyLinkedSample('disposed', records).kind).toBe('disposed')
    expect(classifyLinkedSample('missing', records).kind).toBe('missing')
    expect(classifyLinkedSample('parent', records).kind).toBe('ready')
    expect(inspectionWarnings(['parent', 'child', 'limited', 'missing'], records).map((item) => item.inspection)).toEqual([
      'Не проведён',
      'Не соответствует',
      'С ограничениями',
    ])
    expect(inspectionWarnings(['child'], records)[0]?.note).toBe('Трещина')
    expect(selectionHasLineage(['parent', 'child'], records)).toBe(true)
    expect(selectionHasLineage(['child'], records)).toBe(false)
    expect(sampleOriginMismatch(child, [{ field: 'Северное', well: '12' }])).toBe(true)
    expect(sampleOriginMismatch(child, [{ field: 'Восточное', well: '18' }])).toBe(false)
    expect(sampleOriginMismatch(child, [])).toBe(false)
    expect(sampleOriginMismatch({ field: '', well: '18' }, [{ field: 'Северное', well: '12' }])).toBe(false)
    expect(originMismatchIds(['missing', 'child'], records, [{ field: 'Северное', well: '12' }])).toEqual(['child'])
  })

  it('shows a linked projection without opening it or copying the inspection note', () => {
    const own = row({ id: 'own', organizationId: 101, inspectionNote: 'Своё замечание' })
    const linked = projection({ id: 'foreign', organizationId: 201, code: 'PRB-2026-000020' })
    const hiddenParent = projection({ id: 'child', parentId: 'secret-parent', code: 'PRB-2026-000020-01' })
    const withParent = projection({ id: 'child-open', parentId: 'foreign', code: 'PRB-2026-000020-02' })
    expect(idsOutsideRegistry(['own', 'foreign'], ['own'])).toEqual(['foreign'])
    expect(toggleFoundSamples(['foreign', 'own'], ['own'])).toEqual(['foreign'])

    const ownView = resolveRequestSample({
      sampleId: 'own',
      organizationId: 101,
      registryRecords: [own],
      registryPending: false,
      registryFailed: false,
      registryAvailable: true,
      linkedEnabled: true,
      linkedRecords: [linked],
      linkedPending: false,
      linkedFailed: false,
    })
    expect(ownView.kind).toBe('record')
    if (ownView.kind === 'record') {
      expect(ownView.card.openable).toBe(true)
      expect(ownView.card.inspectionNote).toBe('Своё замечание')
    }

    const foreignView = resolveRequestSample({
      sampleId: 'foreign',
      organizationId: 101,
      registryRecords: [own],
      registryPending: false,
      registryFailed: false,
      registryAvailable: true,
      linkedEnabled: true,
      linkedRecords: [linked, hiddenParent],
      linkedPending: false,
      linkedFailed: false,
    })
    expect(foreignView.kind).toBe('record')
    if (foreignView.kind === 'record') {
      expect(foreignView.card.openable).toBe(false)
      expect(foreignView.card.code).toBe('PRB-2026-000020')
      expect(foreignView.card.inspectionNote).toBe('')
      expect(foreignView.card.field).toBe('Северное')
    }

    const warnings = samplesForRequestWarnings([own], [linked])
    expect(inspectionWarnings(['foreign'], warnings)[0]?.note).toBe('')
    expect(classifyLinkedSample('foreign', warnings).kind).toBe('ready')
    expect(linkedProjectionRecord(hiddenParent).parentId).toBe('secret-parent')
    expect(selectionHasLineage(['foreign', 'child-open'], samplesForRequestWarnings([], [linked, withParent]))).toBe(true)
    expect(resolveRequestSample({
      sampleId: 'kept',
      organizationId: 101,
      registryRecords: [own],
      registryPending: false,
      registryFailed: false,
      registryAvailable: true,
      linkedEnabled: true,
      linkedRecords: [],
      linkedPending: false,
      linkedFailed: false,
    }).kind).toBe('missing')
    expect(resolveRequestSample({
      sampleId: 'kept',
      organizationId: 101,
      registryRecords: [],
      registryPending: false,
      registryFailed: false,
      registryAvailable: false,
      linkedEnabled: false,
      linkedRecords: [],
      linkedPending: false,
      linkedFailed: false,
    }).kind).toBe('unresolved')
  })
})

function projection(patch: Partial<RequestLinkedSample> & Pick<RequestLinkedSample, 'id'>): RequestLinkedSample {
  return {
    organizationId: 201,
    code: 'PRB-2026-000020',
    sampleType: 'Керн',
    externalCode: 'A-1',
    field: 'Северное',
    well: '12',
    formation: 'П1',
    interval: '10–20',
    intervalInherited: false,
    stage: 'На хранении',
    inspection: 'С ограничениями',
    deleted: false,
    ...patch,
  }
}
