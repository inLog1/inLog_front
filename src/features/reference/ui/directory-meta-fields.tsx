import { useTranslation } from 'react-i18next'
import type { DirectoryCatalogSection, DirectoryDefinition } from '../../../entities/personnel/model/types'
import { Label } from '../../../shared/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../shared/ui/select'
import {
  catalogSectionOptions,
  directoryTypeKey,
  isDirectoryTypeLocked,
  type DirectoryCreateType,
} from '../model/directory-metadata'
export function DirectorySectionField({
  value,
  onChange,
  id,
  disabled,
}: {
  value: DirectoryCatalogSection
  onChange: (value: DirectoryCatalogSection) => void
  id?: string
  disabled?: boolean
}) {
  const { t } = useTranslation()
  const options = catalogSectionOptions()
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{t('directories.definition-section')}</Label>
      <Select value={value} disabled={disabled} onValueChange={(next) => onChange(next as DirectoryCatalogSection)}>
        <SelectTrigger id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((section) => (
            <SelectItem key={section} value={section}>{t(`directories.sections.${section}`)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export function DirectoryTypeField({
  definition,
  createType,
  onCreateTypeChange,
  mode,
  disabled,
}: {
  definition?: DirectoryDefinition
  createType?: DirectoryCreateType
  onCreateTypeChange?: (value: DirectoryCreateType) => void
  mode: 'create' | 'edit'
  disabled?: boolean
}) {
  const { t } = useTranslation()
  const typeKey = mode === 'create'
    ? 'manual'
    : definition
      ? directoryTypeKey(definition)
      : 'manual'
  const locked = mode === 'edit' && definition ? isDirectoryTypeLocked(definition) : false

  return (
    <div className="grid gap-1.5">
      <Label>{t('directories.definition-type')}</Label>
      {mode === 'create' ? (
        <Select
          value={createType ?? 'manual'}
          disabled={disabled}
          onValueChange={(next) => onCreateTypeChange?.(next as DirectoryCreateType)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="manual">{t('directories.types.manual')}</SelectItem>
          </SelectContent>
        </Select>
      ) : (
        <Select value={typeKey} disabled={disabled || locked || typeKey === 'manual'}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="manual">{t('directories.types.manual')}</SelectItem>
            <SelectItem value="registry-departments">{t('directories.types.registry-departments')}</SelectItem>
            <SelectItem value="registry-workplaces">{t('directories.types.registry-workplaces')}</SelectItem>
          </SelectContent>
        </Select>
      )}
      {mode === 'create' ? (
        <p className="text-xs text-muted-foreground">{t('directories.definition-type-create-hint')}</p>
      ) : locked ? (
        <p className="text-xs text-muted-foreground">{t('directories.definition-type-locked')}</p>
      ) : null}
    </div>
  )
}
