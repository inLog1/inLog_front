import { describe, expect, it } from 'vitest'
import { makeSample } from './fixture'
import { displaySampleStage, displayWell, keepInheritedFields, sampleTypeOf } from './origin'
import { addSample, changeControl, deleteSample, inspectManualSample } from './sample'
import { SAMPLE_STAGES } from './types'

describe('sample records', () => {
  it('requires a registry type, field and well, and receipt data unless sampling is planned', () => {
    expect(inspectManualSample({ sampleType: '', field: '', well: '№', receivedAt: '', location: '', stage: 'Поступила' })).toEqual([
      { field: 'sampleType', code: 'required' },
      { field: 'field', code: 'required' },
      { field: 'well', code: 'required' },
      { field: 'receivedAt', code: 'required' },
      { field: 'location', code: 'required' },
    ])
    expect(inspectManualSample({
      sampleType: 'Керн',
      field: 'Северное',
      well: '№ 101',
      receivedAt: '',
      location: '',
      stage: 'Запланирован отбор',
    })).toEqual([])
    expect(inspectManualSample({
      sampleType: 'Керн',
      field: 'Северное',
      well: '101',
      receivedAt: '2026-11-11',
      location: 'Склад',
      inspection: 'Не соответствует',
      inspectionNote: ' ',
    })).toEqual([{ field: 'inspectionNote', code: 'note' }])
    expect(inspectManualSample({
      sampleType: 'Керн',
      field: 'Северное',
      well: '101',
      receivedAt: '2026-11-11',
      location: 'Склад',
      subsampleInterval: '1–2',
    })).toEqual([{ field: 'subsampleInterval', code: 'subsample-interval' }])
    expect(inspectManualSample({
      sampleType: '',
      field: '',
      well: '',
      parentId: 'parent',
      receivedAt: '2026-11-11',
      location: 'Склад',
      subsampleInterval: '1–2',
    })).toEqual([])
  })

  it('rejects an empty number, accepts a type without a clarification, and keeps codes unique per organization', () => {
    const stored = makeSample()
    expect(() => addSample([], { ...stored, code: ' ' })).toThrow('required')
    expect(addSample([], { ...stored, id: 'typed', material: '' })).toHaveLength(1)
    expect(() => addSample([stored], { ...stored, id: 'copy', code: '  prb-2026-000001 ' })).toThrow('duplicate')
    expect(addSample([stored], { ...stored, id: 'other-org', organizationId: 102 })).toHaveLength(2)
    const deleted = deleteSample([stored], stored.id, 101, '2026-11-11T12:30:00Z', 'Администратор')
    expect(deleted[0].deletedAt).toBe('2026-11-11T12:30:00Z')
    expect(deleted[0].events.at(-1)?.actor).toBe('Администратор')
    expect(addSample(deleted, { ...stored, id: 'replacement' })).toHaveLength(2)
    expect(deleteSample([stored], stored.id, 102, '2026-11-11', 'Администратор')).toEqual([stored])
  })

  it('records only real control changes and requires a note for a negative conclusion', () => {
    const item = makeSample({ id: 'fluid', inspection: 'Не проведён', inspectionNote: '' })
    expect(() => changeControl([item], item.id, 101, 'Не соответствует', ' ', item.location, '2026-11-11')).toThrow('note')
    const unchanged = changeControl([item], item.id, 101, item.inspection, item.inspectionNote, item.location, '2026-11-11')[0]
    expect(unchanged.events).toHaveLength(item.events.length)
    const changed = changeControl([item], item.id, 101, 'С ограничениями', 'Повреждена упаковка', 'Склад Б', '2026-11-11')[0]
    expect(changed.events).toHaveLength(item.events.length + 3)
    expect(changed.inspection).toBe('С ограничениями')
    expect(changeControl([item], item.id, 102, 'Соответствует', '', 'Склад Б', '2026-11-11')[0]).toEqual(item)
  })

  it('keeps older history when status changes and allows planned sampling without a receipt', () => {
    const item = makeSample({ stage: undefined })
    const updated = changeControl([item], item.id, 101, item.inspection, item.inspectionNote, item.location, '2026-11-11T12:30:00Z', {
      stage: 'На исследовании',
      actor: 'Иванов И.И.',
    })[0]
    expect(updated.stage).toBe('На исследовании')
    expect(updated.events.at(-1)).toEqual({
      at: '2026-11-11T12:30:00Z',
      actor: 'Иванов И.И.',
      text: 'Статус: не указан → На исследовании',
    })
    expect(changeControl([updated], item.id, 101, item.inspection, item.inspectionNote, item.location, '2026-11-12', { stage: 'На исследовании' })[0].events).toEqual(updated.events)

    const planned = makeSample({ id: 'planned', code: 'ПЛАН-1', stage: 'Запланирован отбор', receivedAt: '', location: '' })
    expect(addSample([], planned)).toHaveLength(1)
    expect(() => changeControl([planned], planned.id, 101, 'Не проведён', '', 'Зона приёмки', '2026-11-11', { stage: 'Поступила' })).toThrow('receivedAt')
    const received = changeControl([planned], planned.id, 101, 'Не проведён', '', 'Зона приёмки', '2026-11-11', { stage: 'Поступила', receivedAt: '2026-11-11' })[0]
    expect(received).toMatchObject({ stage: 'Поступила', receivedAt: '2026-11-11' })
    expect(received.events.some((entry) => entry.text.includes('Дата поступления'))).toBe(true)
  })

  it('classifies older rows conservatively and locks inherited origin on edit', () => {
    expect(SAMPLE_STAGES).toEqual(['Поступила', 'На хранении', 'На исследовании', 'Запланирован отбор', 'Утилизирована'])
    expect(sampleTypeOf({ kind: 'Флюид', material: 'Донная проба нефти' })).toBe('Нефть')
    expect(sampleTypeOf({ kind: 'Флюид', material: 'Газ сепарации' })).toBe('Газ')
    expect(sampleTypeOf({ kind: 'Флюид', material: 'Жидкость сепарации' })).toBe('Не указан')
    expect(sampleTypeOf({ kind: 'Флюид', material: 'Газ и вода' })).toBe('Не указан')
    expect(displaySampleStage('В исследовании')).toBe('На исследовании')
    expect(displaySampleStage('Входной контроль')).toBe('Поступила')
    expect(displaySampleStage('Передана')).toBe('Передана')
    expect(displayWell('№ 100')).toBe('100')

    const current = makeSample({ id: 'child', parentId: 'parent', subsampleInterval: '1140–1141' })
    const edited = keepInheritedFields(current, { ...current, field: 'Другое', location: 'Склад Б', subsampleInterval: '1142–1143' })
    expect(edited.field).toBe(current.field)
    expect(edited.location).toBe('Склад Б')
    expect(edited.subsampleInterval).toBe('1142–1143')
  })
})
