import type { MockState } from '../../../app/mocks/db/types'
import { mayDeleteSample } from './access'

/** Fields available for the future sample selection step in requests. */
export const REQUEST_SAMPLE_FIELDS = [
  { key:'code', label:'ID пробы', required:true },
  { key:'sampleType', label:'Тип пробы' },
  { key:'externalCode', label:'Исходная маркировка' },
  { key:'parentCode', label:'Родительская проба' },
  { key:'field', label:'Месторождение / участок' },
  { key:'well', label:'Скважина' },
  { key:'formation', label:'Пласт' },
  { key:'interval', label:'Интервал отбора, м' },
  { key:'collectedAt', label:'Дата отбора' },
  { key:'receivedAt', label:'Дата поступления' },
  { key:'stage', label:'Статус пробы' },
  { key:'inspection', label:'Входной контроль' },
  { key:'inspectionNote', label:'Замечание входного контроля' },
  { key:'location', label:'Местонахождение' },
  { key:'container', label:'Тара' },
  { key:'quantity', label:'Количество / объём' },
  { key:'supplier', label:'Передающая сторона' },
  { key:'document', label:'Реквизиты документа' },
  { key:'conditions', label:'Условия и примечания' },
] as const
export type RequestSampleField = typeof REQUEST_SAMPLE_FIELDS[number]['key']
const available = new Set<string>(REQUEST_SAMPLE_FIELDS.map(field => field.key))
export const REQUIRED_REQUEST_SAMPLE_FIELDS: RequestSampleField[] = ['code','parentCode','stage','inspection']
export const DEFAULT_REQUEST_SAMPLE_FIELDS: RequestSampleField[] = ['code','sampleType','parentCode','field','well','formation','interval','stage','inspection']

export function getRequestSampleFields(state: MockState, organizationId: number): RequestSampleField[] {
  const stored = state.sampleRequestFields?.[String(organizationId)]
  if (!stored) return [...DEFAULT_REQUEST_SAMPLE_FIELDS]
  const selected = new Set(stored.filter(key => available.has(key)))
  REQUIRED_REQUEST_SAMPLE_FIELDS.forEach(key => selected.add(key))
  return REQUEST_SAMPLE_FIELDS.map(field => field.key).filter(key => selected.has(key))
}

export function setRequestSampleFields(state: MockState, userId: number | null, organizationId: number, fields: string[]): MockState {
  if (!mayDeleteSample(state, userId, organizationId)) throw new Error('forbidden')
  if (fields.some(field => !available.has(field))) throw new Error('invalid-fields')
  const selected = new Set([...fields, ...REQUIRED_REQUEST_SAMPLE_FIELDS])
  const normalized = REQUEST_SAMPLE_FIELDS.map(field => field.key).filter(key => selected.has(key))
  return { ...state, sampleRequestFields: { ...state.sampleRequestFields, [String(organizationId)]: normalized } }
}
