import type { Sample } from './types'

/** Minimal registry row for tests. Not a mock seed and not part of the public API. */
export function makeSample(overrides: Partial<Sample> = {}): Sample {
  return {
    id: 'sample-1',
    organizationId: 101,
    code: 'PRB-2026-000001',
    externalCode: 'SRC-1',
    kind: 'Керн',
    material: 'Полноразмерный керн',
    sampleType: 'Керн',
    field: 'Северное',
    well: '101',
    formation: 'П1',
    interval: '1138–1150 м',
    collectedAt: '2026-09-12',
    receivedAt: '2026-09-18',
    container: 'Ящики 1–6',
    quantity: '12 м',
    supplier: 'Подрядчик',
    document: 'Акт № 14',
    conditions: '',
    location: 'Стеллаж А-2',
    inspection: 'Соответствует',
    inspectionNote: 'Маркировка проверена',
    stage: 'На хранении',
    events: [{ at: '2026-09-18T00:00:00Z', text: 'Зарегистрировано поступление' }],
    ...overrides,
  }
}
