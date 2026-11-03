import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  personnelError,
  useCreateDirectoryDefinitionMutation,
  useCreateDirectoryRecordMutation,
  useGetDirectoryQuery,
  useUpdateDirectoryDefinitionMutation,
  useUpdateDirectoryRecordMutation,
} from '../../../entities/personnel'
import { directoryId } from '../../../entities/personnel/model/template'
import type { DirectoryDefinition } from '../../../entities/personnel/model/types'
import type { DirectoryRecord } from '../../../entities/personnel/model/personnelApi'
import { useUnsavedSource } from '../../../shared/session/unsaved-work'
import { Button } from '../../../shared/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../../shared/ui/dialog'
import { Input } from '../../../shared/ui/input'
import { Label } from '../../../shared/ui/label'
import type { DirectoryCatalogSection } from '../../../entities/personnel/model/types'
import { initialCatalogSection } from '../model/directory-metadata'
import { DirectoryRecordSelect } from '../../../shared/ui/directory-record-select'
import { DirectorySectionField, DirectoryTypeField } from './directory-meta-fields'

type Draft = {
  name: string
  code: string
  parentId: string
  departmentId: string
  values: Record<string, string>
}

const emptyDraft: Draft = { name: '', code: '', parentId: '', departmentId: '', values: {} }

export function CreateDirectoryDialog({
  organizationId,
  open,
  onOpenChange,
  onCreated,
}: {
  organizationId: number
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: (directoryId: string) => void
}) {
  const { t } = useTranslation()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [section, setSection] = useState<DirectoryCatalogSection>('other')
  const [error, setError] = useState('')
  const [createDefinition, createState] = useCreateDirectoryDefinitionMutation()
  const dirty = open && (title.trim() !== '' || description.trim() !== '' || section !== 'other')
  useUnsavedSource('directory-create', dirty)

  const reset = () => {
    setTitle('')
    setDescription('')
    setSection('other')
    setError('')
  }

  const save = async () => {
    setError('')
    const trimmed = title.trim()
    if (!trimmed) {
      setError(t('directories.errors.invalid_value'))
      return
    }
    try {
      const created = await createDefinition({
        organizationId,
        title: trimmed,
        description: description.trim(),
        section,
      }).unwrap()
      reset()
      onOpenChange(false)
      onCreated?.(created.id)
    } catch (caught) {
      setError(t(`directories.errors.${personnelError(caught).code}`, { defaultValue: t('directories.errors.generic') }))
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('directories.create-title')}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <label className="grid gap-1 text-sm">
            {t('directories.definition-title')}
            <Input value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm">
            {t('directories.definition-description')}
            <Input value={description} onChange={(event) => setDescription(event.target.value)} />
          </label>
          <DirectorySectionField
            id="directory-create-section"
            value={section}
            onChange={setSection}
          />
          <DirectoryTypeField mode="create" createType="manual" />
          {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t('directories.cancel')}</Button>
          <Button type="button" disabled={createState.isLoading} onClick={() => void save()}>{t('directories.create')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function draftFromRecord(record: DirectoryRecord | null): Draft {
  return record ? {
    name: record.name ?? '',
    code: record.code ?? '',
    parentId: record.parentId ?? '',
    departmentId: record.departmentId ?? '',
    values: { ...(record.values ?? {}) },
  } : emptyDraft
}

export function RecordDialog({
  open,
  organizationId,
  directory,
  records,
  record,
  onClose,
}: {
  open: boolean
  organizationId: number
  directory: DirectoryDefinition
  records: DirectoryRecord[]
  record: DirectoryRecord | null
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState<Draft>(() => draftFromRecord(record))
  const [error, setError] = useState('')
  const [createRecord, createState] = useCreateDirectoryRecordMutation()
  const [updateRecord, updateState] = useUpdateDirectoryRecordMutation()
  const dirty = JSON.stringify(draft) !== JSON.stringify(record ? {
    name: record.name ?? '',
    code: record.code ?? '',
    parentId: record.parentId ?? '',
    departmentId: record.departmentId ?? '',
    values: record.values ?? {},
  } : emptyDraft)
  useUnsavedSource(`directory-record:${record?.id ?? 'new'}`, open && dirty)
  useEffect(() => {
    if (!open) return
    setDraft(draftFromRecord(record))
    setError('')
  }, [open, record])
  const registry = directory.source.type === 'registry' ? directory.source.registry : null
  const extensionFields = directory.fields.filter((field) => field.key === 'custom' && !field.archived)
  const departmentList = useGetDirectoryQuery(
    { organizationId, directoryId: directoryId(organizationId, 'departments') },
    { skip: registry !== 'workplaces' },
  )
  const parents = useMemo(() => {
    const source = registry === 'workplaces' ? departmentList.data?.records ?? [] : records
    return source.filter((item) => item.id !== record?.id && !item.archived)
  }, [departmentList.data?.records, record?.id, records, registry])

  const save = async () => {
    setError('')
    const extensionValues = Object.fromEntries(extensionFields.map((field) => [field.id, draft.values[field.id] ?? '']))
    const body = registry === 'departments'
      ? { organizationId, name: draft.name, code: draft.code, parentId: draft.parentId || null, values: extensionValues }
      : registry === 'workplaces'
        ? { organizationId, name: draft.name, departmentId: draft.departmentId || null, values: extensionValues }
        : { organizationId, values: draft.values }
    try {
      if (record) {
        await updateRecord({
          directoryId: directory.id,
          recordId: record.id,
          body: { ...body, expectedRevision: record.revision },
        }).unwrap()
      } else {
        await createRecord({ directoryId: directory.id, body }).unwrap()
      }
      onClose()
    } catch (caught) {
      setError(t(`directories.errors.${personnelError(caught).code}`, { defaultValue: t('directories.errors.generic') }))
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{record ? t('directories.edit-record') : t('directories.new-record')}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          {registry ? (
            <>
              <label className="grid gap-1 text-sm">
                {t('directories.name')}
                <Input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
              </label>
              {registry === 'departments' ? (
                <>
                  <label className="grid gap-1 text-sm">
                    {t('directories.code')}
                    <Input value={draft.code} onChange={(event) => setDraft({ ...draft, code: event.target.value })} />
                  </label>
                  <DirectoryRecordSelect
                    label={t('directories.parent')}
                    emptyLabel={t('directories.no-parent')}
                    value={draft.parentId}
                    items={parents.map((item) => ({ id: item.id, label: item.label }))}
                    onChange={(parentId) => setDraft({ ...draft, parentId })}
                  />
                </>
              ) : (
                <DirectoryRecordSelect
                  label={t('directories.department')}
                  emptyLabel={t('directories.no-department')}
                  value={draft.departmentId}
                  items={parents.map((item) => ({ id: item.id, label: item.label }))}
                  onChange={(departmentId) => setDraft({ ...draft, departmentId })}
                />
              )}
              {extensionFields.length > 0 ? (
                <div className="grid gap-3 border-t border-border pt-3">
                  <p className="text-sm font-medium">{t('directories.extra-attributes')}</p>
                  {extensionFields.map((field) => (
                    <label key={field.id} className="grid gap-1 text-sm">
                      {field.label}{field.required ? ' *' : ''}
                      <Input
                        value={draft.values[field.id] ?? ''}
                        onChange={(event) => setDraft({ ...draft, values: { ...draft.values, [field.id]: event.target.value } })}
                      />
                    </label>
                  ))}
                </div>
              ) : null}
            </>
          ) : directory.fields.filter((field) => !field.archived).map((field) => (
            <label key={field.id} className="grid gap-1 text-sm">
              {field.label}
              <Input
                value={draft.values[field.id] ?? ''}
                onChange={(event) => setDraft({ ...draft, values: { ...draft.values, [field.id]: event.target.value } })}
              />
            </label>
          ))}
          {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={onClose}>{t('directories.cancel')}</Button>
          <Button type="button" disabled={createState.isLoading || updateState.isLoading} onClick={() => void save()}>{t('directories.save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function StructureDialog({
  open,
  organizationId,
  directory,
  onClose,
}: {
  open: boolean
  organizationId: number
  directory: DirectoryDefinition
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [title, setTitle] = useState(directory.title)
  const [description, setDescription] = useState(directory.description)
  const [section, setSection] = useState<DirectoryCatalogSection>(() => initialCatalogSection(directory))
  const [archived, setArchived] = useState(directory.archived)
  const [fields, setFields] = useState(directory.fields.map((field) => ({
    id: field.id,
    label: field.label,
    required: field.required,
    archived: field.archived,
    type: field.type,
  })))
  const [error, setError] = useState('')
  const [saveDefinition, saveState] = useUpdateDirectoryDefinitionMutation()
  const dirty = title !== directory.title
    || description !== directory.description
    || archived !== directory.archived
    || section !== initialCatalogSection(directory)
  useUnsavedSource(`directory-structure:${directory.id}`, dirty)
  const manual = directory.source.type === 'manual'

  const save = async () => {
    setError('')
    try {
      await saveDefinition({
        directoryId: directory.id,
        body: {
          organizationId,
          expectedRevision: directory.revision,
          title,
          description,
          archived,
          fields,
          section,
        },
      }).unwrap()
      onClose()
    } catch (caught) {
      setError(t(`directories.errors.${personnelError(caught).code}`, { defaultValue: t('directories.errors.generic') }))
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('directories.structure-title')}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <Label>{t('directories.definition-title')}</Label>
          <Input value={title} onChange={(event) => setTitle(event.target.value)} />
          <Label>{t('directories.definition-description')}</Label>
          <Input value={description} onChange={(event) => setDescription(event.target.value)} />
          <DirectorySectionField
            id={`directory-structure-section-${directory.id}`}
            value={section}
            onChange={setSection}
          />
          <DirectoryTypeField mode="edit" definition={directory} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={archived} onChange={(event) => setArchived(event.target.checked)} />
            {t('directories.archive-definition')}
          </label>
          {fields.map((field, index) => (
            <label key={field.id} className="grid gap-1 text-sm">
              {t('directories.field-label')}
              <Input
                value={field.label}
                onChange={(event) => setFields(fields.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item))}
              />
            </label>
          ))}
          {manual ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setFields([...fields, { id: `new:${fields.length}`, label: '', required: false, archived: false, type: 'text' }])}
            >
              {t('directories.add-field')}
            </Button>
          ) : null}
          {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={onClose}>{t('directories.cancel')}</Button>
          <Button type="button" disabled={saveState.isLoading} onClick={() => void save()}>{t('directories.save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
