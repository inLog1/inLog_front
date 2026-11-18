import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  acceptTableResponse,
  defaultViewConfig,
  parseViewDocument,
  readTableError,
  useCreateTableViewMutation,
  useGetColumnCatalogQuery,
  useGetTableViewQuery,
  usePreviewTableMutation,
  useUpdateTableViewMutation,
  type TableViewConfig,
  type TableViewDetail,
} from '../../../entities/table-view'
import { Button } from '../../../shared/ui/button'
import { saveViewOnce, type SingleSlot } from '../model/save-once'
import { RecordTable } from './RecordTable'
import { ViewSettings } from './ViewSettings'

function toConfig(detail: TableViewDetail): TableViewConfig {
  return {
    schemaVersion: detail.schemaVersion,
    title: detail.title,
    description: detail.description,
    columns: detail.columns,
    filters: detail.filters,
    sort: detail.sort,
    pageSize: detail.pageSize,
  }
}

export function ViewEditor({
  organizationId,
  formId,
  viewId,
  canPreview,
  recordHref,
  saveRef,
  onDirty,
  onSaved,
}: {
  organizationId: number
  formId: string
  viewId: string | null
  canPreview: boolean
  recordHref: (recordId: string) => string
  saveRef: { current: (() => Promise<boolean>) | null }
  onDirty: (dirty: boolean) => void
  onSaved: (viewId: string) => void
}) {
  const { t } = useTranslation()
  const catalog = useGetColumnCatalogQuery({ organizationId, formId })
  const existing = useGetTableViewQuery(
    { organizationId, formId, viewId: viewId ?? '' },
    { skip: viewId == null },
  )
  const [createView] = useCreateTableViewMutation()
  const [updateView] = useUpdateTableViewMutation()
  const [preview, previewState] = usePreviewTableMutation()
  const [draft, setDraft] = useState<TableViewConfig>(() => defaultViewConfig())
  const [baseline, setBaseline] = useState('')
  const [readyKey, setReadyKey] = useState('')
  const [storedRevision, setStoredRevision] = useState(0)
  const known = useRef<{ id: string | null }>({ id: viewId })
  const slot = useRef<SingleSlot<string | null>>({ pending: null })
  const loadedKey = viewId == null ? `new:${formId}` : existing.data ? `${existing.data.id}:${existing.data.revision}` : ''
  if (catalog.data && loadedKey && readyKey !== loadedKey) {
    const next = existing.data ? toConfig(existing.data) : defaultViewConfig()
    setReadyKey(loadedKey)
    setDraft(next)
    setBaseline(JSON.stringify(next))
    setStoredRevision(existing.data?.revision ?? 0)
  }
  const change = (next: TableViewConfig) => {
    setDraft(next)
    onDirty(JSON.stringify(next) !== baseline)
  }
  const persist = useCallback(async (): Promise<string | null> => {
    return saveViewOnce(slot.current, known.current, async (knownId) => {
      if (!catalog.data) return null
      const parsed = parseViewDocument(draft, catalog.data.columns)
      if (!parsed.ok) {
        const issue = parsed.issues[0]?.code
        toast.error(t(`tableViews.issues.${issue ?? parsed.code}`, { defaultValue: t('tableViews.errors.invalid_view') }))
        return null
      }
      try {
        if (knownId == null) {
          const created = await createView({ ...parsed.config, organizationId, formId }).unwrap()
          setStoredRevision(created.revision)
          setBaseline(JSON.stringify(parsed.config))
          onDirty(false)
          toast.success(t('tableViews.saved'))
          return created.id
        }
        const updated = await updateView({
          ...parsed.config,
          organizationId,
          formId,
          viewId: knownId,
          expectedRevision: storedRevision,
        }).unwrap()
        setStoredRevision(updated.revision)
        setBaseline(JSON.stringify(toConfig(updated)))
        setDraft(toConfig(updated))
        onDirty(false)
        toast.success(t('tableViews.saved'))
        return updated.id
      } catch (error) {
        const parsedError = readTableError(error)
        const issue = parsedError.issues[0]?.code
        toast.error(t(`tableViews.issues.${issue ?? parsedError.code ?? 'generic'}`, { defaultValue: t('tableViews.errors.generic') }))
        return null
      }
    })
  }, [catalog.data, createView, draft, formId, onDirty, organizationId, storedRevision, t, updateView])
  useEffect(() => {
    saveRef.current = async () => (await persist()) != null
    return () => {
      saveRef.current = null
    }
  }, [saveRef, persist])
  const runPreview = async () => {
    if (!catalog.data || !canPreview) return
    try {
      await preview({
        organizationId,
        formId,
        schemaVersion: draft.schemaVersion,
        columns: draft.columns,
        filters: draft.filters,
        sort: draft.sort,
        pageSize: draft.pageSize,
        offset: 0,
        limit: draft.pageSize,
      }).unwrap()
    } catch (error) {
      const parsedError = readTableError(error)
      toast.error(t(`tableViews.errors.${parsedError.code ?? 'generic'}`, { defaultValue: t('tableViews.errors.generic') }))
    }
  }
  if (catalog.isLoading || (viewId != null && existing.isLoading)) return <p className="text-sm text-muted-foreground">{t('tableViews.loading')}</p>
  if (catalog.isError || existing.isError) {
    const parsedError = readTableError(catalog.error ?? existing.error)
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">{t(`tableViews.errors.${parsedError.code ?? 'generic'}`, { defaultValue: t('tableViews.errors.generic') })}</p>
        <Button type="button" variant="outline" onClick={() => { void catalog.refetch(); void existing.refetch() }}>{t('tableViews.retry')}</Button>
      </div>
    )
  }
  if (existing.data && existing.data.schemaVersion !== 1) {
    return <p className="text-sm text-muted-foreground">{t('tableViews.errors.unknown_schema')}</p>
  }
  const previewBody = previewState.data
  const previewOk = previewBody != null && acceptTableResponse({
    organizationId,
    formId,
    viewId: null,
    offset: 0,
    limit: draft.pageSize,
    filters: draft.filters,
    sort: draft.sort,
    columns: draft.columns,
  }, previewBody)
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => void persist().then((id) => { if (id) onSaved(id) })}>{t('tableViews.save')}</Button>
        {canPreview ? <Button type="button" variant="outline" onClick={() => void runPreview()}>{t('tableViews.preview')}</Button> : <p className="text-sm text-muted-foreground">{t('tableViews.preview-need')}</p>}
      </div>
      <ViewSettings catalog={catalog.data?.columns ?? []} draft={draft} onChange={change} mode="editor" />
      <p className="text-sm text-muted-foreground">{t('tableViews.preview-note')}</p>
      {previewOk && previewBody ? <RecordTable columns={previewBody.columns} rows={previewBody.rows} recordHref={recordHref} /> : null}
    </div>
  )
}
