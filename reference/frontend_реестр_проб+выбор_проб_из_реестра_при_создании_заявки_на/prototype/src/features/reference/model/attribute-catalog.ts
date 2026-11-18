import type {
  CatalogAttributeType,
  DirectoryAttributeConstraints,
  DirectoryDefinition,
  DirectoryField,
  DirectoryPermissions,
} from '../../../entities/personnel/model/types'
import { normalizeConstraintsForWrite } from './attribute-field'

export const CATALOG_ALL_ID = '__all__'

export type CatalogFieldRow = {
  directoryId: string
  directoryTitle: string
  field: DirectoryField
}

export function isCatalogAllView(catalogId: string | null, directories: { id: string }[]): boolean {
  if (catalogId === CATALOG_ALL_ID) return true
  if (catalogId == null) return true
  return !directories.some((item) => item.id === catalogId)
}

export function flattenCatalogFields<T extends { id: string; title: string; fields: DirectoryField[] }>(
  directories: T[],
): CatalogFieldRow[] {
  return directories.flatMap((directory) =>
    directory.fields.map((field) => ({
      directoryId: directory.id,
      directoryTitle: directory.title,
      field,
    })),
  )
}

export function filterAllCatalogFields(rows: CatalogFieldRow[], query: string): CatalogFieldRow[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return rows
  return rows.filter((row) =>
    row.field.label.toLowerCase().includes(needle)
    || row.field.key.toLowerCase().includes(needle)
    || row.directoryTitle.toLowerCase().includes(needle),
  )
}

export type AttributeFieldDraft = {
  label: string
  required: boolean
  archived?: boolean
  type: CatalogAttributeType
  constraints?: DirectoryAttributeConstraints
}

export type FieldWrite = {
  id: string
  label: string
  required: boolean
  archived: boolean
  type: CatalogAttributeType
  constraints?: DirectoryAttributeConstraints
}

export type DeleteBlock = 'registry' | 'in-use' | 'label' | 'loading'

type UsageRecord = { values?: Record<string, string>; name?: string; code?: string }

export function filterCatalogDirectories<T extends DirectoryDefinition>(directories: T[], query: string): T[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return directories
  return directories.filter((item) => item.title.toLowerCase().includes(needle))
}

export function filterCatalogFields(fields: DirectoryField[], query: string): DirectoryField[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return fields
  return fields.filter((field) =>
    field.label.toLowerCase().includes(needle) || field.key.toLowerCase().includes(needle),
  )
}

/** Registry-backed directory; internal type kept for org-structure integration. */
export function isSystemDirectory(directory: DirectoryDefinition): boolean {
  return directory.source.type === 'registry'
}

/** Built-in registry column — not a user-defined extension (key is not `custom`). */
export function isProtectedCatalogField(
  directory: DirectoryDefinition,
  field: DirectoryField,
): boolean {
  return directory.source.type === 'registry' && field.key !== 'custom'
}

export function isUserCatalogField(field: DirectoryField): boolean {
  return field.key === 'custom'
}

export function canEditDirectoryStructure(permissions: Pick<DirectoryPermissions, 'structure'>): boolean {
  return permissions.structure
}

export function canAddAttribute(
  directory: DirectoryDefinition,
  permissions: Pick<DirectoryPermissions, 'structure' | 'schemaCreate'>,
): boolean {
  if (directory.source.type === 'registry') return permissions.schemaCreate
  return permissions.structure
}

export function canDeleteAttribute(
  directory: DirectoryDefinition,
  permissions: Pick<DirectoryPermissions, 'structure' | 'schemaDelete'>,
): boolean {
  if (directory.source.type === 'registry') return permissions.schemaDelete
  return permissions.structure
}

export function canReorderAttributes(permissions: Pick<DirectoryPermissions, 'structure'>): boolean {
  return permissions.structure
}

export function fieldWrite(field: DirectoryField): FieldWrite {
  return {
    id: field.id,
    label: field.label,
    required: field.required,
    archived: field.archived,
    type: field.type,
    ...(field.constraints ? { constraints: field.constraints } : {}),
  }
}

export function appendField(
  fields: DirectoryField[],
  draft: AttributeFieldDraft,
  temporaryId: string,
): FieldWrite[] {
  const constraints = normalizeConstraintsForWrite(draft.type, draft.constraints ?? {})
  return [
    ...fields.map(fieldWrite),
    {
      id: temporaryId,
      label: draft.label.trim(),
      required: draft.required,
      archived: draft.archived ?? false,
      type: draft.type,
      ...(constraints ? { constraints } : {}),
    },
  ]
}

export function editableFieldPatch(
  directory: DirectoryDefinition,
  field: DirectoryField,
  draft: AttributeFieldDraft & { archived: boolean },
): {
  label: string
  required: boolean
  archived: boolean
  type: CatalogAttributeType
  constraints?: DirectoryAttributeConstraints
} {
  const label = draft.label.trim()
  if (isProtectedCatalogField(directory, field)) {
    return { label, required: field.required, archived: field.archived, type: field.type, constraints: field.constraints }
  }
  const constraints = normalizeConstraintsForWrite(field.type, draft.constraints ?? field.constraints ?? {})
  return {
    label,
    required: draft.required,
    archived: draft.archived,
    type: field.type,
    constraints,
  }
}

export function replaceField(
  directory: DirectoryDefinition,
  fieldId: string,
  draft: AttributeFieldDraft & { archived: boolean },
): FieldWrite[] | null {
  const current = directory.fields.find((field) => field.id === fieldId)
  if (!current) return null
  const patch = editableFieldPatch(directory, current, draft)
  return directory.fields.map((field) => field.id === fieldId ? { ...fieldWrite(field), ...patch } : fieldWrite(field))
}

export function omitField(fields: DirectoryField[], fieldId: string): FieldWrite[] | null {
  if (!fields.some((field) => field.id === fieldId)) return null
  return fields.filter((field) => field.id !== fieldId).map(fieldWrite)
}

export function moveField(fields: DirectoryField[], activeId: string, overId: string): DirectoryField[] {
  const from = fields.findIndex((field) => field.id === activeId)
  const to = fields.findIndex((field) => field.id === overId)
  if (from < 0 || to < 0 || from === to) return fields
  const next = fields.slice()
  const [item] = next.splice(from, 1)
  if (!item) return fields
  next.splice(to, 0, item)
  return next
}

export function fieldHasStoredValues(
  records: UsageRecord[],
  fieldId: string,
  field?: Pick<DirectoryField, 'key'>,
): boolean {
  return records.some((record) => {
    if (field?.key === 'name') return (record.name ?? record.values?.[fieldId] ?? '').trim() !== ''
    if (field?.key === 'code') return (record.code ?? record.values?.[fieldId] ?? '').trim() !== ''
    return (record.values?.[fieldId] ?? '').trim() !== ''
  })
}

export function attributeDeleteBlock(
  directory: DirectoryDefinition,
  field: DirectoryField,
  records: UsageRecord[],
  usageKnown: boolean,
): DeleteBlock | null {
  if (isProtectedCatalogField(directory, field)) return 'registry'
  if (!usageKnown) return 'loading'
  if (field.key === 'title' && records.length > 0) return 'label'
  if (fieldHasStoredValues(records, field.id, field)) return 'in-use'
  return null
}
