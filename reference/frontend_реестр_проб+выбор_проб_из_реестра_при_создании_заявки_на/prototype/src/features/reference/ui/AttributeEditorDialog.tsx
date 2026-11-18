import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  personnelError,
  useCreateDirectoryDefinitionMutation,
} from '../../../entities/personnel'
import {
  CATALOG_ATTRIBUTE_TYPES,
  type CatalogAttributeType,
  type DirectoryAttributeConstraints,
  type DirectoryDefinition,
  type DirectoryField,
} from '../../../entities/personnel/model/types'
import type { DirectoryView } from '../../../entities/personnel/model/personnelApi'
import { useUnsavedSource } from '../../../shared/session/unsaved-work'
import { Button } from '../../../shared/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../shared/ui/dialog'
import { Input } from '../../../shared/ui/input'
import { Label } from '../../../shared/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../shared/ui/select'
import { Switch } from '../../../shared/ui/switch'
import {
  appendField,
  isProtectedCatalogField,
  replaceField,
  type FieldWrite,
} from '../model/attribute-catalog'
import {
  constraintsForTypeChange,
  defaultConstraintsForType,
  NEW_ATTRIBUTE_GROUP_ID,
} from '../model/attribute-field'
import { AttributeFieldConstraints } from './AttributeFieldConstraints'

export function AttributeEditorDialog({
  organizationId,
  directories,
  directory,
  field,
  initialDirectoryId,
  onClose,
  onSubmit,
}: {
  organizationId: number
  directories: DirectoryView[]
  directory: DirectoryDefinition | null
  field: DirectoryField | null
  initialDirectoryId: string
  onClose: () => void
  onSubmit: (target: DirectoryDefinition, fields: FieldWrite[]) => Promise<void>
}) {
  const { t } = useTranslation()
  const creating = field == null
  const protectedField = field != null && directory != null && isProtectedCatalogField(directory, field)
  const [label, setLabel] = useState(field?.label ?? '')
  const [required, setRequired] = useState(field?.required ?? false)
  const [archived, setArchived] = useState(field?.archived ?? false)
  const [fieldType, setFieldType] = useState<CatalogAttributeType>(field?.type ?? 'text')
  const [constraints, setConstraints] = useState<DirectoryAttributeConstraints>(
    field?.constraints ?? defaultConstraintsForType(field?.type ?? 'text'),
  )
  const [groupId, setGroupId] = useState(initialDirectoryId || directories[0]?.id || NEW_ATTRIBUTE_GROUP_ID)
  const [newGroupTitle, setNewGroupTitle] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [createDefinition, createDefinitionState] = useCreateDirectoryDefinitionMutation()

  const dirty = creating
    ? label.trim() !== '' || required || groupId === NEW_ATTRIBUTE_GROUP_ID || newGroupTitle.trim() !== ''
    : label !== field?.label || required !== field?.required || archived !== field?.archived
      || JSON.stringify(constraints) !== JSON.stringify(field?.constraints ?? defaultConstraintsForType(fieldType))
  useUnsavedSource(`attribute:${field?.id ?? 'create'}`, dirty)

  const groupOptions = useMemo(
    () => directories.map((item) => ({ value: item.id, label: item.title })),
    [directories],
  )
  const canPickGroup = creating && directories.length > 0

  const onTypeChange = (next: CatalogAttributeType) => {
    setFieldType(next)
    setConstraints(constraintsForTypeChange(next))
  }

  const resolveDirectory = async (): Promise<DirectoryDefinition | null> => {
    if (!creating) return directory
    if (groupId === NEW_ATTRIBUTE_GROUP_ID) {
      const title = newGroupTitle.trim()
      if (!title) return null
      try {
        const created = await createDefinition({
          organizationId,
          title,
          description: '',
          section: 'other',
        }).unwrap()
        return created
      } catch {
        return null
      }
    }
    const picked = directories.find((item) => item.id === groupId) ?? directories[0]
    return picked ?? null
  }

  const save = async () => {
    const trimmed = label.trim()
    if (!trimmed || trimmed.length > 200) {
      setError(t('directories.errors.invalid_value'))
      return
    }
    const target = await resolveDirectory()
    if (!target) {
      setError(t('directories.catalog.field-group-required'))
      return
    }
    const fields = creating
      ? appendField(target.fields, { label: trimmed, required, type: fieldType, constraints }, `new:${crypto.randomUUID()}`)
      : directory && field
        ? replaceField(directory, field.id, { label: trimmed, required, archived, type: field.type, constraints })
        : null
    if (!fields) {
      setError(t('directories.errors.unknown_field'))
      return
    }
    setSaving(true)
    setError('')
    try {
      await onSubmit(target, fields)
      onClose()
    } catch (caught) {
      setError(t(`directories.errors.${personnelError(caught).code}`, { defaultValue: t('directories.errors.generic') }))
    } finally {
      setSaving(false)
    }
  }

  const pending = saving || createDefinitionState.isLoading

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !pending) onClose() }}>
      <DialogContent className="flex max-h-[min(90vh,44rem)] w-[min(100%,36rem)] max-w-xl flex-col gap-0 overflow-hidden p-0">
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => {
            event.preventDefault()
            void save()
          }}
        >
          <DialogHeader className="shrink-0 space-y-1 border-b border-border px-6 py-4 pr-12 text-left">
            <DialogTitle>{creating ? t('directories.catalog.create-title') : t('directories.catalog.edit-title')}</DialogTitle>
            <DialogDescription>
              {creating
                ? t('directories.catalog.create-lead')
                : t('directories.catalog.directory-context', { title: directory?.title ?? '' })}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
            <div className="grid gap-1.5">
              <Label htmlFor="attribute-label">{t('directories.catalog.field-name')}</Label>
              <Input
                id="attribute-label"
                value={label}
                maxLength={200}
                disabled={pending}
                onChange={(event) => setLabel(event.target.value)}
              />
            </div>
            {canPickGroup ? (
              <div className="grid gap-1.5">
                <Label htmlFor="attribute-group">{t('directories.catalog.field-group')}</Label>
                <Select value={groupId} disabled={pending} onValueChange={setGroupId}>
                  <SelectTrigger id="attribute-group">
                    <SelectValue placeholder={t('directories.catalog.field-group-placeholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {groupOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                    <SelectItem value={NEW_ATTRIBUTE_GROUP_ID}>{t('directories.catalog.field-group-new')}</SelectItem>
                  </SelectContent>
                </Select>
                {groupId === NEW_ATTRIBUTE_GROUP_ID ? (
                  <Input
                    aria-label={t('directories.catalog.field-group-new-title')}
                    value={newGroupTitle}
                    maxLength={200}
                    disabled={pending}
                    placeholder={t('directories.catalog.field-group-new-placeholder')}
                    onChange={(event) => setNewGroupTitle(event.target.value)}
                  />
                ) : null}
              </div>
            ) : null}
            {!creating ? (
              <div className="grid gap-1.5">
                <Label htmlFor="attribute-code">{t('directories.catalog.field-code')}</Label>
                <Input id="attribute-code" value={field?.key ?? 'custom'} disabled />
              </div>
            ) : null}
            <div className="grid gap-1.5">
              <Label htmlFor="attribute-type">{t('directories.catalog.field-type')}</Label>
              <Select
                value={fieldType}
                disabled={pending || !creating || protectedField}
                onValueChange={(value) => onTypeChange(value as CatalogAttributeType)}
              >
                <SelectTrigger id="attribute-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATALOG_ATTRIBUTE_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>{t(`directories.catalog.types.${type}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!creating ? <p className="text-xs text-muted-foreground">{t('directories.catalog.field-type-locked')}</p> : null}
            </div>
            {!protectedField ? (
              <div className="space-y-2 rounded-lg border border-border p-3">
                <div className="text-sm font-medium">{t('directories.catalog.constraints.title')}</div>
                <AttributeFieldConstraints
                  type={fieldType}
                  constraints={constraints}
                  disabled={pending}
                  onChange={setConstraints}
                />
              </div>
            ) : null}
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="attribute-required">{t('directories.catalog.field-required')}</Label>
              <Switch
                id="attribute-required"
                checked={protectedField ? (field?.required ?? false) : required}
                disabled={protectedField || pending}
                onCheckedChange={setRequired}
              />
            </div>
            {!creating && !protectedField ? (
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="attribute-archived">{t('directories.catalog.field-archived')}</Label>
                <Switch id="attribute-archived" checked={archived} disabled={pending} onCheckedChange={setArchived} />
              </div>
            ) : null}
            {protectedField ? <p className="text-sm text-muted-foreground">{t('directories.catalog.system-note')}</p> : null}
            {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
          </div>
          <DialogFooter className="shrink-0 border-t border-border px-6 py-4 sm:justify-end">
            <Button type="button" variant="outline" disabled={pending} onClick={onClose}>{t('directories.cancel')}</Button>
            <Button
              type="submit"
              disabled={pending || label.trim() === '' || (creating && groupId === NEW_ATTRIBUTE_GROUP_ID && newGroupTitle.trim() === '')}
            >
              {t('directories.catalog.save-attribute')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
