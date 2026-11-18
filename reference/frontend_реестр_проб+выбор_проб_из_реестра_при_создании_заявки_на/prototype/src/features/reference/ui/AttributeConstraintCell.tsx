import { useTranslation } from 'react-i18next'
import type { DirectoryField } from '../../../entities/personnel/model/types'
import { constraintPhrases } from '../model/attribute-field'

export function AttributeConstraintCell({ field }: { field: Pick<DirectoryField, 'type' | 'constraints'> }) {
  const { t } = useTranslation()
  const phrases = constraintPhrases(field.type, field.constraints)
  if (phrases.length === 0) {
    return <span className="text-muted-foreground">{t('directories.catalog.constraints.summary.none')}</span>
  }
  return (
    <span className="text-xs leading-5 text-muted-foreground">
      {phrases.map((phrase) => t(phrase.key, phrase.values)).join(' · ')}
    </span>
  )
}
