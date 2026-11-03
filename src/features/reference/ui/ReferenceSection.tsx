import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  personnelError,
  useArchiveDirectoryRecordMutation,
  useCreateDirectoryRecordMutation,
  useDeleteDirectoryRecordMutation,
  useGetDirectoriesQuery,
  useGetDirectoryQuery,
  useInitializePersonnelWorkspaceMutation,
  useUpdateDirectoryDefinitionMutation,
  useUpdateDirectoryRecordMutation,
} from '../../../entities/personnel'
import { directoryId } from '../../../entities/personnel/model/template'
import type { DirectoryDefinition } from '../../../entities/personnel/model/types'
import type { DirectoryRecord } from '../../../entities/personnel/model/personnelApi'
import { useUnsavedSource } from '../../../shared/session/unsaved-work'
import { Button } from '../../../shared/ui/button'
import { Input } from '../../../shared/ui/input'
import { Label } from '../../../shared/ui/label'
import { PageHeader, PageState } from '../../../shared/ui/page'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../shared/ui/table'

type Draft = {
  name: string
  code: string
  parentId: string
  departmentId: string
  values: Record<string, string>
}

const emptyDraft: Draft = { name: '', code: '', parentId: '', departmentId: '', values: {} }

export function ReferenceSection({ organizationId, scopeLabel }: { organizationId: number; scopeLabel?: string }) {
  const { t } = useTranslation()
  const list = useGetDirectoriesQuery({ organizationId })
  const [directoryId, setDirectoryId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const directories = list.data?.directories ?? []
  const selectedId = directoryId && directories.some((item) => item.id === directoryId)
    ? directoryId
    : directories[0]?.id ?? null
  const detail = useGetDirectoryQuery(
    { organizationId, directoryId: selectedId ?? '' },
    { skip: selectedId == null },
  )
  const [initialize, initializeState] = useInitializePersonnelWorkspaceMutation()
  const needle = query.trim().toLowerCase()
  const visible = directories.filter((item) => !needle || item.title.toLowerCase().includes(needle) || item.key.includes(needle))

  if (list.isLoading) return <PageState kind="loading" description={t('directories.loading')} />
  if (list.isError) {
    return (
      <PageState
        kind="error"
        description={t(`directories.errors.${personnelError(list.error).code}`, { defaultValue: t('directories.errors.generic') })}
        action={<Button type="button" variant="outline" onClick={() => void list.refetch()}>{t('workspace.retry')}</Button>}
      />
    )
  }
  if (list.data && !list.data.initialized) {
    return (
      <section className="space-y-4">
        <PageHeader title={t('nav.reference')} description={scopeLabel} />
        <PageState
          kind="empty"
          description={t('directories.missing')}
          action={list.data.canInitialize ? (
            <Button type="button" disabled={initializeState.isLoading} onClick={() => void initialize({ organizationId })}>
              {t('directories.prepare')}
            </Button>
          ) : undefined}
        />
      </section>
    )
  }

  return (
    <section className="space-y-4">
      <PageHeader title={t('nav.reference')} description={scopeLabel} />
      <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        <div className="space-y-2">
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('directories.search')} aria-label={t('directories.search')} />
          {visible.length === 0 ? <p className="text-sm text-muted-foreground">{t('directories.empty-list')}</p> : null}
          <div className="flex flex-col gap-1">
            {visible.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`rounded-md border px-3 py-2 text-left text-sm ${item.id === selectedId ? 'border-primary bg-primary/10' : 'border-border'}`}
                onClick={() => setDirectoryId(item.id)}
              >
                <span className="block font-medium">{item.title}</span>
                {item.archived ? <span className="text-xs text-muted-foreground">{t('directories.archived')}</span> : null}
              </button>
            ))}
          </div>
        </div>
        {selectedId && detail.data ? (
          <DirectoryRecords
            organizationId={organizationId}
            directory={detail.data.directory}
            records={detail.data.records}
            permissions={detail.data.permissions}
          />
        ) : detail.isLoading ? <PageState kind="loading" description={t('directories.loading')} /> : null}
      </div>
    </section>
  )
}

function DirectoryRecords({
  organizationId,
  directory,
  records,
  permissions,
}: {
  organizationId: number
  directory: DirectoryDefinition
  records: DirectoryRecord[]
  permissions: { update: boolean; archive: boolean; delete: boolean; structure: boolean }
}) {
  const { t } = useTranslation()
  const [recordQuery, setRecordQuery] = useState('')
  const [editing, setEditing] = useState<DirectoryRecord | 'new' | null>(null)
  const [structure, setStructure] = useState(false)
  const [error, setError] = useState('')
  const [archiveRecord] = useArchiveDirectoryRecordMutation()
  const [removeRecord] = useDeleteDirectoryRecordMutation()
  const needle = recordQuery.trim().toLowerCase()
  const shown = records.filter((record) => !needle || record.label.toLowerCase().includes(needle))

  const run = async (action: Promise<unknown>) => {
    setError('')
    try {
      await action
    } catch (caught) {
      setError(t(`directories.errors.${personnelError(caught).code}`, { defaultValue: t('directories.errors.generic') }))
    }
  }

  return (
    <div className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">{directory.title}</h2>
          {directory.description ? <p className="text-sm text-muted-foreground">{directory.description}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {permissions.structure ? <Button type="button" variant="outline" onClick={() => setStructure(true)}>{t('directories.edit-definition')}</Button> : null}
          {permissions.update && !directory.archived ? <Button type="button" onClick={() => setEditing('new')}>{t('directories.add-record')}</Button> : null}
        </div>
      </div>
      <Input value={recordQuery} onChange={(event) => setRecordQuery(event.target.value)} placeholder={t('directories.search-records')} aria-label={t('directories.search-records')} />
      {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
      {shown.length === 0 ? <PageState kind="empty" description={t('directories.empty-records')} /> : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('directories.column-value')}</TableHead>
              <TableHead>{t('directories.column-state')}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((record) => (
              <TableRow key={record.id}>
                <TableCell>
                  {record.label}
                  {record.code ? <span className="ml-2 text-muted-foreground">{record.code}</span> : null}
                </TableCell>
                <TableCell>{record.archived ? t('directories.archived') : t('directories.active')}</TableCell>
                <TableCell className="space-x-2 text-right">
                  {permissions.update ? <Button type="button" variant="outline" size="sm" onClick={() => setEditing(record)}>{t('directories.edit')}</Button> : null}
                  {permissions.archive ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void run(archiveRecord({
                        directoryId: directory.id,
                        recordId: record.id,
                        body: { organizationId, expectedRevision: record.revision, archived: !record.archived },
                      }).unwrap())}
                    >
                      {record.archived ? t('directories.restore') : t('directories.archive')}
                    </Button>
                  ) : null}
                  {permissions.delete ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void run(removeRecord({
                        organizationId,
                        directoryId: directory.id,
                        recordId: record.id,
                        expectedRevision: record.revision,
                      }).unwrap())}
                    >
                      {t('directories.delete')}
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {editing ? (
        <RecordDialog
          organizationId={organizationId}
          directory={directory}
          records={records}
          record={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
      {structure ? <StructureDialog organizationId={organizationId} directory={directory} onClose={() => setStructure(false)} /> : null}
    </div>
  )
}

function RecordDialog({
  organizationId,
  directory,
  records,
  record,
  onClose,
}: {
  organizationId: number
  directory: DirectoryDefinition
  records: DirectoryRecord[]
  record: DirectoryRecord | null
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState<Draft>(() => record ? {
    name: record.name ?? '',
    code: record.code ?? '',
    parentId: record.parentId ?? '',
    departmentId: record.departmentId ?? '',
    values: { ...(record.values ?? {}) },
  } : emptyDraft)
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
  useUnsavedSource(`directory-record:${record?.id ?? 'new'}`, dirty)
  const registry = directory.source.type === 'registry' ? directory.source.registry : null
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
    const body = registry === 'departments'
      ? { organizationId, name: draft.name, code: draft.code, parentId: draft.parentId || null }
      : registry === 'workplaces'
        ? { organizationId, name: draft.name, departmentId: draft.departmentId || null }
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
    <div className="rounded-lg border border-border p-4" role="dialog" aria-label={t('directories.record-dialog')}>
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
                <label className="grid gap-1 text-sm">
                  {t('directories.parent')}
                  <select className="h-9 rounded-md border border-border bg-background px-2" value={draft.parentId} onChange={(event) => setDraft({ ...draft, parentId: event.target.value })}>
                    <option value="">{t('directories.no-parent')}</option>
                    {parents.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                  </select>
                </label>
              </>
            ) : (
              <label className="grid gap-1 text-sm">
                {t('directories.department')}
                <select className="h-9 rounded-md border border-border bg-background px-2" value={draft.departmentId} onChange={(event) => setDraft({ ...draft, departmentId: event.target.value })}>
                  <option value="">{t('directories.no-department')}</option>
                  {parents.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                </select>
              </label>
            )}
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
        <div className="flex gap-2">
          <Button type="button" disabled={createState.isLoading || updateState.isLoading} onClick={() => void save()}>{t('directories.save')}</Button>
          <Button type="button" variant="outline" onClick={onClose}>{t('directories.cancel')}</Button>
        </div>
      </div>
    </div>
  )
}

function StructureDialog({
  organizationId,
  directory,
  onClose,
}: {
  organizationId: number
  directory: DirectoryDefinition
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [title, setTitle] = useState(directory.title)
  const [description, setDescription] = useState(directory.description)
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
  const dirty = title !== directory.title || description !== directory.description || archived !== directory.archived
  useUnsavedSource(`directory-structure:${directory.id}`, dirty)
  const manual = directory.source.type === 'manual'

  const save = async () => {
    setError('')
    try {
      await saveDefinition({
        directoryId: directory.id,
        body: { organizationId, expectedRevision: directory.revision, title, description, archived, fields },
      }).unwrap()
      onClose()
    } catch (caught) {
      setError(t(`directories.errors.${personnelError(caught).code}`, { defaultValue: t('directories.errors.generic') }))
    }
  }

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="grid gap-3">
        <Label>{t('directories.definition-title')}</Label>
        <Input value={title} onChange={(event) => setTitle(event.target.value)} />
        <Label>{t('directories.definition-description')}</Label>
        <Input value={description} onChange={(event) => setDescription(event.target.value)} />
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
        <div className="flex gap-2">
          <Button type="button" disabled={saveState.isLoading} onClick={() => void save()}>{t('directories.save')}</Button>
          <Button type="button" variant="outline" onClick={onClose}>{t('directories.cancel')}</Button>
        </div>
      </div>
    </div>
  )
}
