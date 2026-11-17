import { useMemo, useRef, useState } from 'react'
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
import { Checkbox } from '../../../shared/ui/checkbox'
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
} from '../model/attribute-field'
import { AttributeFieldConstraints } from './AttributeFieldConstraints'
import { focusFormField } from './focus-form-field'
import { FieldLabel, MembershipChoices } from './membership-choices'

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
  onSubmit: (target: DirectoryDefinition, fields: FieldWrite[], announce?: boolean) => Promise<void>
}) {
  const { t } = useTranslation()
  const formRef = useRef<HTMLFormElement>(null)
  const bundleId = useRef(`ab-${crypto.randomUUID()}`)
  const creating = field == null
  const protectedField = field != null && directory != null && isProtectedCatalogField(directory, field)
  const initialGroups = initialDirectoryId && directories.some((item) => item.id === initialDirectoryId)
    ? [initialDirectoryId]
    : []
  const [label, setLabel] = useState(field?.label ?? '')
  const [required, setRequired] = useState(field?.required ?? false)
  const [archived, setArchived] = useState(field?.archived ?? false)
  const [fieldType, setFieldType] = useState<CatalogAttributeType>(field?.type ?? 'text')
  const [constraints, setConstraints] = useState<DirectoryAttributeConstraints>(
    field?.constraints ?? defaultConstraintsForType(field?.type ?? 'text'),
  )
  const [groupIds, setGroupIds] = useState<string[]>(initialGroups)
  const [creatingNew, setCreatingNew] = useState(false)
  const [newGroupTitle, setNewGroupTitle] = useState('')
  const [createdDirectory, setCreatedDirectory] = useState<DirectoryDefinition | null>(null)
  const [appliedIds, setAppliedIds] = useState<string[]>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [createDefinition, createDefinitionState] = useCreateDirectoryDefinitionMutation()
  const groupsDirty = groupIds.length !== initialGroups.length || groupIds.some((id) => !initialGroups.includes(id))

  const dirty = creating
    ? label.trim() !== '' || required || groupsDirty || creatingNew || newGroupTitle.trim() !== ''
    : label !== field?.label || required !== field?.required || archived !== field?.archived
      || JSON.stringify(constraints) !== JSON.stringify(field?.constraints ?? defaultConstraintsForType(fieldType))
  useUnsavedSource(`attribute:${field?.id ?? 'create'}`, dirty)

  const groupOptions = useMemo(
    () => directories.map((item) => ({ value: item.id, label: item.title })),
    [directories],
  )

  const onTypeChange = (next: CatalogAttributeType) => {
    setFieldType(next)
    setConstraints(constraintsForTypeChange(next))
  }

  const resolveTargets = async (): Promise<DirectoryDefinition[] | null> => {
    if (!creating) return directory ? [directory] : null
    if (creatingNew && newGroupTitle.trim() === '') return null
    if (groupIds.length === 0 && !creatingNew) return null
    const targets: DirectoryDefinition[] = []
    for (const id of groupIds) {
      const picked = directories.find((item) => item.id === id)
      if (picked && !targets.some((item) => item.id === picked.id)) targets.push(picked)
    }
    if (creatingNew) {
      const title = newGroupTitle.trim()
      let created = createdDirectory
      if (!created) {
        created = await createDefinition({
          organizationId,
          title,
          description: '',
          sections: ['other'],
        }).unwrap()
        setCreatedDirectory(created)
      }
      if (!targets.some((item) => item.id === created.id)) targets.push(created)
    }
    return targets
  }

  const save = async () => {
    const trimmed = label.trim()
    if (!trimmed || trimmed.length > 200) {
      setError(t('directories.errors.invalid_value'))
      focusFormField(formRef.current, 'label')
      return
    }
    if (creating && creatingNew && newGroupTitle.trim() === '') {
      setError(t('directories.catalog.field-group-required'))
      focusFormField(formRef.current, 'group-title')
      return
    }
    if (creating && groupIds.length === 0 && !creatingNew) {
      setError(t('directories.catalog.field-groups-required'))
      focusFormField(formRef.current, 'groups')
      return
    }
    setSaving(true)
    setError('')
    try {
      const targets = await resolveTargets()
      if (!targets?.length) {
        setError(t('directories.catalog.field-groups-required'))
        focusFormField(formRef.current, 'groups')
        return
      }
      const done = new Set(appliedIds)
      const pendingTargets = targets.filter((target) => !done.has(target.id))
      for (let index = 0; index < pendingTargets.length; index += 1) {
        const target = pendingTargets[index]
        if (!target) continue
        const fields = creating
          ? appendField(
            target.fields,
            { label: trimmed, required, type: fieldType, constraints },
            `new:${crypto.randomUUID()}`,
            bundleId.current,
          )
          : directory && field
            ? replaceField(directory, field.id, { label: trimmed, required, archived, type: field.type, constraints })
            : null
        if (!fields) {
          setError(t('directories.errors.unknown_field'))
          return
        }
        await onSubmit(target, fields, index === pendingTargets.length - 1)
        done.add(target.id)
        setAppliedIds([...done])
      }
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
          ref={formRef}
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
            <div className="grid gap-1.5" data-field="label">
              <FieldLabel htmlFor="attribute-label" required>{t('directories.catalog.field-name')}</FieldLabel>
              <Input
                id="attribute-label"
                value={label}
                maxLength={200}
                disabled={pending}
                onChange={(event) => setLabel(event.target.value)}
              />
            </div>
            {creating ? (
              <div className="grid gap-1.5" data-field="groups">
                <FieldLabel id="attribute-group-label" required>{t('directories.catalog.field-group')}</FieldLabel>
                {groupOptions.length > 0 ? (
                  <MembershipChoices
                    labelledBy="attribute-group-label"
                    value={groupIds}
                    disabled={pending}
                    onChange={setGroupIds}
                    options={groupOptions}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">{t('directories.catalog.empty-directories')}</p>
                )}
                <p className="text-xs text-muted-foreground">{t('directories.catalog.field-group-hint')}</p>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={creatingNew}
                    disabled={pending}
                    onCheckedChange={(next) => setCreatingNew(next === true)}
                  />
                  {t('directories.catalog.field-group-new')}
                </label>
                {creatingNew ? (
                  <div data-field="group-title">
                    <Input
                      aria-label={t('directories.catalog.field-group-new-title')}
                      value={newGroupTitle}
                      maxLength={200}
                      disabled={pending}
                      placeholder={t('directories.catalog.field-group-new-placeholder')}
                      onChange={(event) => setNewGroupTitle(event.target.value)}
                    />
                  </div>
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
              disabled={
                pending
                || label.trim() === ''
                || (creating && groupIds.length === 0 && !creatingNew)
                || (creating && creatingNew && newGroupTitle.trim() === '')
              }
            >
              {t('directories.catalog.save-attribute')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
