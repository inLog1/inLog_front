import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Camera, Plus } from 'lucide-react'
import {
  PERSONNEL_GROUPS,
  personnelError,
  useArchiveEmployeeMutation,
  useCreateEmployeeMutation,
  useGetEmployeeQuery,
  useGetLinkableAccountsQuery,
  useGetPersonnelConfigQuery,
  useLinkEmployeeAccountMutation,
  useUpdateEmployeeMutation,
  type DirectoryOptions,
  type DirectoryRecord,
  type EmployeeCard,
} from '../../../entities/personnel'
import type { PersonnelConfig, PersonnelField, PersonnelValue } from '../../../entities/personnel/model/types'
import { routes } from '../../../shared/lib/routes'
import { useUnsavedSource } from '../../../shared/session/unsaved-work'
import { cn } from '../../../shared/lib/utils'
import { Button } from '../../../shared/ui/button'
import { Checkbox } from '../../../shared/ui/checkbox'
import { CalendarDatePicker } from '../../../shared/ui/calendar-date-picker'
import { Input } from '../../../shared/ui/input'
import { Textarea } from '../../../shared/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '../../../shared/ui/tooltip'
import { DirectoryValueField } from './DirectoryValueField'

export type DirectoryCreateRequest = {
  fieldId: string
  option: DirectoryOptions
  departments: DirectoryOptions | undefined
}

export type PendingDirectoryPick = {
  fieldId: string
  record: Pick<DirectoryRecord, 'id' | 'label'>
}

export function EmployeeForm({
  organizationId,
  organizationName,
  employeeId,
  onClose,
  layout = 'page',
  hideOrganization = false,
  onCreateOption,
  pendingDirectoryPick,
  onPendingDirectoryPickApplied,
}: {
  organizationId: number
  organizationName: string
  employeeId: string | null
  onClose: (savedId?: string) => void
  /** `columns` shows one section per tab, at most two fields across. */
  layout?: 'page' | 'columns'
  hideOrganization?: boolean
  onCreateOption?: (request: DirectoryCreateRequest) => void
  pendingDirectoryPick?: PendingDirectoryPick | null
  onPendingDirectoryPickApplied?: () => void
}) {
  const { t } = useTranslation()
  const existing = useGetEmployeeQuery(
    { organizationId, employeeId: employeeId ?? '' },
    { skip: employeeId == null },
  )
  const config = useGetPersonnelConfigQuery({ organizationId }, { skip: employeeId != null })
  const card = existing.data
  const sourceConfig = employeeId ? card?.config : config.data?.config
  const options = employeeId ? card?.options : config.data?.options
  const permissions = employeeId ? card?.employee.permissions : config.data?.permissions
  if (employeeId && existing.isLoading && !card) return <p className="text-sm text-muted-foreground">{t('personnel.loading')}</p>
  if (employeeId && existing.isError) {
    return <p className="text-sm text-destructive" role="alert">{t(`personnel.errors.${personnelError(existing.error).code}`, { defaultValue: t('personnel.errors.generic') })}</p>
  }
  if (!employeeId && config.isLoading) return <p className="text-sm text-muted-foreground">{t('personnel.loading')}</p>
  if (!sourceConfig || !options || !permissions) return <p className="text-sm text-muted-foreground">{t('personnel.missing')}</p>
  return (
    <EmployeeEditor
      key={card?.employee.revision ?? 'new'}
      organizationId={organizationId}
      organizationName={organizationName}
      config={sourceConfig}
      options={options}
      employee={card?.employee ?? null}
      canSave={employeeId ? permissions.update : permissions.create}
      canArchive={permissions.archive}
      canLink={permissions.account}
      layout={layout}
      hideOrganization={hideOrganization}
      onCreateOption={onCreateOption}
      pendingDirectoryPick={pendingDirectoryPick}
      onPendingDirectoryPickApplied={onPendingDirectoryPickApplied}
      onClose={onClose}
    />
  )
}

function EmployeeEditor({
  organizationId,
  organizationName,
  config,
  options,
  employee,
  canSave,
  canArchive,
  canLink,
  layout,
  hideOrganization,
  onCreateOption,
  pendingDirectoryPick,
  onPendingDirectoryPickApplied,
  onClose,
}: {
  organizationId: number
  organizationName: string
  config: PersonnelConfig
  options: Record<string, DirectoryOptions>
  employee: EmployeeCard | null
  canSave: boolean
  canArchive: boolean
  canLink: boolean
  layout: 'page' | 'columns'
  hideOrganization: boolean
  onCreateOption?: (request: DirectoryCreateRequest) => void
  pendingDirectoryPick?: PendingDirectoryPick | null
  onPendingDirectoryPickApplied?: () => void
  onClose: (savedId?: string) => void
}) {
  const { t } = useTranslation()
  const initial = useMemo(() => employee?.values ?? {}, [employee])
  const [values, setValues] = useState<Record<string, PersonnelValue>>(initial)
  const [recordHints, setRecordHints] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [formTab, setFormTab] = useState('employee')
  const [workplaceNote, setWorkplaceNote] = useState(false)
  const [createEmployee, createState] = useCreateEmployeeMutation()
  const [updateEmployee, updateState] = useUpdateEmployeeMutation()
  const [archiveEmployee, archiveState] = useArchiveEmployeeMutation()
  const dirty = JSON.stringify(values) !== JSON.stringify(initial)
  useUnsavedSource(employee ? `employee:${employee.id}` : 'employee:new', dirty)
  const tabs = [...config.tabs].sort((a, b) => a.order - b.order)
  const [tabId, setTabId] = useState(tabs[0]?.id ?? '')

  const save = async () => {
    setError('')
    const payload = visiblePayload(config, values)
    try {
      if (employee) {
        await updateEmployee({
          employeeId: employee.id,
          organizationId,
          expectedRevision: employee.revision,
          values: payload,
        }).unwrap()
        onClose(employee.id)
      } else {
        const created = await createEmployee({ organizationId, values: payload }).unwrap()
        onClose(created.employee.id)
      }
    } catch (caught) {
      const parsed = personnelError(caught)
      const field = config.fields.find((item) => item.id === parsed.fieldId)
      if (field) {
        setSection(field.group)
        setFormTab(formTabFor(config, field))
        requestAnimationFrame(() => {
          document.getElementById(`personnel-field-${field.id}`)?.scrollIntoView({ block: 'center' })
        })
      }
      setError(t(`personnel.errors.${parsed.code}`, { field: field?.label ?? '', defaultValue: t('personnel.errors.generic') }))
    }
  }

  const renderFields = (tab: string, group: (typeof PERSONNEL_GROUPS)[number]) => config.fields
    .filter((field) => field.tabId === tab && field.group === group && field.visible && !field.archived)
    .sort((a, b) => a.order - b.order)
  const sections = PERSONNEL_GROUPS.filter((group) => (
    tabs.some((tab) => renderFields(tab.id, group).length > 0) || (group === 'work' && !hideOrganization)
  ))
  const [section, setSection] = useState<(typeof PERSONNEL_GROUPS)[number]>(sections[0] ?? 'personal')
  const activeSection = sections.includes(section) ? section : (sections[0] ?? 'personal')
  const shownTabs = layout === 'columns' ? tabs : tabs.filter((tab) => tab.id === tabId)
  const shownGroups = layout === 'columns' ? PERSONNEL_GROUPS.filter((group) => group === activeSection) : PERSONNEL_GROUPS

  const changeValue = (field: PersonnelField, next: PersonnelValue) => {
    if (field.key !== 'department') {
      setValues((current) => ({ ...current, [field.id]: next }))
      return
    }
    const workplace = config.fields.find((item) => item.key === 'workplace')
    let mismatch = false
    setValues((current) => {
      const currentId = workplace ? current[workplace.id] : null
      const record = typeof currentId === 'string'
        ? options.workplaces?.records.find((item) => item.id === currentId)
        : undefined
      const nextDepartment = typeof next === 'string' ? next : ''
      mismatch = Boolean(workplace && nextDepartment && record?.departmentId && record.departmentId !== nextDepartment)
      if (mismatch && workplace) {
        return { ...current, [field.id]: next, [workplace.id]: null }
      }
      return { ...current, [field.id]: next }
    })
    setWorkplaceNote(mismatch)
  }

  useEffect(() => {
    if (!pendingDirectoryPick) return
    const field = config.fields.find((item) => item.id === pendingDirectoryPick.fieldId)
    if (!field) return
    const { id, label } = pendingDirectoryPick.record
    setRecordHints((current) => ({ ...current, [id]: label }))
    changeValue(field, id)
    onPendingDirectoryPickApplied?.()
    // Applied once per pendingDirectoryPick object from the dialog after create-and-select.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- changeValue is derived from latest render
  }, [pendingDirectoryPick])

  if (layout === 'columns') {
    return (
      <EmployeeSheet
        organizationId={organizationId}
        organizationName={organizationName}
        config={config}
        options={options}
        employee={employee}
        values={values}
        error={error}
        formTab={formTab}
        workplaceNote={workplaceNote}
        canSave={canSave}
        canArchive={canArchive}
        canLink={canLink}
        onCreateOption={onCreateOption}
        recordHints={recordHints}
        saving={createState.isLoading || updateState.isLoading}
        archiving={archiveState.isLoading}
        onTab={setFormTab}
        onChange={changeValue}
        onArchive={() => void archiveEmployee({
          employeeId: employee?.id ?? '',
          organizationId,
          expectedRevision: employee?.revision ?? 0,
          archived: !employee?.archived,
        }).unwrap().then(() => onClose(employee?.id)).catch((caught) => {
          const parsed = personnelError(caught)
          setError(t(`personnel.errors.${parsed.code}`, { defaultValue: t('personnel.errors.generic') }))
        })}
        onClose={onClose}
        onSubmit={() => void save()}
      />
    )
  }

  return (
    <form className="grid gap-5" onSubmit={(event) => { event.preventDefault(); void save() }}>
      {layout === 'page' ? (
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <Button key={tab.id} type="button" variant={tab.id === tabId ? 'default' : 'outline'} onClick={() => setTabId(tab.id)}>
              {tab.label}
            </Button>
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap gap-4 border-b border-border" role="tablist">
          {sections.map((group) => (
            <button
              key={group}
              type="button"
              role="tab"
              aria-selected={group === activeSection}
              className={cn(
                '-mb-px border-b-2 px-1 pb-2 text-sm',
                group === activeSection ? 'border-primary font-medium text-primary' : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
              onClick={() => setSection(group)}
            >
              {t(`personnel.groups.${group}`)}
            </button>
          ))}
        </div>
      )}
      {shownTabs.map((tab) => (
        <div key={tab.id} className="grid gap-5">
          {shownGroups.map((group) => {
            const fields = renderFields(tab.id, group)
            if (fields.length === 0 && !(group === 'work' && !hideOrganization)) return null
            return (
              <fieldset key={group} className="grid gap-x-4 gap-y-3">
                <legend className="text-sm font-medium">{t(`personnel.groups.${group}`)}</legend>
                {group === 'work' && !hideOrganization ? (
                  <label className="grid gap-1 text-sm">
                    {t('personnel.organization')}
                    <Input value={organizationName} readOnly />
                  </label>
                ) : null}
                {fields.map((field) => (
                  <FieldInput
                    key={field.id}
                    field={field}
                    className={fieldSpan(field, layout)}
                    organizationId={organizationId}
                    options={options}
                    value={values[field.id] ?? null}
                    disabled={!canSave || (employee?.source === 'integration' && field.sourceOwned)}
                    onChange={(next) => changeValue(field, next)}
                  />
                ))}
              </fieldset>
            )
          })}
        </div>
      ))}
      {employee ? (
        <AccountLink
          organizationId={organizationId}
          employee={employee}
          canLink={canLink}
        />
      ) : null}
      {employee?.source === 'integration' ? (
        <p className="text-sm text-muted-foreground">
          {t('personnel.integration-source', { source: employee.sourceId || employee.source, externalId: employee.externalId || '—' })}
        </p>
      ) : null}
      {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        {canSave ? <Button type="submit" disabled={createState.isLoading || updateState.isLoading}>{t('directories.save')}</Button> : null}
        {employee && canArchive ? (
          <Button
            type="button"
            variant="outline"
            disabled={archiveState.isLoading}
            onClick={() => void archiveEmployee({
              employeeId: employee.id,
              organizationId,
              expectedRevision: employee.revision,
              archived: !employee.archived,
            }).unwrap().then(() => onClose(employee.id)).catch((caught) => {
              setError(t(`personnel.errors.${personnelError(caught).code}`, { defaultValue: t('personnel.errors.generic') }))
            })}
          >
            {employee.archived ? t('directories.restore') : t('directories.archive')}
          </Button>
        ) : null}
        <Button type="button" variant="outline" onClick={() => onClose()}>{t('directories.cancel')}</Button>
      </div>
    </form>
  )
}

function fieldSpan(field: PersonnelField, layout: 'page' | 'columns') {
  if (layout !== 'columns') return undefined
  if (field.type === 'textarea' || field.type === 'checkbox') return 'sm:col-span-2'
  return undefined
}

function visiblePayload(config: PersonnelConfig, values: Record<string, PersonnelValue>) {
  const payload: Record<string, PersonnelValue> = {}
  for (const field of config.fields) {
    if (!field.visible || field.archived) continue
    payload[field.id] = values[field.id] ?? (field.type === 'checkbox' ? false : null)
  }
  return payload
}

const RELATED_TABS = ['permits', 'education', 'training', 'medical', 'methods', 'documents'] as const
const PERSONAL_KEYS = ['last-name', 'first-name', 'patronymic', 'birth-date', 'personnel-number', 'department', 'position', 'workplace', 'office', 'start-date', 'duties']
const CONTACT_KEYS = ['mobile-phone', 'email', 'work-phone']

function formTabFor(config: PersonnelConfig, field: PersonnelField): string {
  const system = config.tabs.find((tab) => tab.system)?.id ?? config.tabs[0]?.id
  if (system && field.tabId !== system) return field.tabId
  if (field.group === 'qualification' || field.group === 'tenure') return 'qualification'
  return 'employee'
}

function storedText(config: PersonnelConfig, values: Record<string, PersonnelValue>, key: string): string {
  const field = config.fields.find((item) => item.key === key)
  const value = field ? values[field.id] : null
  return typeof value === 'string' ? value.trim() : ''
}

function orderedFields(fields: PersonnelField[], keys: readonly string[]): PersonnelField[] {
  const known = keys.flatMap((key) => fields.filter((field) => field.key === key))
  const rest = fields.filter((field) => !keys.includes(field.key)).sort((left, right) => left.order - right.order)
  return [...known, ...rest]
}

function EmployeeSheet({
  organizationId,
  organizationName,
  config,
  options,
  employee,
  values,
  error,
  formTab,
  workplaceNote,
  canSave,
  canArchive,
  canLink,
  onCreateOption,
  recordHints,
  saving,
  archiving,
  onTab,
  onChange,
  onArchive,
  onClose,
  onSubmit,
}: {
  organizationId: number
  organizationName: string
  config: PersonnelConfig
  options: Record<string, DirectoryOptions>
  employee: EmployeeCard | null
  values: Record<string, PersonnelValue>
  error: string
  formTab: string
  workplaceNote: boolean
  canSave: boolean
  canArchive: boolean
  canLink: boolean
  onCreateOption?: (request: DirectoryCreateRequest) => void
  recordHints: Record<string, string>
  saving: boolean
  archiving: boolean
  onTab: (tab: string) => void
  onChange: (field: PersonnelField, value: PersonnelValue) => void
  onArchive: () => void
  onClose: (savedId?: string) => void
  onSubmit: () => void
}) {
  const { t } = useTranslation()
  const systemTabId = config.tabs.find((tab) => tab.system)?.id ?? config.tabs[0]?.id ?? ''
  const extraTabs = [...config.tabs].filter((tab) => tab.id !== systemTabId).sort((left, right) => left.order - right.order)
  const tabs = [
    { id: 'employee', label: t('personnel.form-tabs.employee') },
    { id: 'permits', label: t('personnel.form-tabs.permits') },
    { id: 'education', label: t('personnel.form-tabs.education') },
    { id: 'training', label: t('personnel.form-tabs.training') },
    { id: 'medical', label: t('personnel.form-tabs.medical') },
    { id: 'qualification', label: t('personnel.form-tabs.qualification') },
    { id: 'methods', label: t('personnel.form-tabs.methods') },
    { id: 'documents', label: t('personnel.form-tabs.documents') },
    ...extraTabs.map((tab) => ({ id: tab.id, label: tab.label })),
  ]
  const active = tabs.some((tab) => tab.id === formTab) ? formTab : 'employee'
  const name = [storedText(config, values, 'last-name'), storedText(config, values, 'first-name'), storedText(config, values, 'patronymic')].filter(Boolean).join(' ')
  const positionId = storedText(config, values, 'position')
  const departmentId = storedText(config, values, 'department')
  const position = options.positions?.records.find((item) => item.id === positionId)?.label ?? ''
  const department = options.departments?.records.find((item) => item.id === departmentId)?.label ?? ''
  const place = [organizationName, department].filter(Boolean).join(' / ')
  const visibleFields = (groups: readonly PersonnelField['group'][]) => config.fields
    .filter((field) => field.tabId === systemTabId && groups.includes(field.group) && field.visible && !field.archived)
    .sort((left, right) => left.order - right.order)

  const renderFields = (fields: PersonnelField[]) => (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {fields.map((field) => (
        <div key={field.id} className="contents">
          <FieldInput
            field={field}
            className={field.type === 'textarea' || field.type === 'checkbox' ? 'md:col-span-2 xl:col-span-3' : undefined}
            organizationId={organizationId}
            options={options}
            directory={workplaceChoices(config, options, values, field)}
            value={values[field.id] ?? null}
            disabled={!canSave || (employee?.source === 'integration' && field.sourceOwned)}
            onChange={(next) => onChange(field, next)}
            onCreateOption={onCreateOption}
            recordHints={recordHints}
          />
          {field.key === 'workplace' && workplaceNote ? (
            <p className="text-xs text-amber-700 md:col-span-2 xl:col-span-3">{t('personnel.workplace-cleared')}</p>
          ) : null}
        </div>
      ))}
    </div>
  )

  return (
    <form className="flex min-h-0 flex-1 flex-col" onSubmit={(event) => { event.preventDefault(); onSubmit() }}>
      <div className="shrink-0 border-b border-border px-6 py-4">
        <div className="flex gap-4 rounded-xl border border-border bg-muted/30 p-4">
          <div className="flex h-[88px] w-[88px] shrink-0 flex-col items-center justify-center gap-1 rounded-xl bg-emerald-50 text-emerald-800">
            <Camera className="h-5 w-5" aria-hidden />
            <span className="px-1 text-center text-[10px] leading-tight">{t('personnel.photo-short')}</span>
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold">{name || t('personnel.card-name-placeholder')}</p>
            <p className="truncate text-sm text-muted-foreground">{position || t('personnel.card-position-placeholder')}</p>
            <p className="truncate text-sm text-muted-foreground">{place || t('personnel.card-place-placeholder')}</p>
          </div>
        </div>
      </div>
      <div className="flex shrink-0 gap-5 overflow-x-auto border-b border-border px-6" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={tab.id === active}
            className={cn(
              'shrink-0 border-b-2 py-3 text-sm whitespace-nowrap',
              tab.id === active ? 'border-primary font-medium text-primary' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
            onClick={() => onTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
        {active === 'employee' ? (
          <>
            <FormSection title={t('personnel.groups.personal')}>
              {renderFields(orderedFields(visibleFields(['personal', 'work']), PERSONAL_KEYS))}
            </FormSection>
            <FormSection title={t('personnel.groups.contacts')}>
              {renderFields(orderedFields(visibleFields(['contacts']), CONTACT_KEYS))}
            </FormSection>
            {employee ? <AccountLink organizationId={organizationId} employee={employee} canLink={canLink} /> : null}
          </>
        ) : null}
        {active === 'qualification' ? (
          <FormSection title={t('personnel.form-tabs.qualification')}>
            {renderFields(visibleFields(['qualification', 'tenure']))}
          </FormSection>
        ) : null}
        {(RELATED_TABS as readonly string[]).includes(active) ? (
          <p className="text-sm text-muted-foreground">{t('personnel.related-missing')}</p>
        ) : null}
        {extraTabs.some((tab) => tab.id === active) ? (
          <FormSection title={extraTabs.find((tab) => tab.id === active)?.label ?? ''}>
            {renderFields(config.fields.filter((field) => field.tabId === active && field.visible && !field.archived).sort((left, right) => left.order - right.order))}
          </FormSection>
        ) : null}
        {employee?.source === 'integration' ? (
          <p className="text-sm text-muted-foreground">
            {t('personnel.integration-source', { source: employee.sourceId || employee.source, externalId: employee.externalId || '—' })}
          </p>
        ) : null}
        {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
      </div>
      <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border px-6 py-4">
        {employee && canArchive ? (
          <Button type="button" variant="outline" className="mr-auto" disabled={archiving} onClick={onArchive}>
            {employee.archived ? t('directories.restore') : t('directories.archive')}
          </Button>
        ) : null}
        <Button type="button" variant="outline" onClick={() => onClose()}>{t('directories.cancel')}</Button>
        {canSave ? <Button type="submit" disabled={saving}>{t('directories.save')}</Button> : null}
      </div>
    </form>
  )
}

function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border p-4">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      {children}
    </section>
  )
}

function workplaceChoices(
  config: PersonnelConfig,
  options: Record<string, DirectoryOptions>,
  values: Record<string, PersonnelValue>,
  field: PersonnelField,
): DirectoryOptions | undefined {
  if (!field.directoryKey) return undefined
  const option = options[field.directoryKey]
  if (!option || field.key !== 'workplace') return option
  const departmentField = config.fields.find((item) => item.key === 'department')
  const departmentId = departmentField && typeof values[departmentField.id] === 'string' ? values[departmentField.id] : ''
  if (!departmentId) return option
  const selected = typeof values[field.id] === 'string' ? values[field.id] : ''
  return {
    ...option,
    records: option.records.filter((item) => !item.departmentId || item.departmentId === departmentId || item.id === selected),
  }
}

function FieldInput({
  field,
  className,
  organizationId,
  options,
  directory,
  value,
  disabled,
  onChange,
  onCreateOption,
  recordHints,
}: {
  field: PersonnelField
  className?: string
  organizationId: number
  options: Record<string, DirectoryOptions>
  directory?: DirectoryOptions
  value: PersonnelValue
  disabled: boolean
  onChange: (value: PersonnelValue) => void
  onCreateOption?: (request: DirectoryCreateRequest) => void
  recordHints?: Record<string, string>
}) {
  const { t } = useTranslation()
  const label = `${field.label}${field.required ? ' *' : ''}`
  const anchorId = `personnel-field-${field.id}`
  if (field.type === 'directory' && field.directoryKey) {
    const option = directory ?? options[field.directoryKey]
    if (!option) return <p id={anchorId} className="text-sm text-muted-foreground">{field.label}</p>
    const addOptionLabel = t('personnel.add-option', { title: option.title })
    const showAdd = Boolean(onCreateOption && option.canAdd && !disabled)
    const requestAdd = showAdd && onCreateOption
      ? () => onCreateOption({
        fieldId: field.id,
        option,
        departments: options.departments,
      })
      : undefined
    const labelNode = showAdd ? (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex w-fit max-w-full items-center gap-0.5">
            <span>{label}</span>
            <button
              type="button"
              className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-sm text-primary hover:bg-primary/10"
              aria-label={addOptionLabel}
              onClick={(event) => {
                event.preventDefault()
                requestAdd?.()
              }}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        </TooltipTrigger>
        <TooltipContent>{addOptionLabel}</TooltipContent>
      </Tooltip>
    ) : (
      <span>{label}</span>
    )
    return (
      <div id={anchorId} className={cn('grid gap-1 text-sm', className)}>
        {labelNode}
        <DirectoryValueField
          organizationId={organizationId}
          option={option}
          departments={options.departments}
          value={typeof value === 'string' ? value : ''}
          disabled={disabled}
          recordHints={recordHints}
          onChange={onChange}
          onRequestAdd={requestAdd ? () => requestAdd() : undefined}
        />
      </div>
    )
  }
  if (field.type === 'textarea') {
    return (
      <label id={anchorId} className={cn('grid gap-1 text-sm', className)}>
        {label}
        <Textarea value={typeof value === 'string' ? value : ''} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
      </label>
    )
  }
  if (field.type === 'checkbox') {
    return (
      <label id={anchorId} className={cn('relative flex items-center gap-2 text-sm', className)}>
        <Checkbox checked={value === true} disabled={disabled} onCheckedChange={(checked) => onChange(checked === true)} />
        {label}
      </label>
    )
  }
  if (field.type === 'date') {
    const year = new Date().getFullYear()
    return (
      <label id={anchorId} className={cn('grid gap-1 text-sm', className)}>
        {label}
        <CalendarDatePicker
          id={field.id}
          value={typeof value === 'string' ? value : null}
          disabled={disabled}
          fromYear={year - 120}
          toYear={year}
          onChange={(next) => onChange(next)}
        />
      </label>
    )
  }
  return (
      <label id={anchorId} className={cn('grid gap-1 text-sm', className)}>
      {label}
      <Input
        type={field.key === 'email' ? 'email' : field.key === 'mobile-phone' || field.key === 'work-phone' ? 'tel' : field.type === 'number' ? 'number' : 'text'}
        value={value == null ? '' : String(value)}
        disabled={disabled}
        onChange={(event) => {
          if (field.type === 'number') onChange(event.target.value === '' ? null : Number(event.target.value))
          else onChange(event.target.value)
        }}
      />
    </label>
  )
}

function AccountLink({
  organizationId,
  employee,
  canLink,
}: {
  organizationId: number
  employee: EmployeeCard
  canLink: boolean
}) {
  const { t } = useTranslation()
  const accounts = useGetLinkableAccountsQuery({ organizationId }, { skip: !employee.accountVisible || !canLink })
  const [accountId, setAccountId] = useState(employee.account?.id ? String(employee.account.id) : '')
  const [error, setError] = useState('')
  const [link, linkState] = useLinkEmployeeAccountMutation()
  if (!employee.accountVisible) return <p className="text-sm text-muted-foreground">{t('personnel.account-hidden')}</p>
  return (
    <div className="grid gap-2 rounded-md border border-border p-3">
      <p className="text-sm font-medium">{t('personnel.account')}</p>
      {employee.account ? (
        <p className="text-sm">
          {employee.account.name} · {employee.account.email}
          {' '}
          <Link className="underline" to={routes.settings.accessUser(employee.account.id)} state={{ accessOrganizationId: organizationId }}>{t('personnel.open-access')}</Link>
        </p>
      ) : <p className="text-sm text-muted-foreground">{t('personnel.no-account')}</p>}
      {employee.roles ? (
        <p className="text-sm text-muted-foreground">
          {employee.roles.length === 0 ? t('personnel.no-roles') : employee.roles.map((role) => role.displayName).join(', ')}
        </p>
      ) : <p className="text-sm text-muted-foreground">{t('personnel.roles-hidden')}</p>}
      {canLink ? (
        <>
          <select className="h-9 rounded-md border border-border bg-background px-2 text-sm" value={accountId} onChange={(event) => setAccountId(event.target.value)} aria-label={t('personnel.account')}>
            <option value="">{t('personnel.unlink')}</option>
            {(accounts.data?.accounts ?? []).map((account) => (
              <option key={account.id} value={account.id}>{account.name} · {account.email}</option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">{t('personnel.account-note')}</p>
          {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
          <Button
            type="button"
            variant="outline"
            disabled={linkState.isLoading}
            onClick={() => void link({
              employeeId: employee.id,
              organizationId,
              expectedRevision: employee.revision,
              accountId: accountId ? Number(accountId) : null,
            }).unwrap().catch((caught) => setError(t(`personnel.errors.${personnelError(caught).code}`, { defaultValue: t('personnel.errors.generic') })))}
          >
            {t('personnel.link-account')}
          </Button>
        </>
      ) : null}
    </div>
  )
}
