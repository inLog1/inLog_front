import type { SampleType } from './catalog'
import type { Sample, SampleKind, SampleStage } from './types'

export type SampleOrigin = {
  field: string
  well: string
  formation: string
  interval: string
  collectedAt: string
}

/** Fields a subsample copies from its immediate parent and does not edit afterwards. */
export const INHERITED_SAMPLE_FIELDS = ['sampleType', 'kind', 'field', 'well', 'formation', 'interval', 'collectedAt'] as const

/**
 * Origin describes the parent collection.
 * The next level inherits the parent's own interval when that interval is filled in.
 */
export function inheritedSampleOrigin(parent: Pick<Sample, 'field' | 'well' | 'formation' | 'interval' | 'subsampleInterval' | 'collectedAt'>): SampleOrigin {
  return {
    field: parent.field,
    well: parent.well,
    formation: parent.formation,
    interval: parent.subsampleInterval?.trim() ? parent.subsampleInterval : parent.interval,
    collectedAt: parent.collectedAt,
  }
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

export function kindForSampleType(type: SampleType): SampleKind {
  return type === 'Керн' ? 'Керн' : 'Флюид'
}

export function displaySampleStage(stage?: SampleStage): SampleStage | undefined {
  if (stage === 'В исследовании') return 'На исследовании'
  if (stage === 'Входной контроль') return 'Поступила'
  return stage
}

export function displayWell(value: string): string {
  return value.replace(/^\s*№\s*/, '').trim()
}

export function formatSampleDate(value: string): string {
  if (!value) return 'Не указано'
  const [year, month, day] = value.slice(0, 10).split('-')
  return year && month && day ? `${day}.${month}.${year}` : value
}

/** Own subsample interval wins. Otherwise the stored origin interval is shown and marked inherited. */
export function displaySampleInterval(sample: Pick<Sample, 'parentId' | 'interval' | 'subsampleInterval'>): { value: string; inherited: boolean } {
  if (sample.parentId && sample.subsampleInterval?.trim()) {
    return { value: sample.subsampleInterval, inherited: false }
  }
  return { value: sample.interval, inherited: Boolean(sample.parentId) }
}

export function withInheritedOrigin<T extends Sample>(sample: T, parent: Sample): T {
  const sampleType = sampleTypeOf(parent)
  if (sampleType === 'Не указан') throw new Error('invalid-parent-type')
  return {
    ...sample,
    ...inheritedSampleOrigin(parent),
    sampleType,
    kind: parent.kind,
  }
}

/** A later edit may change status, place, documents and the own interval. Inherited origin stays. */
export function keepInheritedFields(current: Sample, next: Sample): Sample {
  if (!current.parentId) return next
  return {
    ...next,
    parentId: current.parentId,
    sampleType: current.sampleType,
    kind: current.kind,
    field: current.field,
    well: current.well,
    formation: current.formation,
    interval: current.interval,
    collectedAt: current.collectedAt,
  }
}
