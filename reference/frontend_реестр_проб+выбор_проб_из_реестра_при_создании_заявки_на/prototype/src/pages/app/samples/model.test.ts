import { describe, expect, it } from 'vitest'
import { indexedDB } from 'fake-indexeddb'
import { ensureMockState, readMockState, resetMockNamespace, setMockLockSource, updateMockState } from '../../../app/mocks/db/repository'
import { createSeed } from '../../../app/mocks/db/seed'
import { mayDeleteSample } from './access'
import { addSample, changeControl, deleteSample, demoSamples, detailedDemoSamples, initialSamples, withDetailedDemoSamples, sampleTypeOf, displaySampleStage, displayWell, SAMPLE_STAGES } from './model'

describe('sample registry', () => {
  it('allows deletion only to the superadministrator and the assigned organization administrator', () => {
    const state = createSeed()
    expect(mayDeleteSample(state, 1, 101)).toBe(true)
    expect(mayDeleteSample(state, 2, 101)).toBe(true)
    expect(mayDeleteSample(state, 2, 102)).toBe(false)
    expect(mayDeleteSample(state, 3, 101)).toBe(false)
    expect(mayDeleteSample({ ...state, users: state.users.map(user => user.id === 2 ? { ...user, status: 'blocked' } : user) }, 2, 101)).toBe(false)
    const renamed = { ...state, roles: state.roles.map(role => role.id === 'role-employee' ? { ...role, displayName: 'Администратор организации' } : role) }
    expect(mayDeleteSample(renamed, 3, 101)).toBe(false)
    const scoped = { ...state, roles: [...state.roles, { id:'new-admin', displayName:'Администратор организации', grantIds:[], origin:{template:'organization-administrator' as const}, ownerScope:{type:'organization' as const, organizationId:102, corporationId:1} }], assignments:[...state.assignments, {id:'new-assignment', userId:4, roleId:'new-admin', scope:{type:'organization' as const, organizationId:102, corporationId:1}}] }
    expect(mayDeleteSample(scoped, 4, 102)).toBe(true)
    expect(mayDeleteSample(scoped, 4, 101)).toBe(false)
  })
  it('keeps deleted examples hidden after demo data is merged and permits a new record with the same code', () => {
    const item = detailedDemoSamples[0]
    const deleted = deleteSample([item], item.id, 101, '2026-11-11T12:30:00Z', 'Администратор')
    expect(deleted[0].deletedAt).toBe('2026-11-11T12:30:00Z')
    expect(deleted[0].events.at(-1)?.actor).toBe('Администратор')
    expect(withDetailedDemoSamples(deleted, true).filter(sample => sample.id === item.id)).toHaveLength(1)
    expect(deleteSample([item], item.id, 102, '2026-11-11', 'Администратор')).toEqual([item])
    expect(addSample(deleted, { ...item, id:'replacement' })).toHaveLength(2)
  })
  it('adds detailed examples without replacing existing samples or duplicating their codes', () => {
    const edited = { ...detailedDemoSamples[0], location:'Изменено пользователем', events:[...detailedDemoSamples[0].events, {at:'2026-11-09', text:'Перемещена'}] }
    const sameCode = { ...detailedDemoSamples[1], id:'user-sample', code:'кр-26-102' }
    const records = [edited, sameCode]
    const merged = withDetailedDemoSamples(records, true)
    expect(merged).toHaveLength(detailedDemoSamples.length)
    expect(merged.find(item => item.id === edited.id)).toEqual(edited)
    expect(merged.find(item => item.id === 'user-sample')).toEqual(sameCode)
    expect(withDetailedDemoSamples(merged, true)).toEqual(merged)
    expect(withDetailedDemoSamples(records, false)).toBe(records)
    expect(initialSamples(true)).toHaveLength(demoSamples.length + detailedDemoSamples.length)
  })
  it('checks required fields and duplicate codes within an organization', () => {
    const record = { ...demoSamples[0], id: 'new', code: '  к-26-001 ' }
    expect(() => addSample(demoSamples, record)).toThrow('duplicate')
    expect(addSample(demoSamples, { ...record, organizationId: 102 })).toHaveLength(demoSamples.length + 1)
    expect(() => addSample([], { ...record, code: ' ' })).toThrow('required')
  })
  it('requires a reason for a negative conclusion and records only actual changes', () => {
    const item = demoSamples[2]
    expect(() => changeControl([item], item.id, 101, 'Не соответствует', ' ', item.location, '2026-11-11')).toThrow('note')
    const unchanged = changeControl([item], item.id, 101, item.inspection, item.inspectionNote, item.location, '2026-11-11')[0]
    expect(unchanged.events).toHaveLength(item.events.length)
    const changed = changeControl([item], item.id, 101, 'С ограничениями', 'Повреждена упаковка', 'Склад Б', '2026-11-11')[0]
    expect(changed.events).toHaveLength(item.events.length + 3)
    expect(changed.inspection).toBe('С ограничениями')
    expect(changeControl([item], item.id, 102, 'Соответствует', '', 'Склад Б', '2026-11-11')[0]).toEqual(item)
  })
  it('records lifecycle and control changes with the author while preserving older entries', () => {
    const item = { ...demoSamples[0], stage: undefined }
    const updated = changeControl([item], item.id, 101, item.inspection, item.inspectionNote, item.location, '2026-11-11T12:30:00Z', { stage: 'На исследовании', actor: 'Иванов И.И.' })[0]
    expect(updated.stage).toBe('На исследовании')
    expect(updated.events.slice(0, item.events.length)).toEqual(item.events)
    expect(updated.events.at(-1)).toEqual({at:'2026-11-11T12:30:00Z', actor:'Иванов И.И.', text:'Статус: не указан → На исследовании'})
    expect(changeControl([updated], item.id, 101, item.inspection, item.inspectionNote, item.location, '2026-11-12', { stage:'На исследовании' })[0].events).toEqual(updated.events)
  })
  it('classifies old samples conservatively and keeps historical statuses', () => {
    expect(SAMPLE_STAGES).toEqual(['Поступила', 'На хранении', 'На исследовании', 'Запланирован отбор', 'Утилизирована'])
    expect(sampleTypeOf({kind:'Флюид', material:'Донная проба нефти'})).toBe('Нефть')
    expect(sampleTypeOf({kind:'Флюид', material:'Газ сепарации'})).toBe('Газ')
    expect(sampleTypeOf({kind:'Флюид', material:'Жидкость сепарации'})).toBe('Не указан')
    expect(sampleTypeOf({kind:'Флюид', material:'Газ и вода'})).toBe('Не указан')
    expect(displaySampleStage('В исследовании')).toBe('На исследовании')
    expect(displaySampleStage('Входной контроль')).toBe('Поступила')
    expect(displaySampleStage('Передана')).toBe('Передана')
    expect(displayWell('№ 100')).toBe('100')
  })
  it('supports planned sampling without inventing a receipt date or location', () => {
    const planned = { ...demoSamples[0], id:'planned', code:'ПЛАН-1', stage:'Запланирован отбор' as const, receivedAt:'', location:'' }
    expect(addSample([], planned)).toHaveLength(1)
    expect(() => changeControl([planned], planned.id, 101, 'Не проведён', '', 'Зона приёмки', '2026-11-11', {stage:'Поступила'})).toThrow('receivedAt')
    const received = changeControl([planned], planned.id, 101, 'Не проведён', '', 'Зона приёмки', '2026-11-11', {stage:'Поступила', receivedAt:'2026-11-11'})[0]
    expect(received).toMatchObject({stage:'Поступила', receivedAt:'2026-11-11'})
    expect(received.events.some(entry => entry.text.includes('Дата поступления'))).toBe(true)
  })
  it('persists records in the mock database and clears them on reset', async () => {
    Object.assign(globalThis, { indexedDB })
    setMockLockSource(() => ({ request: ((_name: string, _options: unknown, callback: (lock: object) => unknown) => { void callback({}); return Promise.resolve() }) as LockManager['request'] }))
    const namespace = `inlog:mock:sample-test-${crypto.randomUUID()}`
    try {
      await ensureMockState(namespace)
      await updateMockState(state => ({ ...state, samples: addSample([], demoSamples[0]) }), namespace)
      await updateMockState(state => ({ ...state, samples: changeControl(state.samples ?? [], demoSamples[0].id, 101, demoSamples[0].inspection, demoSamples[0].inspectionNote, demoSamples[0].location, '2026-11-11T12:30:00Z', { stage:'На исследовании', actor:'Иванов И.И.' }) }), namespace)
      const stored = await readMockState(namespace)
      expect(stored.ok && stored.state.samples?.[0].code).toBe('К-26-001')
      expect(stored.ok && stored.state.samples?.[0].stage).toBe('На исследовании')
      expect(stored.ok && stored.state.samples?.[0].events.at(-1)?.actor).toBe('Иванов И.И.')
      await updateMockState(state => ({ ...state, samples: deleteSample(state.samples ?? [], demoSamples[0].id, 101, '2026-11-12T10:00:00Z', 'Администратор') }), namespace)
      const afterDelete = await readMockState(namespace)
      expect(afterDelete.ok && afterDelete.state.samples?.[0].deletedAt).toBe('2026-11-12T10:00:00Z')
      await resetMockNamespace(namespace)
      const reset = await readMockState(namespace)
      expect(reset.ok && reset.state.samples).toBeUndefined()
    } finally { setMockLockSource(null) }
  })
})
