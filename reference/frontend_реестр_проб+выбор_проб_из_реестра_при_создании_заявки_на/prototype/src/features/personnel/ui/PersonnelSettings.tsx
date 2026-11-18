import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { COLUMN_FIO, COLUMN_STATE, PERSONNEL_GROUPS, personnelError, useUpdatePersonnelConfigMutation, type PersonnelConfigResponse } from '../../../entities/personnel'
import type { PersonnelField, PersonnelFieldType } from '../../../entities/personnel/model/types'
import { useUnsavedSource } from '../../../shared/session/unsaved-work'
import { Button } from '../../../shared/ui/button'
import { Input } from '../../../shared/ui/input'

const TYPES: PersonnelFieldType[] = ['text', 'textarea', 'number', 'date', 'checkbox', 'directory']

export function PersonnelSettings({
  organizationId,
  data,
  onClose,
}: {
  organizationId: number
  data: PersonnelConfigResponse
  onClose: () => void
}) {
  const { t } = useTranslation()
  const config = data.config
  const [tabs, setTabs] = useState(config?.tabs.map((tab) => ({ id: tab.id, label: tab.label, order: tab.order })) ?? [])
  const [fields, setFields] = useState(() => (config?.fields ?? []).map(wire))
  const [columns, setColumns] = useState(config?.columns ?? [])
  const [tabLabel, setTabLabel] = useState('')
  const [error, setError] = useState('')
  const [save, saveState] = useUpdatePersonnelConfigMutation()
  const dirty = config != null && JSON.stringify({ tabs, fields, columns }) !== JSON.stringify({
    tabs: config.tabs.map((tab) => ({ id: tab.id, label: tab.label, order: tab.order })),
    fields: config.fields.map(wire),
    columns: config.columns,
  })
  useUnsavedSource('personnel-settings', dirty)
  if (!config) return null

  const move = (index: number, step: number) => {
    const next = [...fields]
    const target = index + step
    if (target < 0 || target >= next.length) return
    const [item] = next.splice(index, 1)
    if (!item) return
    next.splice(target, 0, item)
    setFields(next.map((field, order) => ({ ...field, order })))
  }

  const persist = async () => {
    setError('')
    try {
      await save({ organizationId, expectedRevision: config.revision, tabs, fields, columns }).unwrap()
      onClose()
    } catch (caught) {
      setError(t(`personnel.errors.${personnelError(caught).code}`, { defaultValue: t('personnel.errors.generic') }))
    }
  }

  return (
    <div className="grid gap-4 rounded-lg border border-border p-4">
      <h2 className="text-base font-semibold">{t('personnel.settings')}</h2>
      <div className="flex flex-wrap gap-2">
        <Input value={tabLabel} onChange={(event) => setTabLabel(event.target.value)} placeholder={t('personnel.new-tab')} aria-label={t('personnel.new-tab')} />
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            const label = tabLabel.trim()
            if (!label) return
            setTabs([...tabs, { id: `new:${tabs.length}`, label, order: tabs.length }])
            setTabLabel('')
          }}
        >
          {t('personnel.add-tab')}
        </Button>
      </div>
      {fields.map((field, index) => {
        const identity = field.id.endsWith(':last-name') || field.id.endsWith(':first-name')
        const system = !field.id.startsWith('new:') && config.fields.some((item) => item.id === field.id && item.system)
        return (
          <div key={field.id} className="grid gap-2 rounded-md border border-border p-3 md:grid-cols-2">
            <Input
              value={field.label}
              aria-label={t('personnel.field-label')}
              onChange={(event) => setFields(fields.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item))}
            />
            <select
              className="h-9 rounded-md border border-border bg-background px-2 text-sm"
              value={field.tabId}
              aria-label={t('personnel.tab')}
              onChange={(event) => setFields(fields.map((item, itemIndex) => itemIndex === index ? { ...item, tabId: event.target.value } : item))}
            >
              {tabs.map((tab) => <option key={tab.id} value={tab.id}>{tab.label}</option>)}
            </select>
            <select
              className="h-9 rounded-md border border-border bg-background px-2 text-sm"
              value={field.group}
              aria-label={t('personnel.group')}
              onChange={(event) => setFields(fields.map((item, itemIndex) => itemIndex === index ? { ...item, group: event.target.value as PersonnelField['group'] } : item))}
            >
              {PERSONNEL_GROUPS.map((group) => <option key={group} value={group}>{t(`personnel.groups.${group}`)}</option>)}
            </select>
            <select
              className="h-9 rounded-md border border-border bg-background px-2 text-sm"
              value={field.type}
              disabled={system}
              aria-label={t('personnel.field-type')}
              onChange={(event) => setFields(fields.map((item, itemIndex) => itemIndex === index ? {
                ...item,
                type: event.target.value as PersonnelFieldType,
                directoryKey: event.target.value === 'directory' ? item.directoryKey : null,
              } : item))}
            >
              {TYPES.map((type) => <option key={type} value={type}>{t(`personnel.types.${type}`)}</option>)}
            </select>
            {field.type === 'directory' ? (
              <select
                className="h-9 rounded-md border border-border bg-background px-2 text-sm"
                value={field.directoryKey ?? ''}
                disabled={system}
                aria-label={t('personnel.directory')}
                onChange={(event) => setFields(fields.map((item, itemIndex) => itemIndex === index ? { ...item, directoryKey: event.target.value || null } : item))}
              >
                <option value="">{t('personnel.choose')}</option>
                {Object.entries(data.options ?? {}).map(([key, option]) => <option key={key} value={key}>{option.title}</option>)}
              </select>
            ) : null}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={field.required}
                disabled={identity}
                onChange={(event) => setFields(fields.map((item, itemIndex) => itemIndex === index ? { ...item, required: event.target.checked, visible: event.target.checked ? true : item.visible } : item))}
              />
              {t('personnel.required')}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={field.visible}
                disabled={identity}
                onChange={(event) => setFields(fields.map((item, itemIndex) => itemIndex === index ? { ...item, visible: event.target.checked, required: event.target.checked ? item.required : false } : item))}
              />
              {t('personnel.visible')}
            </label>
            {!system ? (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={field.archived}
                  onChange={(event) => setFields(fields.map((item, itemIndex) => itemIndex === index ? { ...item, archived: event.target.checked, visible: event.target.checked ? false : item.visible, required: event.target.checked ? false : item.required } : item))}
                />
                {t('directories.archive')}
              </label>
            ) : null}
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => move(index, -1)}>{t('personnel.move-up')}</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => move(index, 1)}>{t('personnel.move-down')}</Button>
            </div>
          </div>
        )
      })}
      <Button
        type="button"
        variant="outline"
        onClick={() => setFields([...fields, {
          id: `new:${fields.length}`,
          label: t('personnel.custom-field'),
          tabId: tabs[0]?.id ?? '',
          group: 'work',
          type: 'text',
          directoryKey: null,
          required: false,
          visible: true,
          archived: false,
          order: fields.length,
        }])}
      >
        {t('personnel.add-field')}
      </Button>
      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium">{t('personnel.columns')}</legend>
        {[COLUMN_FIO, COLUMN_STATE, ...fields.filter((field) => field.visible && !field.archived && !field.id.startsWith('new:')).map((field) => field.id)].map((columnId) => {
          const locked = columnId === COLUMN_FIO || columnId === COLUMN_STATE
          const label = columnId === COLUMN_FIO
            ? t('personnel.columns-fio')
            : columnId === COLUMN_STATE
              ? t('personnel.columns-state')
              : fields.find((field) => field.id === columnId)?.label ?? columnId
          return (
            <label key={columnId} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={columns.includes(columnId)}
                disabled={locked}
                onChange={(event) => setColumns(event.target.checked ? [...columns, columnId] : columns.filter((item) => item !== columnId))}
              />
              {label}
            </label>
          )
        })}
      </fieldset>
      {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
      <div className="flex gap-2">
        <Button type="button" disabled={saveState.isLoading} onClick={() => void persist()}>{t('directories.save')}</Button>
        <Button type="button" variant="outline" onClick={onClose}>{t('directories.cancel')}</Button>
      </div>
    </div>
  )
}

function wire(field: PersonnelField) {
  return {
    id: field.id,
    label: field.label,
    tabId: field.tabId,
    group: field.group,
    type: field.type,
    directoryKey: field.directoryKey,
    required: field.required,
    visible: field.visible,
    archived: field.archived,
    order: field.order,
  }
}
