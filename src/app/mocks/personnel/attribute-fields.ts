import {
  CATALOG_ATTRIBUTE_TYPES,
  CATALOG_DATE_DISPLAY_FORMATS,
  type CatalogAttributeType,
  type CatalogDateDisplayFormat,
  type DirectoryAttributeConstraints,
} from '../../../entities/personnel/model/types'
import { allowedKeys } from './gate'

const CONSTRAINT_KEYS = [
  'maxLength',
  'min',
  'max',
  'step',
  'integer',
  'minDate',
  'maxDate',
  'dateFormat',
  'extensions',
  'maxFileSizeMb',
  'maxFileCount',
  'photoFormats',
  'maxPhotoSizeMb',
  'maxPhotoCount',
  'internationalPhone',
  'phoneMask',
  'validateEmailFormat',
  'maxEmailLength',
] as const

export function parseCatalogFieldType(value: unknown, fallback: CatalogAttributeType = 'text'): CatalogAttributeType | null {
  if (value == null) return fallback
  if (typeof value !== 'string' || !(CATALOG_ATTRIBUTE_TYPES as readonly string[]).includes(value)) return null
  return value as CatalogAttributeType
}

function positiveInt(value: unknown, max: number): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return undefined
  return Math.min(Math.floor(value), max)
}

function finiteNumber(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
  return value
}

function isoDate(value: unknown): string | undefined {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
  return value
}

function shortText(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined
  return trimmed.slice(0, max)
}

export function parseDirectoryConstraints(
  type: CatalogAttributeType,
  raw: unknown,
): DirectoryAttributeConstraints | undefined | 'invalid' {
  if (raw == null) return undefined
  if (typeof raw !== 'object') return 'invalid'
  const record = raw as Record<string, unknown>
  if (!allowedKeys(record, [...CONSTRAINT_KEYS])) return 'invalid'
  const next: DirectoryAttributeConstraints = {}
  if (type === 'text' || type === 'textarea') {
    const maxLength = positiveInt(record.maxLength, 100_000)
    if (maxLength != null) next.maxLength = maxLength
  }
  if (type === 'email') {
    if (record.validateEmailFormat === true) next.validateEmailFormat = true
    const maxEmailLength = positiveInt(record.maxEmailLength ?? record.maxLength, 500)
    if (maxEmailLength != null) next.maxEmailLength = maxEmailLength
  }
  if (type === 'number') {
    for (const key of ['min', 'max', 'step'] as const) {
      const value = finiteNumber(record[key])
      if (value != null) next[key] = value
    }
    if (record.integer === true) next.integer = true
  }
  if (type === 'date') {
    const minDate = isoDate(record.minDate)
    const maxDate = isoDate(record.maxDate)
    if (minDate) next.minDate = minDate
    if (maxDate) next.maxDate = maxDate
    if (typeof record.dateFormat === 'string' && (CATALOG_DATE_DISPLAY_FORMATS as readonly string[]).includes(record.dateFormat)) {
      next.dateFormat = record.dateFormat as CatalogDateDisplayFormat
    }
  }
  if (type === 'file') {
    const extensions = shortText(record.extensions, 200)
    if (extensions) next.extensions = extensions
    const maxFileSizeMb = positiveInt(record.maxFileSizeMb, 10_000)
    if (maxFileSizeMb != null) next.maxFileSizeMb = maxFileSizeMb
    const maxFileCount = positiveInt(record.maxFileCount, 100)
    if (maxFileCount != null) next.maxFileCount = maxFileCount
  }
  if (type === 'photo') {
    const photoFormats = shortText(record.photoFormats, 200)
    if (photoFormats) next.photoFormats = photoFormats
    const maxPhotoSizeMb = positiveInt(record.maxPhotoSizeMb, 10_000)
    if (maxPhotoSizeMb != null) next.maxPhotoSizeMb = maxPhotoSizeMb
    const maxPhotoCount = positiveInt(record.maxPhotoCount, 100)
    if (maxPhotoCount != null) next.maxPhotoCount = maxPhotoCount
  }
  if (type === 'phone') {
    if (record.internationalPhone === true) next.internationalPhone = true
    const phoneMask = shortText(record.phoneMask, 80)
    if (phoneMask) next.phoneMask = phoneMask
  }
  return Object.keys(next).length > 0 ? next : undefined
}

export function constraintsEqual(
  left: DirectoryAttributeConstraints | undefined,
  right: DirectoryAttributeConstraints | undefined,
): boolean {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null)
}
