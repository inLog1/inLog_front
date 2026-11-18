import type { TFunction } from 'i18next'
import type { RequestCatalogOption, RequestField, RequestWell } from '../../../../../entities/request'
import { LEGACY_SAMPLE_KIND_IDS } from '../../../../../shared/lib/sample-types'

export function sampleTypeOptions(options: readonly RequestCatalogOption[], selected: string): RequestCatalogOption[] {
  return options.filter(option => !LEGACY_SAMPLE_KIND_IDS.includes(option.id) || option.id === selected)
}

export function optionLabel(t: TFunction, options: readonly RequestCatalogOption[], id: string): string {
  const option = options.find((item) => item.id === id)
  if (!id) return ''
  return t(`requests.catalog.${id}`, { defaultValue: option?.label || id })
}

export function fieldCaption(t: TFunction, field: RequestField, options: readonly RequestCatalogOption[], dash: string): string {
  if (field.fieldName.trim()) return field.fieldName.trim()
  const label = optionLabel(t, options, field.catalogFieldId)
  return label || dash
}

export function wellCaption(t: TFunction, well: RequestWell, options: readonly RequestCatalogOption[], dash: string): string {
  if (well.wellName.trim()) return well.wellName.trim()
  const label = optionLabel(t, options, well.catalogWellId)
  return label || dash
}
