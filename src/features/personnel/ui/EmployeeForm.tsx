import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
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
  type EmployeeCard,
} from '../../../entities/personnel'
import type { PersonnelConfig, PersonnelField, PersonnelValue } from '../../../entities/personnel/model/types'
import { routes } from '../../../shared/lib/routes'
import { useUnsavedSource } from '../../../shared/session/unsaved-work'
import { cn } from '../../../shared/lib/utils'
import { Button } from '../../../shared/ui/button'
import { Checkbox } from '../../../shared/ui/checkbox'
import { Input } from '../../../shared/ui/input'
import { Textarea } from '../../../shared/ui/textarea'
import { DirectoryValueField } from './DirectoryValueField'

export type DirectoryCreateRequest = {
  option: DirectoryOptions
  departments: DirectoryOptions | undefined
  apply: (id: string) => void
}

export function EmployeeForm({
  organizationId,
  organizationName,
  employeeId,
  onClose,
  layout = 'page',
  hideOrganization = false,
  onCreateOption,
}: {
  organizationId: number
  organizationName: string
  employeeId: string | null
  onClose: (savedId?: string) => void
  /** `columns` shows one section per tab, at most two fields across. */
  layout?: 'page' | 'columns'
  hideOrganization?: boolean
  onCreateOption?: (request: DirectoryCreateRequest) => void
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
  if (employeeId && existing.isLoading) return <p className="text-sm text-muted-foreground">{t('personnel.loading')}</p>
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
  onClose: (savedId?: string) => void
}) {
  const { t } = useTranslation()
  const initial = useMemo(() => employee?.values ?? {}, [employee])
  const [values, setValues] = useState<Record<string, PersonnelValue>>(initial)
  const [error, setError] = useState('')
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
      if (field) setSection(field.group)
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
              <fieldset key={group} className={cn('grid gap-x-4 gap-y-3', layout === 'columns' && 'grid-cols-1 items-start sm:grid-cols-2')}>
                {layout === 'page' ? <legend className="text-sm font-medium">{t(`personnel.groups.${group}`)}</legend> : null}
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
                    onChange={(next) => setValues({ ...values, [field.id]: next })}
                    onCreateOption={layout === 'columns' ? onCreateOption : undefined}
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
      <div className={cn('flex flex-wrap gap-2', layout === 'columns' && 'sticky bottom-0 z-10 justify-end border-t border-border bg-background py-3')}>
        {canSave ? <Button type="submit" disabled={createState.isLoading || updateState.isLoading}>{layout === 'columns' && !employee ? t('personnel.save-employee') : t('directories.save')}</Button> : null}
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
  if (field.type === 'textarea' || field.type === 'checkbox' || field.type === 'directory') return 'sm:col-span-2'
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

function FieldInput({
  field,
  className,
  organizationId,
  options,
  value,
  disabled,
  onChange,
  onCreateOption,
}: {
  field: PersonnelField
  className?: string
  organizationId: number
  options: Record<string, DirectoryOptions>
  value: PersonnelValue
  disabled: boolean
  onChange: (value: PersonnelValue) => void
  onCreateOption?: (request: DirectoryCreateRequest) => void
}) {
  const label = `${field.label}${field.required ? ' *' : ''}`
  if (field.type === 'directory' && field.directoryKey) {
    const option = options[field.directoryKey]
    if (!option) return <p className="text-sm text-muted-foreground">{field.label}</p>
    return (
      <label className={cn('grid gap-1 text-sm', className)}>
        {label}
        <DirectoryValueField
          organizationId={organizationId}
          option={option}
          departments={options.departments}
          value={typeof value === 'string' ? value : ''}
          disabled={disabled}
          onChange={onChange}
          onRequestAdd={onCreateOption ? () => onCreateOption({
            option,
            departments: options.departments,
            apply: (id) => onChange(id),
          }) : undefined}
        />
      </label>
    )
  }
  if (field.type === 'textarea') {
    return (
      <label className={cn('grid gap-1 text-sm', className)}>
        {label}
        <Textarea value={typeof value === 'string' ? value : ''} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
      </label>
    )
  }
  if (field.type === 'checkbox') {
    return (
      <label className={cn('relative flex items-center gap-2 text-sm', className)}>
        <Checkbox checked={value === true} disabled={disabled} onCheckedChange={(checked) => onChange(checked === true)} />
        {label}
      </label>
    )
  }
  return (
    <label className={cn('grid gap-1 text-sm', className)}>
      {label}
      <Input
        type={field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text'}
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
          <Link className="underline" to={`${routes.settings.accessUser(employee.account.id)}?org=${organizationId}`}>{t('personnel.open-access')}</Link>
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
