import { SAMPLE_TYPE_OPTIONS } from '../../../../entities/sample'

/** Domain labels stay the stored values. These maps only choose a translation key. */
export const SAMPLE_STAGE_MESSAGE_KEY: Readonly<Record<string, string>> = {
  'Поступила': 'samples.stage.received',
  'На хранении': 'samples.stage.storage',
  'На исследовании': 'samples.stage.study',
  'Запланирован отбор': 'samples.stage.planned',
  'Утилизирована': 'samples.stage.disposed',
  'Входной контроль': 'samples.stage.intake-legacy',
  'В исследовании': 'samples.stage.study-legacy',
  'Исследование завершено': 'samples.stage.study-done',
  'Передана': 'samples.stage.transferred',
  'Не указан': 'samples.stage.unspecified',
}

export const SAMPLE_INSPECTION_MESSAGE_KEY: Readonly<Record<string, string>> = {
  'Не проведён': 'samples.inspection.pending',
  'Соответствует': 'samples.inspection.accepted',
  'С ограничениями': 'samples.inspection.limited',
  'Не соответствует': 'samples.inspection.rejected',
}

export const SAMPLE_ATTACHMENT_MESSAGE_KEY: Readonly<Record<string, string>> = {
  'Акт приёма-передачи': 'samples.attachment.transfer',
  'Ведомость проб': 'samples.attachment.list',
  'Ведомость проб / керна': 'samples.attachment.list',
  'Сопроводительный документ': 'samples.attachment.accompanying',
  'Акт входного контроля / осмотра': 'samples.attachment.inspection',
  'Фото входного контроля': 'samples.attachment.photo',
}

export const SAMPLE_ROOM_MESSAGE_KEY: Readonly<Record<string, string>> = {
  intake: 'samples.rooms.intake',
  control: 'samples.rooms.control',
  storage: 'samples.rooms.storage',
  lab: 'samples.rooms.lab',
}

export function sampleTypeMessageKey(value: string): string | null {
  if (value === 'Не указан') return 'samples.types.unspecified'
  const option = SAMPLE_TYPE_OPTIONS.find((item) => item.label === value)
  return option ? `samples.types.${option.id}` : null
}
