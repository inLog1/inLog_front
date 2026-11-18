import type { SampleType } from './catalog'

/** Statuses a new or edited record may take. */
export const SAMPLE_STAGES = ['Поступила', 'На хранении', 'На исследовании', 'Запланирован отбор', 'Утилизирована'] as const

export type CurrentSampleStage = (typeof SAMPLE_STAGES)[number]

/** Legacy labels stay readable. New writes use `CurrentSampleStage`. */
export type SampleStage = CurrentSampleStage | 'Входной контроль' | 'В исследовании' | 'Исследование завершено' | 'Передана'

export const SAMPLE_INSPECTIONS = ['Не проведён', 'Соответствует', 'С ограничениями', 'Не соответствует'] as const

export type SampleInspection = (typeof SAMPLE_INSPECTIONS)[number]

/** Legacy grouping used by older rows and the «Флюид» import value. The registry type is `sampleType`. */
export type SampleKind = 'Керн' | 'Флюид'

export type SampleEvent = {
  at: string
  text: string
  actor?: string
}

export type Sample = {
  /** Stable internal id. Registration number is `code`. */
  id: string
  organizationId: number
  /** System registration number. Existing values are not rewritten. */
  code: string
  /** Original marking supplied by the sender. Optional. */
  externalCode?: string
  /** Internal id of the immediate parent. */
  parentId?: string
  /**
   * Optional stored ancestor ids.
   * The parent chain is the source of lineage; this list covers a selected ancestor
   * that is not present in the walked records.
   */
  linkedAncestorIds?: string[]
  kind: SampleKind
  /** Type clarification. Empty is allowed when `sampleType` is set. */
  material: string
  sampleType?: SampleType
  field: string
  well: string
  formation: string
  /** Origin interval. On a subsample this is copied from the parent and stays fixed. */
  interval: string
  /** Own interval of this subsample. Optional. */
  subsampleInterval?: string
  collectedAt: string
  receivedAt: string
  container: string
  quantity: string
  supplier: string
  /** Accompanying-document text. A file link lives on `SampleAttachment`, not here. */
  document: string
  conditions: string
  location: string
  inspection: SampleInspection
  inspectionNote: string
  stage?: SampleStage
  events: SampleEvent[]
  /** Logical deletion. The registration number stays occupied. */
  deletedAt?: string
}

export type SampleCodeCounters = Record<string, number>
