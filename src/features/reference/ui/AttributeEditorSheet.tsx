import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { personnelError } from '../../../entities/personnel'
import type { DirectoryDefinition, DirectoryField } from '../../../entities/personnel/model/types'
import { useUnsavedSource } from '../../../shared/session/unsaved-work'
import { Button } from '../../../shared/ui/button'
import { Input } from '../../../shared/ui/input'
import { Label } from '../../../shared/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../shared/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '../../../shared/ui/sheet'
import { Switch } from '../../../shared/ui/switch'
import {
  appendField,
  isProtectedCatalogField,
  replaceField,
  type FieldWrite,
} from '../model/attribute-catalog'

export function AttributeEditorSheet({
  directory,
  field,
  onClose,
  onSubmit,
}: {
  directory: DirectoryDefinition
  field: DirectoryField | null
  onClose: () => void
  onSubmit: (fields: FieldWrite[]) => Promise<void>
}) {
  const { t } = useTranslation()
  const creating = field == null
  const protectedField = field != null && isProtectedCatalogField(directory, field)
  const [label, setLabel] = useState(field?.label ?? '')
  const [required, setRequired] = useState(field?.required ?? false)
  const [archived, setArchived] = useState(field?.archived ?? false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const dirty = field == null
    ? label.trim() !== '' || required
    : label !== field.label || required !== field.required || archived !== field.archived
  useUnsavedSource(`attribute:${field?.id ?? 'create'}`, dirty)

  const save = async () => {
    const trimmed = label.trim()
    if (!trimmed || trimmed.length > 200) {
      setError(t('directories.errors.invalid_value'))
      return
    }
    const fields = field == null
      ? appendField(directory.fields, { label: trimmed, required }, `new:${crypto.randomUUID()}`)
      : replaceField(directory, field.id, { label: trimmed, required, archived })
    if (!fields) {
      setError(t('directories.errors.unknown_field'))
      return
    }
    setSaving(true)
    setError('')
    try {
      await onSubmit(fields)
      onClose()
    } catch (caught) {
      setError(t(`directories.errors.${personnelError(caught).code}`, { defaultValue: t('directories.errors.generic') }))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open onOpenChange={(open) => { if (!open && !saving) onClose() }}>
      <SheetContent className="w-full gap-0 p-0 sm:max-w-md">
        <form
          className="flex h-full min-h-0 flex-col"
          onSubmit={(event) => {
            event.preventDefault()
            void save()
          }}
        >
          <SheetHeader className="border-b border-border px-6 py-4">
            <SheetTitle>{creating ? t('directories.catalog.create-title') : t('directories.catalog.edit-title')}</SheetTitle>
            <SheetDescription>{t('directories.catalog.directory-context', { title: directory.title })}</SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
            <div className="grid gap-1.5">
              <Label htmlFor="attribute-label">{t('directories.catalog.field-name')}</Label>
              <Input
                id="attribute-label"
                value={label}
                maxLength={200}
                onChange={(event) => setLabel(event.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="attribute-code">{t('directories.catalog.field-code')}</Label>
              <Input id="attribute-code" value={field?.key ?? 'custom'} disabled />
              <p className="text-xs text-muted-foreground">
                {creating ? t('directories.catalog.field-code-assigned') : t('directories.catalog.field-code-locked')}
              </p>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="attribute-type">{t('directories.catalog.field-type')}</Label>
              <Select value="text" disabled>
                <SelectTrigger id="attribute-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">{t('directories.catalog.types.text')}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{t('directories.catalog.field-type-note')}</p>
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="attribute-required">{t('directories.catalog.field-required')}</Label>
              <Switch
                id="attribute-required"
                checked={protectedField ? (field?.required ?? false) : required}
                disabled={protectedField || saving}
                onCheckedChange={setRequired}
              />
            </div>
            {!creating && !protectedField ? (
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="attribute-archived">{t('directories.catalog.field-archived')}</Label>
                <Switch id="attribute-archived" checked={archived} disabled={saving} onCheckedChange={setArchived} />
              </div>
            ) : null}
            {protectedField ? <p className="text-sm text-muted-foreground">{t('directories.catalog.system-note')}</p> : null}
            {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
          </div>
          <SheetFooter className="border-t border-border px-6 py-4">
            <Button type="button" variant="outline" disabled={saving} onClick={onClose}>{t('directories.cancel')}</Button>
            <Button type="submit" disabled={saving || label.trim() === ''}>{t('directories.catalog.save-attribute')}</Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
