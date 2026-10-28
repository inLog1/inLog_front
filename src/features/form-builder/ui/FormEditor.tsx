import { useLayoutEffect, useRef, useState, type MutableRefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'
import {
  createField,
  emptyAnswers,
  FormRenderer,
  hasInputFields,
  moveField,
  readFormError,
  summarizeChanges,
  useGetFormDraftQuery,
  usePublishFormMutation,
  useSaveFormDraftMutation,
  validateAnswers,
  type FormFieldType,
  type FormSchema,
  type FormStatus,
} from '../../../entities/form'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../shared/ui/dialog'
import { cn } from '../../../shared/lib/utils'
import { useMatchMedia } from '../../../shared/lib/use-match-media'
import { Button } from '../../../shared/ui/button'
import { Input } from '../../../shared/ui/input'
import { Label } from '../../../shared/ui/label'
import { PageState } from '../../../shared/ui/page'
import { Textarea } from '../../../shared/ui/textarea'

import { bufferFromDraft, type EditorBuffer } from '../model/editor-state'
import { FieldSettings } from './FieldSettings'

type FormEditorProps = {
  organizationId: number
  formId: string
  canPublish: boolean
  listHref: string
  recordsHref: string | null
  viewsHref: string | null
  fillHref: string | null
  saveRef: MutableRefObject<(() => Promise<boolean>) | null>
  onDirty: (dirty: boolean) => void
}

export function FormEditor(props: FormEditorProps) {
  const { t } = useTranslation()
  const query = useGetFormDraftQuery({ organizationId: props.organizationId, formId: props.formId })
  const [buffer, setBuffer] = useState<EditorBuffer | null>(null)
  if (query.data) {
    const loaded = bufferFromDraft(query.data)
    const serverCaughtUp = !buffer
      || buffer.formId !== loaded.formId
      || (!buffer.dirty && buffer.savedKey !== loaded.savedKey && loaded.formRevision >= buffer.formRevision && loaded.draftRevision >= buffer.draftRevision)
    if (serverCaughtUp) {
      setBuffer(loaded)
      return <PageState kind="loading" description={t('forms.loading')} />
    }
  }
  if (query.isLoading && !buffer) return <PageState kind="loading" description={t('forms.loading')} />
  if (!buffer) return <EditorProblem error={query.error} />
  return <EditorBody {...props} savedStatus={query.data?.form.status ?? 'draft'} buffer={buffer} setBuffer={setBuffer} />
}

function EditorBody({
  organizationId,
  formId,
  canPublish,
  listHref,
  recordsHref,
  viewsHref,
  fillHref,
  saveRef,
  onDirty,
  savedStatus,
  buffer,
  setBuffer,
}: FormEditorProps & {
  savedStatus: FormStatus
  buffer: EditorBuffer
  setBuffer: (next: EditorBuffer | ((current: EditorBuffer | null) => EditorBuffer | null)) => void
}) {
  const { t } = useTranslation()
  const wide = useMatchMedia('(min-width: 768px)')
  const [pane, setPane] = useState<'fields' | 'field' | 'preview'>('fields')
  const [selectedId, setSelectedId] = useState<string | null>(buffer.schema.fields[0]?.id ?? null)
  const [previewValues, setPreviewValues] = useState(() => emptyAnswers(buffer.schema))
  const [previewErrors, setPreviewErrors] = useState<Record<string, string>>({})
  const [publishOpen, setPublishOpen] = useState(false)
  const [busy, setBusy] = useState<'save' | 'publish' | null>(null)
  const [saveDraft] = useSaveFormDraftMutation()
  const [publishForm] = usePublishFormMutation()
  const selected = buffer.schema.fields.find((field) => field.id === selectedId) ?? null

  const replace = (next: EditorBuffer) => {
    setBuffer(next)
    onDirty(next.dirty)
  }
  const edit = (patch: Partial<Pick<EditorBuffer, 'title' | 'description' | 'schema'>>) => {
    replace({ ...buffer, ...patch, dirty: true })
  }
  const updateSchema = (schema: FormSchema) => edit({ schema })

  const saveCurrent = async (source: EditorBuffer): Promise<EditorBuffer | null> => {
    try {
      const saved = await saveDraft({
        organizationId,
        formId,
        title: source.title,
        description: source.description,
        schema: source.schema,
        expectedFormRevision: source.formRevision,
        expectedDraftRevision: source.draftRevision,
      }).unwrap()
      const next = bufferFromDraft(saved)
      replace(next)
      return next
    } catch (error) {
      toast.error(textFor(t, error))
      return null
    }
  }

  saveRef.current = async () => {
    if (busy) return false
    setBusy('save')
    const saved = await saveCurrent(buffer)
    setBusy(null)
    if (saved) toast.success(t('forms.saved'))
    return saved != null
  }

  const publish = async () => {
    if (busy) return
    setBusy('publish')
    let current = buffer
    if (buffer.dirty) {
      const saved = await saveCurrent(buffer)
      if (!saved) {
        setBusy(null)
        return
      }
      current = saved
    }
    if (!hasInputFields(current.schema)) {
      toast.error(t('forms.errors.empty_schema'))
      setBusy(null)
      return
    }
    try {
      const result = await publishForm({
        organizationId,
        formId,
        expectedFormRevision: current.formRevision,
        expectedDraftRevision: current.draftRevision,
      }).unwrap()
      const same = current.published?.versionNumber === result.versionNumber
      toast.success(same ? t('forms.publish-same', { number: result.versionNumber }) : t('forms.publish-done', { number: result.versionNumber }))
      setPublishOpen(false)
    } catch (error) {
      toast.error(textFor(t, error))
    } finally {
      setBusy(null)
    }
  }

  const summary = summarizeChanges(
    buffer.published ? {
      title: buffer.published.title,
      description: buffer.published.description,
      schema: buffer.published.schema,
      versionNumber: buffer.published.versionNumber,
    } : null,
    { title: buffer.title, description: buffer.description, schema: buffer.schema },
  )
  const hasFields = buffer.schema.fields.length > 0
  const showSettings = hasFields && (wide || pane === 'field')
  const showList = hasFields && (wide || pane === 'fields')
  const showPreview = pane === 'preview'
  const showEmpty = !hasFields && pane !== 'preview'
  const mobilePanes: Array<'fields' | 'field' | 'preview'> = ['fields', 'preview']
  if (hasFields) mobilePanes.push('field')
  const addField = () => {
    const field = createField('text' satisfies FormFieldType)
    updateSchema({ ...buffer.schema, fields: [...buffer.schema.fields, field] })
    setSelectedId(field.id)
    if (!wide) setPane('field')
  }
  const removeSelected = () => {
    if (!selected) return
    updateSchema({ ...buffer.schema, fields: buffer.schema.fields.filter((field) => field.id !== selected.id) })
    setSelectedId(null)
    if (!wide) setPane('fields')
  }

  return (
    <div className="flex min-w-0 w-full flex-col gap-4">
      <header className="flex min-w-0 flex-col gap-4">
        <Link to={listHref} className="inline-flex w-fit items-center gap-1 text-sm text-primary underline-offset-4 hover:underline">
          <ArrowLeft className="size-4" aria-hidden="true" />
          {t('forms.all-forms')}
        </Link>
        <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{buffer.title.trim() || t('forms.untitled')}</h1>
            <div className="flex flex-wrap gap-2">
              {buffer.published ? (
                <span className="rounded-full bg-[color-mix(in_srgb,var(--success)_16%,transparent)] px-2.5 py-0.5 text-xs font-medium text-[color-mix(in_srgb,var(--success)_78%,var(--foreground))]">
                  {t('forms.published-version', { number: buffer.published.versionNumber })}
                </span>
              ) : (
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">{t('forms.unpublished')}</span>
              )}
              {buffer.dirty ? (
                <span className="rounded-full bg-[color-mix(in_srgb,var(--warning)_22%,transparent)] px-2.5 py-0.5 text-xs font-medium text-[color-mix(in_srgb,var(--warning)_62%,var(--foreground))]">
                  {t('forms.unsaved')}
                </span>
              ) : savedStatus === 'published-dirty' ? (
                <span className="rounded-full bg-[color-mix(in_srgb,var(--warning)_22%,transparent)] px-2.5 py-0.5 text-xs font-medium text-[color-mix(in_srgb,var(--warning)_62%,var(--foreground))]">
                  {t('forms.list-status.published-dirty')}
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button type="button" variant="outline" disabled={busy != null} onClick={() => void saveRef.current?.()}>
              {busy === 'save' ? t('forms.saving') : t('forms.save')}
            </Button>
            <Button type="button" variant="outline" aria-pressed={pane === 'preview'} onClick={() => {
              if (pane === 'preview') setPane('fields')
              else {
                setPreviewValues(emptyAnswers(buffer.schema))
                setPreviewErrors({})
                setPane('preview')
              }
            }}>
              {t('forms.preview')}
            </Button>
            <Button type="button" disabled={!canPublish || busy != null} onClick={() => setPublishOpen(true)}>
              {t('forms.publish')}
            </Button>
          </div>
        </div>
        {!canPublish ? <p className="text-sm text-muted-foreground">{t('forms.no-publish')}</p> : null}
        <div className="flex min-w-0 flex-col gap-3">
          <div className="space-y-1">
            <Label htmlFor="form-title">{t('forms.name')}</Label>
            <Input id="form-title" value={buffer.title} onChange={(event) => edit({ title: event.target.value })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="form-description">{t('forms.description')}</Label>
            <GrowingTextarea id="form-description" value={buffer.description} onChange={(description) => edit({ description })} />
          </div>
        </div>
        {(fillHref && buffer.published) || recordsHref || viewsHref ? (
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {fillHref && buffer.published ? <Link className="text-sm text-primary underline-offset-4 hover:underline" to={fillHref}>{t('forms.open-fill')}</Link> : null}
            {recordsHref ? <Link className="text-sm text-primary underline-offset-4 hover:underline" to={recordsHref}>{t('forms.view-records')}</Link> : null}
            {viewsHref ? <Link className="text-sm text-primary underline-offset-4 hover:underline" to={viewsHref}>{t('forms.open-tables')}</Link> : null}
          </div>
        ) : null}
        {!wide ? (
          <div className="flex flex-wrap gap-2">
            {mobilePanes.map((item) => (
              <Button key={item} type="button" variant={pane === item ? 'default' : 'outline'} onClick={() => setPane(item)}>
                {t(`forms.pane.${item}`)}
              </Button>
            ))}
          </div>
        ) : null}
      </header>

      {showEmpty ? (
        <PageState
          kind="empty"
          description={t('forms.empty-fields')}
          action={<Button type="button" onClick={addField}>{t('forms.add-field')}</Button>}
        />
      ) : (
      <div className={cn('grid min-w-0 gap-4', wide && hasFields && !showPreview && 'md:grid-cols-[minmax(17.5rem,20rem)_minmax(0,1fr)]')}>
        {showList && !showPreview ? (
          <div className="min-w-0 space-y-3 rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-medium text-foreground">{t('forms.fields-title')}</h2>
              <Button type="button" variant="outline" onClick={addField}>
                {t('forms.add-field')}
              </Button>
            </div>
            <ul className="space-y-1">
              {buffer.schema.fields.map((field, index) => {
                const active = field.id === selectedId
                return (
                  <li key={field.id} className={cn('flex min-w-0 items-center gap-1 rounded-lg px-1 py-1', active && 'bg-[color-mix(in_srgb,var(--primary)_14%,transparent)]')}>
                    <button
                      type="button"
                      className="min-w-0 flex-1 rounded-md px-2 py-1 text-left"
                      aria-current={active ? 'true' : undefined}
                      onClick={() => { setSelectedId(field.id); if (!wide) setPane('field') }}
                    >
                      <span className="block truncate text-sm font-medium text-foreground">{field.label.trim() || t('forms.field')}</span>
                      <span className="block truncate text-xs text-muted-foreground">{t(`forms.types.${field.type}`)}</span>
                    </button>
                    <Button type="button" variant="ghost" size="icon" className="size-8 shrink-0" disabled={index === 0} aria-label={t('forms.move-up')} onClick={() => updateSchema({ ...buffer.schema, fields: moveField(buffer.schema.fields, field.id, -1) })}>
                      <ChevronUp className="size-4" aria-hidden="true" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className="size-8 shrink-0" disabled={index === buffer.schema.fields.length - 1} aria-label={t('forms.move-down')} onClick={() => updateSchema({ ...buffer.schema, fields: moveField(buffer.schema.fields, field.id, 1) })}>
                      <ChevronDown className="size-4" aria-hidden="true" />
                    </Button>
                  </li>
                )
              })}
            </ul>
          </div>
        ) : null}
        {showSettings && !showPreview ? (
          <div className="min-w-0 rounded-xl border border-border bg-card p-4">
            {selected ? (
              <div className="flex min-w-0 flex-col gap-4">
                <h2 className="text-sm font-medium text-foreground">{t('forms.field-settings')}</h2>
                <FieldSettings
                  field={selected}
                  onChange={(field) => updateSchema({
                    ...buffer.schema,
                    fields: buffer.schema.fields.map((item) => item.id === field.id ? field : item),
                  })}
                />
                <div className="border-t border-border pt-4">
                  <Button type="button" variant="outline" className="text-destructive hover:text-destructive" onClick={removeSelected}>
                    {t('forms.remove-field')}
                  </Button>
                </div>
              </div>
            ) : <p className="text-sm text-muted-foreground">{t('forms.select-field')}</p>}
          </div>
        ) : null}
        {showPreview ? (
          <div className="min-w-0 space-y-3 rounded-xl border border-border bg-card p-4 md:col-span-2">
            <p className="text-sm font-medium text-foreground" role="status">{t('forms.preview-banner')}</p>
            <FormRenderer schema={buffer.schema} values={previewValues} errors={previewErrors} onChange={(fieldId, value) => {
              setPreviewValues((current) => ({ ...current, [fieldId]: value }))
            }} />
            <Button type="button" variant="outline" onClick={() => {
              const reviewed = validateAnswers(buffer.schema, previewValues)
              setPreviewErrors(reviewed.ok ? {} : reviewed.fields)
            }}>
              {t('forms.preview-check')}
            </Button>
          </div>
        ) : null}
      </div>
      )}

      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('forms.publish-title')}</DialogTitle>
            <DialogDescription>
              {summary.firstPublication ? t('forms.publish-first', { count: summary.added.length }) : t('forms.publish-next', { number: summary.nextNumber })}
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-1 text-sm">
            <li>{t('forms.publish-added', { count: summary.added.length })}</li>
            <li>{t('forms.publish-removed', { count: summary.removed.length })}</li>
            <li>{t('forms.publish-renamed', { count: summary.renamed.length })}</li>
            <li>{t('forms.publish-retyped', { count: summary.retyped.length })}</li>
            {summary.titleChanged || summary.descriptionChanged ? <li>{t('forms.publish-meta')}</li> : null}
            {summary.renamed.slice(0, 5).map((item) => <li key={item}>{item}</li>)}
          </ul>
          {buffer.dirty ? <p className="text-sm text-muted-foreground">{t('forms.publish-save-first')}</p> : null}
          {!hasInputFields(buffer.schema) ? <p className="text-sm text-destructive" role="alert">{t('forms.errors.empty_schema')}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPublishOpen(false)}>{t('forms.leave-stay')}</Button>
            <Button type="button" disabled={busy != null} onClick={() => void publish()}>
              {busy === 'publish' ? t('forms.publishing') : t('forms.publish-confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function GrowingTextarea({ id, value, onChange }: { id: string; value: string; onChange: (value: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const node = ref.current
    if (!node) return
    node.style.height = 'auto'
    node.style.height = `${node.scrollHeight}px`
  }, [value])
  return (
    <Textarea
      ref={ref}
      id={id}
      rows={4}
      value={value}
      className="max-h-60 min-h-24 resize-none overflow-y-auto"
      onChange={(event) => onChange(event.target.value)}
    />
  )
}

function EditorProblem({ error }: { error: unknown }) {
  const { t } = useTranslation()
  return <PageState kind="error" description={textFor(t, error)} />
}

function textFor(translate: (key: string, options?: { defaultValue?: string }) => string, error: unknown): string {
  const parsed = readFormError(error)
  if (!parsed.code) return translate('forms.errors.generic')
  return translate(`forms.errors.${parsed.code}`, { defaultValue: translate('forms.errors.generic') })
}
