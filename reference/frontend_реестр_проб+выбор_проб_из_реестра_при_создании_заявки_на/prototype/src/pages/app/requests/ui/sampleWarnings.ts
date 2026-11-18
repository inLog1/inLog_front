import { displayWell, type Sample } from '../../samples/model'

export type StudyObject = { field:string; well:string }

/** Compare only when both sides contain meaningful object names. */
export function sampleOutsideStudyObjects(sample: Pick<Sample, 'field' | 'well'>, objects: readonly StudyObject[]): boolean {
  const normalized = (value:string) => value.trim().toLocaleLowerCase('ru').replace(/\s+/g, ' ')
  const field = normalized(sample.field), well = normalized(displayWell(sample.well))
  const known = objects.filter(item => item.field.trim() && item.well.trim())
  return Boolean(field && well && known.length && !known.some(item => normalized(item.field) === field && normalized(displayWell(item.well)) === well))
}
