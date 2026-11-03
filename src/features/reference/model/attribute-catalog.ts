import type { DirectoryDefinition, DirectoryField, DirectoryPermissions } from '../../../entities/personnel/model/types'

export type FieldWrite = {
  id: string
  label: string
  required: boolean
  archived: boolean
  type: 'text'
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
    type: 'text',
  }
}

export function appendField(
  fields: DirectoryField[],
  draft: { label: string; required: boolean },
  temporaryId: string,
): FieldWrite[] {
  return [
    ...fields.map(fieldWrite),
    {
      id: temporaryId,
      label: draft.label.trim(),
      required: draft.required,
      archived: false,
      type: 'text',
    },
  ]
}

export function editableFieldPatch(
  directory: DirectoryDefinition,
  field: DirectoryField,
  draft: { label: string; required: boolean; archived: boolean },
): { label: string; required: boolean; archived: boolean } {
  const label = draft.label.trim()
  if (isProtectedCatalogField(directory, field)) {
    return { label, required: field.required, archived: field.archived }
  }
  return { label, required: draft.required, archived: draft.archived }
}

export function replaceField(
  directory: DirectoryDefinition,
  fieldId: string,
  draft: { label: string; required: boolean; archived: boolean },
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
