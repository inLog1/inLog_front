import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'
import { personnelError, useCreateDirectoryRecordMutation, type DirectoryOptions } from '../../../entities/personnel'
import { Button } from '../../../shared/ui/button'
import { DialogTitle } from '../../../shared/ui/dialog'
import { DirectoryRecordSelect } from '../../../shared/ui/directory-record-select'
import { Input } from '../../../shared/ui/input'

export function DirectoryValueField({
  organizationId,
  option,
  departments,
  value,
  onChange,
  disabled,
  onRequestAdd,
}: {
  organizationId: number
  option: DirectoryOptions
  departments: DirectoryOptions | undefined
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  /** When set, adding a value replaces the surrounding form instead of expanding inside it. */
  onRequestAdd?: () => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [parentId, setParentId] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [values, setValues] = useState<Record<string, string>>({})
  const [createRecord, createState] = useCreateDirectoryRecordMutation()
  const current = option.records.find((item) => item.id === value)
  const choices = option.records.filter((item) => !item.archived || item.id === value)
  const choiceItems = choices.map((item) => ({
    id: item.id,
    label: `${item.label || item.id}${item.archived ? ` (${t('directories.archived')})` : ''}${item.missing ? ` (${t('personnel.missing-value')})` : ''}`,
  }))
  const registry = option.source.type === 'registry' ? option.source.registry : null
  const departmentChoices = (departments?.records ?? []).filter((item) => !item.archived)
  const extensionFields = option.fields.filter((field) => field.key === 'custom' && !field.archived)

  const save = async () => {
    setError('')
    const extensionValues = Object.fromEntries(extensionFields.map((field) => [field.id, values[field.id] ?? '']))
    const body = registry === 'departments'
      ? { organizationId, name, code, parentId: parentId || null, values: extensionValues }
      : registry === 'workplaces'
        ? { organizationId, name, departmentId: departmentId || null, values: extensionValues }
        : { organizationId, values }
    try {
      const created = await createRecord({ directoryId: option.directoryId, body }).unwrap()
      onChange(created.id)
      setOpen(false)
      setName('')
      setCode('')
      setParentId('')
      setDepartmentId('')
      setValues({})
    } catch (caught) {
      setError(t(`directories.errors.${personnelError(caught).code}`, { defaultValue: t('directories.errors.generic') }))
    }
  }

  return (
    <div className="grid gap-2">
      <DirectoryRecordSelect
        triggerClassName="min-w-0 w-full"
        emptyLabel={choices.length === 0 ? t('personnel.empty-options') : t('personnel.choose')}
        value={value}
        disabled={disabled}
        items={choiceItems}
        aria-label={option.title}
        onChange={onChange}
      />
      {current?.missing ? <p className="text-xs text-muted-foreground">{t('personnel.missing-value')}</p> : null}
      {!onRequestAdd && choices.filter((item) => !item.archived).length === 0 ? <p className="text-xs text-muted-foreground">{t('personnel.empty-options')}</p> : null}
      {!onRequestAdd && option.canAdd && !disabled ? (
        <Button type="button" variant="outline" size="sm" onClick={() => { setError(''); setOpen(true) }}>
          {t('personnel.add-option', { title: option.title })}
        </Button>
      ) : null}
      {!onRequestAdd && open ? (
        <div className="grid gap-2 rounded-md border border-border p-3" role="dialog" aria-label={t('personnel.add-option', { title: option.title })}>
          <p className="text-sm text-muted-foreground">{t('personnel.add-option-note')}</p>
          {registry ? (
            <>
              <Input value={name} onChange={(event) => setName(event.target.value)} placeholder={t('directories.name')} aria-label={t('directories.name')} />
              {registry === 'departments' ? (
                <>
                  <Input value={code} onChange={(event) => setCode(event.target.value)} placeholder={t('directories.code')} aria-label={t('directories.code')} />
                  <DirectoryRecordSelect
                    emptyLabel={t('directories.no-parent')}
                    value={parentId}
                    items={departmentChoices.map((item) => ({ id: item.id, label: item.label }))}
                    aria-label={t('directories.parent')}
                    onChange={setParentId}
                  />
                </>
              ) : (
                <DirectoryRecordSelect
                  emptyLabel={t('directories.no-department')}
                  value={departmentId}
                  items={departmentChoices.map((item) => ({ id: item.id, label: item.label }))}
                  aria-label={t('directories.department')}
                  onChange={setDepartmentId}
                />
              )}
              {extensionFields.map((field) => (
                <Input
                  key={field.id}
                  value={values[field.id] ?? ''}
                  placeholder={field.label}
                  aria-label={field.label}
                  onChange={(event) => setValues({ ...values, [field.id]: event.target.value })}
                />
              ))}
            </>
          ) : option.fields.filter((field) => !field.archived).map((field) => (
            <Input
              key={field.id}
              value={values[field.id] ?? ''}
              placeholder={field.label}
              aria-label={field.label}
              onChange={(event) => setValues({ ...values, [field.id]: event.target.value })}
            />
          ))}
          {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
          <div className="flex gap-2">
            <Button type="button" size="sm" disabled={createState.isLoading} onClick={() => void save()}>{t('directories.save')}</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setOpen(false)}>{t('directories.cancel')}</Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

/** Replaces the employee form inside the same dialog. The form stays mounted behind it. */
export function DirectoryCreatePanel({
  organizationId,
  organizationName,
  option,
  departments,
  onCreated,
  onBack,
}: {
  organizationId: number
  organizationName: string
  option: DirectoryOptions
  departments: DirectoryOptions | undefined
  onCreated: (id: string) => void
  onBack: () => void
}) {
  const { t } = useTranslation()
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [parentId, setParentId] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [values, setValues] = useState<Record<string, string>>({})
  const [createRecord, createState] = useCreateDirectoryRecordMutation()
  const registry = option.source.type === 'registry' ? option.source.registry : null
  const departmentChoices = (departments?.records ?? []).filter((item) => !item.archived)
  const fields = option.fields.filter((field) => !field.archived)
  const extensionFields = option.fields.filter((field) => field.key === 'custom' && !field.archived)

  const save = async () => {
    setError('')
    const extensionValues = Object.fromEntries(extensionFields.map((field) => [field.id, values[field.id] ?? '']))
    const body = registry === 'departments'
      ? { organizationId, name, code, parentId: parentId || null, values: extensionValues }
      : registry === 'workplaces'
        ? { organizationId, name, departmentId: departmentId || null, values: extensionValues }
        : { organizationId, values }
    try {
      const created = await createRecord({ directoryId: option.directoryId, body }).unwrap()
      onCreated(created.id)
    } catch (caught) {
      setError(t(`directories.errors.${personnelError(caught).code}`, { defaultValue: t('directories.errors.generic') }))
    }
  }

  return (
    <form className="flex min-h-0 flex-1 flex-col" onSubmit={(event) => { event.preventDefault(); void save() }}>
      <div className="shrink-0 space-y-3 border-b border-border px-6 py-4 pr-12">
        <button type="button" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
          {t('personnel.back-to-employee')}
        </button>
        <div className="space-y-1">
          <DialogTitle>{t('personnel.new-option-heading', { title: option.title })}</DialogTitle>
          <p className="text-sm text-muted-foreground">{organizationName}</p>
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
        <p className="flex items-start gap-2 rounded-lg bg-primary/10 px-3 py-2 text-sm text-foreground">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          {t('personnel.form-kept')}
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {registry ? (
            <>
              <label className="grid gap-1 text-sm">
                {t('directories.name')} *
                <Input value={name} onChange={(event) => setName(event.target.value)} aria-label={t('directories.name')} />
              </label>
              {registry === 'departments' ? (
                <label className="grid gap-1 text-sm">
                  {t('directories.code')}
                  <Input value={code} onChange={(event) => setCode(event.target.value)} aria-label={t('directories.code')} />
                </label>
              ) : null}
              <div className="sm:col-span-2">
                <DirectoryRecordSelect
                  label={registry === 'departments' ? t('directories.parent') : t('directories.department')}
                  emptyLabel={registry === 'departments' ? t('directories.no-parent') : t('directories.no-department')}
                  value={registry === 'departments' ? parentId : departmentId}
                  items={departmentChoices.map((item) => ({ id: item.id, label: item.label }))}
                  onChange={(next) => (registry === 'departments' ? setParentId(next) : setDepartmentId(next))}
                />
              </div>
              {extensionFields.map((field) => (
                <label key={field.id} className="grid gap-1 text-sm">
                  {field.label}{field.required ? ' *' : ''}
                  <Input
                    value={values[field.id] ?? ''}
                    aria-label={field.label}
                    onChange={(event) => setValues({ ...values, [field.id]: event.target.value })}
                  />
                </label>
              ))}
            </>
          ) : fields.map((field) => (
            <label key={field.id} className="grid gap-1 text-sm">
              {field.label}{field.required ? ' *' : ''}
              <Input
                value={values[field.id] ?? ''}
                aria-label={field.label}
                onChange={(event) => setValues({ ...values, [field.id]: event.target.value })}
              />
            </label>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">{t('personnel.add-option-note')}</p>
        {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
      </div>
      <div className="flex shrink-0 justify-end gap-2 border-t border-border px-6 py-3">
        <Button type="button" variant="outline" onClick={onBack}>{t('directories.cancel')}</Button>
        <Button type="submit" disabled={createState.isLoading}>{t('personnel.create-and-select')}</Button>
      </div>
    </form>
  )
}
