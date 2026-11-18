/**
 * Material catalogue of the sample registry.
 * Request drafts already use `sampleTypeId` (глубинная / поверхностная / сепараторная).
 * That list is a different catalogue and is not replaced here.
 *
 * The stored value is the closed label. Import cells and inheritance compare those labels.
 * Option ids stay stable if a later schema stops persisting the label itself.
 */
export const SAMPLE_TYPES = ['Керн', 'Нефть', 'Газ', 'Вода', 'Конденсат', 'Другое'] as const

export type SampleType = (typeof SAMPLE_TYPES)[number]

export const SAMPLE_TYPE_OPTIONS = [
  { id: 'sample-type-core', label: 'Керн' },
  { id: 'sample-type-oil', label: 'Нефть' },
  { id: 'sample-type-gas', label: 'Газ' },
  { id: 'sample-type-water', label: 'Вода' },
  { id: 'sample-type-condensate', label: 'Конденсат' },
  { id: 'sample-type-other', label: 'Другое' },
] as const

export type SampleTypeOptionId = (typeof SAMPLE_TYPE_OPTIONS)[number]['id']

export function isSampleType(value: string): value is SampleType {
  return (SAMPLE_TYPES as readonly string[]).includes(value)
}

export function sampleTypeOptionId(label: SampleType): SampleTypeOptionId {
  const option = SAMPLE_TYPE_OPTIONS.find((item) => item.label === label)
  if (!option) throw new Error('invalid-type')
  return option.id
}

export function sampleTypeByOptionId(id: string): SampleType | undefined {
  const option = SAMPLE_TYPE_OPTIONS.find((item) => item.id === id)
  return option?.label
}
