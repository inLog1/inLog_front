import { SAMPLE_TYPES } from '../../../shared/lib/sample-types'
export { SAMPLE_TYPES } from '../../../shared/lib/sample-types'

export type SampleKind = 'Керн' | 'Флюид'
export type Inspection = 'Не проведён' | 'Соответствует' | 'С ограничениями' | 'Не соответствует'
export type SampleType = typeof SAMPLE_TYPES[number]
export const SAMPLE_STAGES = ['Поступила', 'На хранении', 'На исследовании', 'Запланирован отбор', 'Утилизирована'] as const
export type CurrentSampleStage = typeof SAMPLE_STAGES[number]
export type SampleStage = CurrentSampleStage | 'Входной контроль' | 'В исследовании' | 'Исследование завершено' | 'Передана'
export type SampleEvent = { at: string; text: string; actor?: string }
export type Sample = {
  id: string; organizationId: number; code: string; externalCode?: string; parentId?: string; parentCode?: string; linkedAncestorIds?: string[]; kind: SampleKind; material: string; sampleType?: SampleType
  field: string; well: string; formation: string; interval: string; subsampleInterval?: string; collectedAt: string
  receivedAt: string; container: string; quantity: string; supplier: string; document: string
  conditions: string; location: string; inspection: Inspection; inspectionNote: string; stage?: SampleStage; events: SampleEvent[]; deletedAt?: string
}
const event = (at: string, text: string): SampleEvent => ({ at, text })
export const demoSamples: Sample[] = [
  { id:'core-1', organizationId:101, code:'К-26-001', kind:'Керн', material:'Полноразмерный керн', field:'Северное', well:'101', formation:'П1', interval:'1138–1150 м', collectedAt:'2026-09-12', receivedAt:'2026-09-18', container:'Ящики 1–6', quantity:'Вынос 11,4 м; проходка 12 м', supplier:'Буровой подрядчик', document:'Акт приёма-передачи № 14', conditions:'До глубинной привязки; долбление № 1', location:'Кернохранилище, стеллаж А-2', inspection:'Соответствует', inspectionNote:'Маркировка и комплектность проверены.', stage:'На хранении', events:[event('2026-09-18','Зарегистрировано поступление'),event('2026-09-19','Входной контроль: соответствует'),event('2026-09-19','Статус: На хранении')] },
  { id:'core-2', organizationId:101, code:'К-26-002', kind:'Керн', material:'Полноразмерный керн', field:'Северное', well:'101', formation:'П2', interval:'1532–1544 м', collectedAt:'2026-09-12', receivedAt:'2026-09-18', container:'Ящики 7–12', quantity:'Вынос 11,98 м; проходка 12 м', supplier:'Буровой подрядчик', document:'Акт приёма-передачи № 14', conditions:'До глубинной привязки; долбление № 2', location:'Кернохранилище, стеллаж А-2', inspection:'С ограничениями', inspectionNote:'Часть керна разрушена; учитывать при отборе образцов.', stage:'На хранении', events:[event('2026-09-18','Зарегистрировано поступление'),event('2026-09-19','Входной контроль: соответствует с ограничениями'),event('2026-09-19','Статус: На хранении')] },
  { id:'fluid-1', organizationId:101, code:'Ф-26-001', kind:'Флюид', material:'Газосепараторная проба', field:'Радужное', well:'10', formation:'Б1', interval:'3432–3439 м', collectedAt:'2026-10-02', receivedAt:'2026-10-05', container:'Газовый баллон, зав. № 4230', quantity:'Ориентировочно 10 000 см³; тара 10 000 см³', supplier:'Подрядчик А', document:'Накладная № 2026-1', conditions:'Режим a; давление отбора 50 кгс/см²; температура 0 °C; штуцер 8/16 мм', location:'Склад проб, ячейка Г-1', inspection:'Не проведён', inspectionNote:'', stage:'Поступила', events:[event('2026-10-05','Зарегистрировано поступление'),event('2026-10-05','Статус: Поступила')] },
  { id:'fluid-2', organizationId:101, code:'Ф-26-002', kind:'Флюид', material:'Жидкость сепарации', field:'Радужное', well:'10', formation:'Б1', interval:'3432–3439 м', collectedAt:'2026-10-02', receivedAt:'2026-10-05', container:'Контейнер KЖ, зав. № 201053', quantity:'Ориентировочно 400 см³; тара 400 см³', supplier:'Подрядчик А', document:'Накладная № 2026-1', conditions:'Режим a; давление отбора 50 кгс/см²; температура 0 °C', location:'Лаборатория флюидов', inspection:'Соответствует', inspectionNote:'Тара и маркировка соответствуют, герметичность проверена.', stage:'На исследовании', events:[event('2026-10-05','Зарегистрировано поступление'),event('2026-10-06','Входной контроль: соответствует'),event('2026-10-07','Передана в лабораторию флюидов'),event('2026-10-07','Статус: На исследовании')] },
  { id:'fluid-3', organizationId:101, code:'Ф-26-003', kind:'Флюид', material:'Пластовая вода', field:'Восточное', well:'25', formation:'Б2', interval:'3000–3005 м', collectedAt:'2026-10-08', receivedAt:'2026-10-10', container:'ПЭТ-бутылка № 8', quantity:'Ориентировочно 5000 см³', supplier:'Подрядчик Б', document:'Накладная № 2026-2', conditions:'Данные о давлении и температуре не представлены', location:'Зона входного контроля', inspection:'Не соответствует', inspectionNote:'Повреждена упаковка; требуется решение ответственного.', stage:'Поступила', events:[event('2026-10-10','Зарегистрировано поступление'),event('2026-10-10','Входной контроль: не соответствует'),event('2026-10-10','Статус: Поступила')] },
]

/** Additional fictional samples; stable IDs allow them to coexist with edited records. */
export const detailedDemoSamples: Sample[] = [
  {
    id:'demo-detailed-core-101', organizationId:101, code:'КР-26-101', kind:'Керн', material:'Полноразмерный керн',
    field:'Озёрное', well:'205Р', formation:'Ю1', interval:'2486–2498 м', collectedAt:'2026-10-25', receivedAt:'2026-10-28',
    container:'Керновые ящики № 1–4', quantity:'Проходка 12,0 м; вынос 11,4 м', supplier:'ООО «СеверБур»', document:'Акт приёма-передачи № К-101 от 28.10.2026',
    conditions:'Долбление № 1; глубины по бурению, до уточнения глубинной привязки.', location:'Кернохранилище, стеллаж А-04',
    inspection:'Соответствует', inspectionNote:'Маркировка ящиков и интервалы сверены с ведомостью; упаковка без видимых повреждений.', stage:'На хранении',
    events:[event('2026-10-28','Зарегистрировано поступление'),event('2026-10-29','Входной контроль: соответствует'),event('2026-10-29','Статус: На хранении')],
  },
  {
    id:'demo-detailed-core-102', organizationId:101, code:'КР-26-102', kind:'Керн', material:'Полноразмерный керн',
    field:'Озёрное', well:'205Р', formation:'Ю1', interval:'2498–2510 м', collectedAt:'2026-10-25', receivedAt:'2026-10-28',
    container:'Керновые ящики № 5–8', quantity:'Проходка 12,0 м; вынос 10,2 м', supplier:'ООО «СеверБур»', document:'Акт приёма-передачи № К-101 от 28.10.2026',
    conditions:'Долбление № 2; глубины по бурению, до уточнения глубинной привязки.', location:'Кернохранилище, стеллаж А-05',
    inspection:'С ограничениями', inspectionNote:'Часть керна разрушена; состояние следует учесть при отборе образцов.', stage:'На хранении',
    events:[event('2026-10-28','Зарегистрировано поступление'),event('2026-10-29','Входной контроль: соответствует с ограничениями'),event('2026-10-29','Статус: На хранении')],
  },
  {
    id:'demo-detailed-oil-103', organizationId:101, code:'ФЛ-26-103', kind:'Флюид', material:'Донная проба нефти',
    field:'Озёрное', well:'205Р', formation:'Ю1', interval:'2520–2526 м', collectedAt:'2026-11-01', receivedAt:'2026-11-03',
    container:'Пробоотборник № 0847', quantity:'Ориентировочно 450 мл; вместимость 600 мл', supplier:'ООО «Промысловые исследования»', document:'Акт отбора № Ф-103 от 01.11.2026',
    conditions:'Интервал перфорации 2520–2526 м; по акту давление отбора 24,8 МПа, температура 86 °C.', location:'Лаборатория флюидов, участок PVT',
    inspection:'Соответствует', inspectionNote:'Маркировка, номер пробоотборника и комплектность документов проверены.', stage:'На исследовании',
    events:[event('2026-11-03','Зарегистрировано поступление'),event('2026-11-04','Входной контроль: соответствует'),event('2026-11-05','Статус: На исследовании')],
  },
  {
    id:'demo-detailed-water-104', organizationId:101, code:'ФЛ-26-104', kind:'Флюид', material:'Пластовая вода',
    field:'Озёрное', well:'241', formation:'БС10', interval:'2180–2186 м', collectedAt:'2026-11-04', receivedAt:'2026-11-06',
    container:'Полимерная бутылка № В-104', quantity:'Объём пробы около 0,9 л; вместимость тары 1,0 л', supplier:'ООО «Промысловые исследования»', document:'Акт отбора № Ф-104 от 04.11.2026',
    conditions:'Интервал перфорации 2180–2186 м; сведения о консервации в сопроводительном документе не указаны.', location:'Зона входного контроля',
    inspection:'Не проведён', inspectionNote:'', stage:'Поступила',
    events:[event('2026-11-06','Зарегистрировано поступление'),event('2026-11-06','Статус: Поступила')],
  },
  {
    id:'demo-detailed-gas-105', organizationId:101, code:'ФЛ-26-105', kind:'Флюид', material:'Газ сепарации',
    field:'Речное', well:'18Р', formation:'ПК1', interval:'1840–1848 м', collectedAt:'2026-11-05', receivedAt:'2026-11-07',
    container:'Газовый баллон, заводской № 4230', quantity:'Вместимость баллона 10 л; объём газа не указан', supplier:'ООО «Промысловые исследования»', document:'Акт отбора № Г-105 от 05.11.2026',
    conditions:'Проба с газосепаратора; по акту давление отбора 2,5 МПа, температура 30 °C.', location:'Зона приёмки проб',
    inspection:'Не проведён', inspectionNote:'', stage:'Поступила',
    events:[event('2026-11-07','Зарегистрировано поступление'),event('2026-11-07','Статус: Поступила')],
  },
  {
    id:'demo-detailed-condensate-106', organizationId:101, code:'ФЛ-26-106', kind:'Флюид', material:'Конденсат сепарации',
    field:'Речное', well:'18Р', formation:'ПК1', interval:'1840–1848 м', collectedAt:'2026-11-05', receivedAt:'2026-11-07',
    container:'Металлический контейнер № КЖ-106', quantity:'Ориентировочно 400 мл; вместимость 500 мл', supplier:'ООО «Промысловые исследования»', document:'Акт отбора № Г-105 от 05.11.2026',
    conditions:'Проба жидкости сепарации, режим отбора А; в документах не указана температура при доставке.', location:'Зона входного контроля',
    inspection:'С ограничениями', inspectionNote:'Температура при доставке не указана; требуется уточнить условия до назначения исследований.', stage:'Поступила',
    events:[event('2026-11-07','Зарегистрировано поступление'),event('2026-11-08','Входной контроль: соответствует с ограничениями'),event('2026-11-08','Статус: Поступила')],
  },
]

/** Never replace a persisted sample or introduce a duplicate code in its organization. */
export function withDetailedDemoSamples(records: Sample[], demo: boolean): Sample[] {
  if (!demo) return records
  const ids = new Set(records.map(item => item.id))
  const codes = new Set(records.map(item => `${item.organizationId}:${item.code.trim().toLocaleLowerCase('ru')}`))
  const missing = detailedDemoSamples.filter(item => !ids.has(item.id) && !codes.has(`${item.organizationId}:${item.code.trim().toLocaleLowerCase('ru')}`))
  return missing.length ? [...records, ...structuredClone(missing)] : records
}

export function initialSamples(demo: boolean): Sample[] { return demo ? withDetailedDemoSamples(structuredClone(demoSamples), true) : [] }

/** Upgrade only the original example IDs, preserving edits and any user-created records. */
export function migrateDemoSampleIds(records: Sample[], counters: Record<string, number>): { records: Sample[]; counters: Record<string, number>; changed: boolean } {
  const originals = new Map([...demoSamples, ...detailedDemoSamples].map(item => [item.id, item]))
  const nextCounters = { ...counters }
  for (const item of records) {
    const match = /^PRB-(\d{4})-(\d+)$/i.exec(item.code.trim())
    if (match && Number.isSafeInteger(Number(match[2]))) nextCounters[match[1]] = Math.max(nextCounters[match[1]] ?? 0, Number(match[2]))
  }
  let changed = false
  const migrated = records.map(item => {
    const original = originals.get(item.id)
    if (!original || item.organizationId !== original.organizationId || item.code.trim().toLocaleLowerCase('ru') !== original.code.trim().toLocaleLowerCase('ru')) return item
    const year = original.events[0].at.slice(0, 4)
    const next = (nextCounters[year] ?? 0) + 1
    if (!Number.isSafeInteger(next)) throw new Error('counter-overflow')
    nextCounters[year] = next
    changed = true
    return { ...item, code:`PRB-${year}-${String(next).padStart(6, '0')}`, externalCode:item.externalCode || item.code }
  })
  return { records: changed ? migrated : records, counters: changed ? nextCounters : counters, changed }
}
export function sampleTypeOf(item: Pick<Sample, 'sampleType' | 'kind' | 'material'>): SampleType | 'Не указан' {
  if (item.sampleType) return item.sampleType
  if (item.kind === 'Керн') return 'Керн'
  const text = item.material.toLocaleLowerCase('ru')
  const matches: SampleType[] = []
  if (/нефт/.test(text)) matches.push('Нефть')
  if (/газ/.test(text)) matches.push('Газ')
  if (/вод/.test(text)) matches.push('Вода')
  if (/конденсат/.test(text)) matches.push('Конденсат')
  return matches.length === 1 ? matches[0] : 'Не указан'
}
export function displaySampleStage(stage?: SampleStage): SampleStage | undefined {
  if (stage === 'В исследовании') return 'На исследовании'
  if (stage === 'Входной контроль') return 'Поступила'
  return stage
}
export function displayWell(value: string): string { return value.replace(/^\s*№\s*/, '').trim() }
export function formatDate(value: string) { if (!value) return 'Не указано'; const [y,m,d] = value.slice(0,10).split('-'); return y && m && d ? `${d}.${m}.${y}` : value }

/** Origin describes the parent sample's collection, not the separate receipt of a subsample. */
export function inheritedSampleOrigin(parent: Sample) {
  return {field:parent.field, well:parent.well, formation:parent.formation, interval:parent.subsampleInterval || parent.interval, collectedAt:parent.collectedAt}
}

export function addSample(records: Sample[], item: Sample): Sample[] {
  if (!item.code.trim() || !item.material.trim() || !item.field.trim() || !item.well.trim() || (item.stage !== 'Запланирован отбор' && (!item.receivedAt || !item.location.trim()))) throw new Error('required')
  if (records.some((record) => !record.deletedAt && record.organizationId === item.organizationId && record.code.trim().toLocaleLowerCase('ru') === item.code.trim().toLocaleLowerCase('ru'))) throw new Error('duplicate')
  return [...records, item]
}

/** Allocate IDs while the mock state is locked and save counters alongside the records. */
export function registerSamples(records: Sample[], counters: Record<string, number>, items: Sample[], at: string): { records: Sample[]; counters: Record<string, number> } {
  const date = new Date(at)
  if (Number.isNaN(date.getTime())) throw new Error('invalid-date')
  const year = String(date.getFullYear())
  let last = counters[year] ?? 0
  for (const record of records) {
    const match = /^PRB-(\d{4})-(\d+)$/i.exec(record.code.trim())
    if (match?.[1] === year) {
      const value = Number(match[2])
      if (Number.isSafeInteger(value)) last = Math.max(last, value)
    }
  }
  let next = records
  for (const item of items) {
    if (next.some(record => record.id === item.id)) throw new Error('duplicate-id')
    const parent = item.parentId ? records.find(record => record.id === item.parentId && record.organizationId === item.organizationId && !record.deletedAt) : undefined
    if (item.parentId && (!parent || item.parentId === item.id || displaySampleStage(parent.stage) === 'Утилизирована')) throw new Error('invalid-parent')
    let code: string
    if (parent) {
      const prefix = `${parent.code}-`
      let suffix = 0
      for (const record of next) {
        if (!record.code.toLocaleLowerCase('ru').startsWith(prefix.toLocaleLowerCase('ru'))) continue
        const tail = record.code.slice(prefix.length)
        if (/^\d+$/.test(tail) && Number.isSafeInteger(Number(tail))) suffix = Math.max(suffix, Number(tail))
      }
      if (!Number.isSafeInteger(suffix + 1)) throw new Error('counter-overflow')
      code = `${prefix}${String(suffix + 1).padStart(2, '0')}`
    } else {
      if (!Number.isSafeInteger(last + 1)) throw new Error('counter-overflow')
      last++
      code = `PRB-${year}-${String(last).padStart(6, '0')}`
    }
    const parentType = parent ? sampleTypeOf(parent) : undefined
    if (parentType === 'Не указан') throw new Error('invalid-parent-type')
    const actor = item.events[0]?.actor
    next = addSample(next, { ...item, ...(parent && parentType ? {...inheritedSampleOrigin(parent), sampleType:parentType, kind:parent.kind} : {}), code, events: parent ? [...item.events, {at, actor, text:`Родительская проба: ${parent.code}`}] : item.events })
    if (parent) next = next.map(record => record.id === parent.id ? {...record, events:[...record.events, {at, actor, text:`Создана подпроба ${code}`}]} : record)
  }
  return { records: next, counters: { ...counters, [year]: last } }
}
export function deleteSample(records: Sample[], id: string, organizationId: number, at: string, actor: string): Sample[] {
  if (records.some(item => !item.deletedAt && item.organizationId === organizationId && item.parentId === id) && records.some(item => item.id === id && item.organizationId === organizationId && !item.deletedAt)) throw new Error('has-children')
  const removed = records.find(item => item.id === id && item.organizationId === organizationId && !item.deletedAt)
  return records.map(item => item.id === removed?.id
    ? { ...item, deletedAt: at, events: [...item.events, { at, actor: actor.trim() || undefined, text: 'Проба удалена из реестра' }] }
    : item.id === removed?.parentId && item.organizationId === organizationId
      ? {...item, events:[...item.events, {at, actor:actor.trim() || undefined, text:`Подпроба ${removed.code} удалена из реестра`}]}
      : item)
}
export function changeControl(records: Sample[], id: string, organizationId: number, decision: Inspection, note: string, location: string, at: string, options: { stage?: SampleStage; actor?: string; receivedAt?: string } = {}): Sample[] {
  if ((decision === 'С ограничениями' || decision === 'Не соответствует') && !note.trim()) throw new Error('note')
  return records.map((item) => {
    if (item.id !== id || item.organizationId !== organizationId) return item
    const selectedStage = options.stage ?? item.stage
    const receivedAt = options.receivedAt ?? item.receivedAt
    if (selectedStage !== 'Запланирован отбор' && !location.trim()) throw new Error('location')
    if (selectedStage !== 'Запланирован отбор' && !receivedAt) throw new Error('receivedAt')
    if (options.stage && !(SAMPLE_STAGES as readonly string[]).includes(options.stage) && options.stage !== item.stage) throw new Error('stage')
    const events = [...item.events]
    const actor = options.actor?.trim() || undefined
    if (item.inspection !== decision) events.push({ at, actor, text: `Входной контроль: ${item.inspection} → ${decision}` })
    if (item.inspectionNote !== note) events.push({ at, actor, text: `Замечание: ${item.inspectionNote || 'не указано'} → ${note || 'не указано'}` })
    if (item.location !== location) events.push({ at, actor, text: `Местонахождение: ${item.location || 'не указано'} → ${location}` })
    if (item.receivedAt !== receivedAt) events.push({ at, actor, text: `Дата поступления: ${formatDate(item.receivedAt)} → ${formatDate(receivedAt)}` })
    if (options.stage && displaySampleStage(item.stage) !== displaySampleStage(options.stage)) events.push({ at, actor, text: `Статус: ${displaySampleStage(item.stage) || 'не указан'} → ${displaySampleStage(options.stage)}` })
    return { ...item, inspection: decision, inspectionNote: note, location, receivedAt, ...(options.stage ? { stage: options.stage } : {}), events }
  })
}
