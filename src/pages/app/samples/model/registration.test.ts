import { describe, expect, it } from 'vitest'
import { makeSample } from '../../../../entities/sample/model/fixture'
import {
  applyInitialParent,
  continueRegistrationDraft,
  emptyRegistrationDraft,
  prepareRegistration,
  registrationChanged,
  registrationFailure,
  registrationParentHref,
  registrationRequest,
  registrationWithStage,
  resolveRegistrationParent,
  resolveRegistrationParentById,
} from './registration'

function receivedDraft() {
  return {
    ...emptyRegistrationDraft(),
    sampleType: 'Керн',
    field: 'Северное',
    well: '№ 101',
    receivedAt: '2026-11-01',
    place: { choice: 'intake', other: '', details: 'А-2' },
    container: 'Ящик 1',
    quantity: '2 м',
    externalCode: 'SRC-9',
    conditions: 'Сухой отбор',
    supplier: 'Партия',
    material: 'Полноразмерный',
    formation: 'П1',
    interval: '10–12',
    collectedAt: '2026-10-01',
  }
}

describe('manual sample registration', () => {
  it('requires type, field and well, then receipt date and place for a received sample', () => {
    const empty = prepareRegistration(101, emptyRegistrationDraft(), [])
    expect(empty.ok).toBe(false)
    if (!empty.ok) expect(empty.issues.map((issue) => issue.field)).toEqual(['sampleType', 'field', 'well', 'receivedAt', 'location'])
  })

  it('does not require a receipt date or a place for a planned sample and does not invent them', () => {
    const draft = registrationWithStage({
      ...emptyRegistrationDraft(),
      sampleType: 'Вода',
      field: 'Южное',
      well: '7',
      receivedAt: '2026-11-02',
      place: { choice: '__none__', other: '', details: '' },
      container: 'Бутыль',
    }, 'Запланирован отбор')
    const prepared = prepareRegistration(101, draft, [])
    expect(prepared.ok).toBe(true)
    if (!prepared.ok || prepared.request.kind !== 'sample') return
    expect(prepared.request.body.receivedAt).toBeUndefined()
    expect(prepared.request.body.location).toBeUndefined()
    expect(prepared.request.body.stage).toBe('Запланирован отбор')
    expect(prepared.request.body.inspection).toBe('Не проведён')
    expect(prepared.request.body.organizationId).toBe(101)
    expect(prepared.request.body.well).toBe('7')
    expect('code' in prepared.request.body).toBe(false)
    const kept = registrationWithStage(draft, 'Поступила')
    expect(kept.container).toBe('Бутыль')
    expect(kept.receivedAt).toBe('2026-11-02')
    expect(kept.place.choice).toBe('__none__')
  })

  it('strips a well mark and keeps the organization passed by the screen', () => {
    const prepared = prepareRegistration(202, receivedDraft(), [])
    expect(prepared.ok).toBe(true)
    if (!prepared.ok || prepared.request.kind !== 'sample') return
    expect(prepared.request.body.organizationId).toBe(202)
    expect(prepared.request.body.well).toBe('101')
    expect(prepared.request.body.location).toBe('Зона приёмки проб, А-2')
  })

  it('keeps shared values and clears only the individual fields for the next sample', () => {
    const next = continueRegistrationDraft(receivedDraft())
    expect(next.externalCode).toBe('')
    expect(next.container).toBe('')
    expect(next.quantity).toBe('')
    expect(next.conditions).toBe('')
    expect(next.subsampleInterval).toBe('')
    expect(next.sampleType).toBe('Керн')
    expect(next.field).toBe('Северное')
    expect(next.well).toBe('№ 101')
    expect(next.interval).toBe('10–12')
    expect(next.supplier).toBe('Партия')
    expect(next.place.details).toBe('А-2')
    expect(registrationChanged(next, receivedDraft())).toBe(true)
    expect(registrationChanged(next, next)).toBe(false)
  })

  it('rejects a missing, foreign, deleted, disposed or untyped parent and accepts one from this organization', () => {
    const parent = makeSample({ id: 'parent', organizationId: 101, code: 'PRB-2026-000010' })
    const records = [
      parent,
      makeSample({ id: 'other', organizationId: 202, code: 'PRB-2026-000099' }),
      makeSample({ id: 'gone', organizationId: 101, code: 'PRB-2026-000011', deletedAt: '2026-01-01T00:00:00Z' }),
      makeSample({ id: 'spent', organizationId: 101, code: 'PRB-2026-000012', stage: 'Утилизирована' }),
      makeSample({ id: 'blank', organizationId: 101, code: 'PRB-2026-000013', sampleType: undefined, kind: 'Флюид', material: 'смесь' }),
    ]
    expect(resolveRegistrationParent(records, 101, 'PRB-2026-000010').status).toBe('ready')
    expect(resolveRegistrationParent(records, 101, 'PRB-2026-000099').status).toBe('foreign')
    expect(resolveRegistrationParent(records, 101, 'PRB-2026-000011').status).toBe('deleted')
    expect(resolveRegistrationParent(records, 101, 'PRB-2026-000012').status).toBe('disposed')
    expect(resolveRegistrationParent(records, 101, 'PRB-2026-000013').status).toBe('untyped')
    expect(resolveRegistrationParent(records, 101, 'PRB-2026-000404').status).toBe('missing')
    const blocked = prepareRegistration(101, { ...receivedDraft(), parentCode: 'PRB-2026-000099' }, records)
    expect(blocked.ok).toBe(false)
    if (!blocked.ok) expect(blocked.issues).toEqual([{ field: 'parentCode', code: 'foreign' }])
    const unknown = prepareRegistration(101, { ...receivedDraft(), parentCode: '1' }, records)
    expect(unknown.ok).toBe(false)
    if (!unknown.ok) expect(unknown.issues).toEqual([{ field: 'parentCode', code: 'missing' }])
  })

  it('builds a subsample from the parent id and leaves inherited origin to the API', () => {
    const parent = makeSample({ id: 'parent', organizationId: 101, code: 'PRB-2026-000001', field: 'Северное', well: '101' })
    const child = makeSample({ id: 'child', organizationId: 101, code: 'PRB-2026-000001-01', parentId: 'parent' })
    const draft = {
      ...receivedDraft(),
      parentCode: child.code,
      field: 'Другое',
      well: '999',
      sampleType: 'Вода',
      subsampleInterval: '1140–1141',
    }
    const prepared = prepareRegistration(101, draft, [parent, child])
    expect(prepared.ok).toBe(true)
    if (!prepared.ok || prepared.request.kind !== 'subsample') return
    expect(prepared.request.body.parentId).toBe('child')
    expect(prepared.request.body.subsampleInterval).toBe('1140–1141')
    expect(prepared.request.body.externalCode).toBe('SRC-9')
    expect('sampleType' in prepared.request.body).toBe(false)
    expect('field' in prepared.request.body).toBe(false)
    expect('well' in prepared.request.body).toBe(false)
    const again = registrationRequest(101, continueRegistrationDraft(draft), child)
    expect(again.kind).toBe('subsample')
    if (again.kind !== 'subsample') return
    expect(again.body.subsampleInterval).toBeUndefined()
    expect(again.body.externalCode).toBeUndefined()
    expect(again.body.parentId).toBe('child')
  })

  it('applies a parent from the card and drops one the organization cannot use', () => {
    const parent = makeSample({ id: 'parent', organizationId: 101, code: 'PRB-2026-000001' })
    const applied = applyInitialParent(emptyRegistrationDraft(), [parent], 101, 'parent')
    expect(applied.notice).toBeNull()
    expect(applied.draft.parentCode).toBe('PRB-2026-000001')
    const foreign = applyInitialParent(emptyRegistrationDraft(), [parent], 202, 'parent')
    expect(foreign.notice).toBe('foreign')
    expect(foreign.draft.parentCode).toBe('')
    expect(resolveRegistrationParentById([parent], 101, 'missing').status).toBe('missing')
    expect(registrationParentHref('/samples/new?org=101&project=9', 'parent')).toBe('/samples/new?org=101&parent=parent')
  })

  it('points a known API failure at the field and keeps an unknown code', () => {
    expect(registrationFailure({ status: 400, data: { code: 'invalid_sample', field: 'receivedAt' } })).toEqual({
      code: 'invalid_sample',
      field: 'receivedAt',
    })
    expect(registrationFailure({ status: 400, data: { code: 'invalid_parent' } }).field).toBe('parentCode')
    expect(registrationFailure({ status: 400, data: { code: 'inherited_mismatch' } }).code).toBe('inherited_mismatch')
    expect(registrationFailure({ status: 'FETCH_ERROR', error: 'TypeError' })).toEqual({ code: 'unavailable', field: null })
    expect(registrationFailure({ status: 500, data: { code: 'sampler_down' } }).code).toBe('sampler_down')
  })
})
