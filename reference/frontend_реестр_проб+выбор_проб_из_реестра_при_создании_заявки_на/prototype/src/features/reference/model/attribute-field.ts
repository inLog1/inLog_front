import {
  CATALOG_ATTRIBUTE_TYPES,
  CATALOG_DATE_DISPLAY_FORMATS,
  type CatalogAttributeType,
  type CatalogDateDisplayFormat,
  type DirectoryAttributeConstraints,
} from '../../../entities/personnel/model/types'

export const NEW_ATTRIBUTE_GROUP_ID = '__new_group__'

export function isCatalogAttributeType(value: unknown): value is CatalogAttributeType {
  return typeof value === 'string' && (CATALOG_ATTRIBUTE_TYPES as readonly string[]).includes(value)
}

export function emptyAttributeConstraints(): DirectoryAttributeConstraints {
  return {}
}

export function defaultConstraintsForType(type: CatalogAttributeType): DirectoryAttributeConstraints {
  if (type === 'email') return { validateEmailFormat: true, maxEmailLength: 254 }
  if (type === 'phone') return { internationalPhone: false }
  return emptyAttributeConstraints()
}

export function constraintsForTypeChange(type: CatalogAttributeType): DirectoryAttributeConstraints {
  return defaultConstraintsForType(type)
}

export function normalizeConstraintsForWrite(
  type: CatalogAttributeType,
  draft: DirectoryAttributeConstraints,
): DirectoryAttributeConstraints | undefined {
  const next: DirectoryAttributeConstraints = {}
  const numberOrNull = (value: number | null | undefined) =>
    typeof value === 'number' && Number.isFinite(value) ? value : undefined
  const textOrNull = (value: string | null | undefined, limit: number) => {
    if (typeof value !== 'string') return undefined
    const trimmed = value.trim()
    if (!trimmed) return undefined
    return trimmed.slice(0, limit)
  }
  if (type === 'text' || type === 'textarea' || type === 'email') {
    const maxLength = numberOrNull(type === 'email' ? draft.maxEmailLength ?? draft.maxLength : draft.maxLength)
    if (maxLength != null && maxLength > 0) next.maxLength = Math.floor(maxLength)
  }
  if (type === 'email') {
    if (draft.validateEmailFormat === true) next.validateEmailFormat = true
    const maxEmailLength = numberOrNull(draft.maxEmailLength ?? draft.maxLength)
    if (maxEmailLength != null && maxEmailLength > 0) next.maxEmailLength = Math.floor(maxEmailLength)
  }
  if (type === 'number') {
    for (const key of ['min', 'max', 'step'] as const) {
      const value = numberOrNull(draft[key])
      if (value != null) next[key] = value
    }
    if (draft.integer === true) next.integer = true
  }
  if (type === 'date') {
    if (typeof draft.minDate === 'string' && draft.minDate) next.minDate = draft.minDate
    if (typeof draft.maxDate === 'string' && draft.maxDate) next.maxDate = draft.maxDate
    if (draft.dateFormat && (CATALOG_DATE_DISPLAY_FORMATS as readonly string[]).includes(draft.dateFormat)) {
      next.dateFormat = draft.dateFormat as CatalogDateDisplayFormat
    }
  }
  if (type === 'file') {
    const extensions = textOrNull(draft.extensions, 200)
    if (extensions) next.extensions = extensions
    const maxFileSizeMb = numberOrNull(draft.maxFileSizeMb)
    if (maxFileSizeMb != null && maxFileSizeMb > 0) next.maxFileSizeMb = maxFileSizeMb
    const maxFileCount = numberOrNull(draft.maxFileCount)
    if (maxFileCount != null && maxFileCount > 0) next.maxFileCount = Math.floor(maxFileCount)
  }
  if (type === 'photo') {
    const photoFormats = textOrNull(draft.photoFormats, 200)
    if (photoFormats) next.photoFormats = photoFormats
    const maxPhotoSizeMb = numberOrNull(draft.maxPhotoSizeMb)
    if (maxPhotoSizeMb != null && maxPhotoSizeMb > 0) next.maxPhotoSizeMb = maxPhotoSizeMb
    const maxPhotoCount = numberOrNull(draft.maxPhotoCount)
    if (maxPhotoCount != null && maxPhotoCount > 0) next.maxPhotoCount = Math.floor(maxPhotoCount)
  }
  if (type === 'phone') {
    if (draft.internationalPhone === true) next.internationalPhone = true
    const phoneMask = textOrNull(draft.phoneMask, 80)
    if (phoneMask) next.phoneMask = phoneMask
  }
  return Object.keys(next).length > 0 ? next : undefined
}

export function catalogTypeLabelKey(type: CatalogAttributeType): string {
  return `directories.catalog.types.${type}`
}

export type ConstraintPhrase = {
  key: string
  values?: Record<string, string | number>
}

function displayConstraintDate(iso: string, dateFormat: CatalogDateDisplayFormat | null | undefined): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!match) return iso
  const [, year, month, day] = match
  if (dateFormat === 'y') return year
  if (dateFormat === 'my') return `${month}.${year}`
  return `${day}.${month}.${year}`
}

/** Short phrases for the attribute table. Empty means there is nothing to show. */
export function constraintPhrases(
  type: CatalogAttributeType,
  constraints: DirectoryAttributeConstraints | undefined,
): ConstraintPhrase[] {
  const draft = constraints ?? {}
  const phrases: ConstraintPhrase[] = []
  if (type === 'checkbox') {
    return [{ key: 'directories.catalog.constraints.summary.not-needed' }]
  }
  if (type === 'text' || type === 'textarea') {
    if (typeof draft.maxLength === 'number' && draft.maxLength > 0) {
      phrases.push({ key: 'directories.catalog.constraints.summary.max-length', values: { count: draft.maxLength } })
    }
  }
  if (type === 'number') {
    const hasMin = typeof draft.min === 'number'
    const hasMax = typeof draft.max === 'number'
    if (hasMin && hasMax) phrases.push({ key: 'directories.catalog.constraints.summary.range', values: { min: draft.min!, max: draft.max! } })
    else if (hasMin) phrases.push({ key: 'directories.catalog.constraints.summary.min', values: { min: draft.min! } })
    else if (hasMax) phrases.push({ key: 'directories.catalog.constraints.summary.max', values: { max: draft.max! } })
    if (typeof draft.step === 'number') phrases.push({ key: 'directories.catalog.constraints.summary.step', values: { step: draft.step } })
    phrases.push({ key: draft.integer ? 'directories.catalog.constraints.summary.integer' : 'directories.catalog.constraints.summary.decimal' })
  }
  if (type === 'date') {
    if (draft.minDate) {
      phrases.push({
        key: 'directories.catalog.constraints.summary.not-before',
        values: { date: displayConstraintDate(draft.minDate, draft.dateFormat) },
      })
    }
    if (draft.maxDate) {
      phrases.push({
        key: 'directories.catalog.constraints.summary.not-after',
        values: { date: displayConstraintDate(draft.maxDate, draft.dateFormat) },
      })
    }
    if (draft.dateFormat) {
      phrases.push({ key: `directories.catalog.constraints.date-formats.${draft.dateFormat}` })
    }
  }
  if (type === 'file') {
    if (draft.extensions) phrases.push({ key: 'directories.catalog.constraints.summary.plain', values: { value: draft.extensions } })
    if (typeof draft.maxFileSizeMb === 'number' && draft.maxFileSizeMb > 0) {
      phrases.push({ key: 'directories.catalog.constraints.summary.file-size', values: { size: draft.maxFileSizeMb } })
    }
    if (typeof draft.maxFileCount === 'number' && draft.maxFileCount > 0) {
      phrases.push({ key: 'directories.catalog.constraints.summary.file-count', values: { count: draft.maxFileCount } })
    }
  }
  if (type === 'photo') {
    if (draft.photoFormats) phrases.push({ key: 'directories.catalog.constraints.summary.plain', values: { value: draft.photoFormats } })
    if (typeof draft.maxPhotoSizeMb === 'number' && draft.maxPhotoSizeMb > 0) {
      phrases.push({ key: 'directories.catalog.constraints.summary.file-size', values: { size: draft.maxPhotoSizeMb } })
    }
    if (typeof draft.maxPhotoCount === 'number' && draft.maxPhotoCount > 0) {
      phrases.push({ key: 'directories.catalog.constraints.summary.photo-count', values: { count: draft.maxPhotoCount } })
    }
  }
  if (type === 'phone') {
    if (draft.internationalPhone) phrases.push({ key: 'directories.catalog.constraints.summary.phone-international' })
    if (draft.phoneMask) phrases.push({ key: 'directories.catalog.constraints.summary.phone-mask', values: { mask: draft.phoneMask } })
  }
  if (type === 'email') {
    if (draft.validateEmailFormat) phrases.push({ key: 'directories.catalog.constraints.summary.email-format' })
    const length = draft.maxEmailLength ?? draft.maxLength
    if (typeof length === 'number' && length > 0) {
      phrases.push({ key: 'directories.catalog.constraints.summary.max-length', values: { count: length } })
    }
  }
  return phrases
}
