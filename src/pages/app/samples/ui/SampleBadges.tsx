import { useTranslation } from 'react-i18next'
import type { SampleInspection, SampleStage } from '../../../../entities/sample'
import { Badge } from '../../../../shared/ui/badge'
import { SAMPLE_INSPECTION_MESSAGE_KEY, SAMPLE_STAGE_MESSAGE_KEY } from '../model/labels'

const STAGE_COLOR: Record<string, string> = {
  'Поступила': 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-200',
  'На хранении': 'border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-200',
  'На исследовании': 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200',
  'Запланирован отбор': 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200',
  'Утилизирована': 'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200',
  'Входной контроль': 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-200',
  'В исследовании': 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200',
  'Исследование завершено': 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
  'Передана': 'border-teal-200 bg-teal-50 text-teal-800 dark:border-teal-800 dark:bg-teal-950 dark:text-teal-200',
}

const INSPECTION_COLOR: Record<SampleInspection, string> = {
  'Соответствует': 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
  'С ограничениями': 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200',
  'Не соответствует': 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200',
  'Не проведён': 'border-border bg-muted text-muted-foreground',
}

export function SampleStatusBadge({ value }: { value?: SampleStage | string }) {
  const { t } = useTranslation()
  const key = value ? SAMPLE_STAGE_MESSAGE_KEY[value] : undefined
  const label = key ? t(key) : (value || t('samples.stage.unspecified'))
  return (
    <Badge variant="outline" className={`max-w-full px-2 py-0 font-medium shadow-none ${value ? STAGE_COLOR[value] ?? 'border-border bg-muted text-muted-foreground' : 'border-border bg-muted text-muted-foreground'}`}>
      <span className="truncate">{label}</span>
    </Badge>
  )
}

export function SampleInspectionBadge({ value }: { value: SampleInspection }) {
  const { t } = useTranslation()
  const key = SAMPLE_INSPECTION_MESSAGE_KEY[value]
  return (
    <Badge variant="outline" className={`px-2 py-0 font-medium shadow-none ${INSPECTION_COLOR[value]}`}>
      {key ? t(key) : value}
    </Badge>
  )
}
