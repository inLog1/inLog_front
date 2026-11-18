/**
 * Ширины колонок таблицы реестра проб (% от ширины таблицы при `table-fixed`).
 * Меняйте числа здесь — заголовки и `<colgroup>` подхватят их автоматически.
 */
export const SAMPLE_REGISTRY_TABLE_COLUMN_WIDTHS = {
  id: 11,
  type: 7,
  field: 9.5,
  well: 7,
  formation: 8.5,
  interval: 10,
  collected: 7,
  received: 8.5,
  stage: 9,
  inspection: 11,
  location: 13.5,
} as const

export type SampleRegistryTableColumnKey = keyof typeof SAMPLE_REGISTRY_TABLE_COLUMN_WIDTHS

export const SAMPLE_REGISTRY_TABLE_COLUMN_ORDER = [
  'id',
  'type',
  'field',
  'well',
  'formation',
  'interval',
  'collected',
  'received',
  'stage',
  'inspection',
  'location',
] as const satisfies readonly SampleRegistryTableColumnKey[]

export function sampleRegistryColumnWidthPercent(key: SampleRegistryTableColumnKey): number {
  return SAMPLE_REGISTRY_TABLE_COLUMN_WIDTHS[key]
}