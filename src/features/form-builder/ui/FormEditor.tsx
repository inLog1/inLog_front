import { useState, type MutableRefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import {
  createField,
  emptyAnswers,
  FormRenderer,
  moveField,
  readFormError,
  summarizeChanges,
  useGetFormDraftQuery,
  usePublishFormMutation,
  useSaveFormDraftMutation,
  validateAnswers,
  type FormFieldType,
  type FormSchema,
} from '../../../entities/form'
import { useMatchMedia } from '../../../shared/lib/use-match-media'
import { Button } from '../../../shared/ui/button'
import { Input } from '../../../shared/ui/input'
import { Label } from '../../../shared/ui/label'
import { Textarea } from '../../../shared/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../shared/ui/dialog'
import { bufferFromDraft, type EditorBuffer } from '../model/editor-state'
import { FieldSettings } from './FieldSettings'

type FormEditorProps = {
  organizationId: number
  formId: string
  canPublish: boolean
  recordsHref: string | null
  fillHref: string | null
  saveRef: MutableRefObject<(() => Promise<boolean>) | null>
  onDirty: (dirty: boolean) => void
}

export function FormEditor(props: FormEditorProps) {
  const query = useGetFormDraftQuery({ organizationId: props.organizationId, formId: props.formId })
  const [buffer, setBuffer] = useState<EditorBuffer | null>(null)
  if (query.data) {
    const loaded = bufferFromDraft(query.data)
    const serverCaughtUp = !buffer
      || buffer.formId !== loaded.formId
      || (!buffer.dirty && buffer.savedKey !== loaded.savedKey && loaded.formRevision >= buffer.formRevision && loaded.draftRevision >= buffer.draftRevision)
    if (serverCaughtUp) {
      setBuffer(loaded)
      return <p className="p-4 text-sm text-muted-foreground">…</p>
    }
  }
  if (query.isLoading && !buffer) return <p className="p-4 text-sm text-muted-foreground">…</p>
  if (!buffer) return <EditorProblem error={query.error} />
  return <EditorBody {...props} buffer={buffer} setBuffer={setBuffer} />
}

function EditorBody({
  organizationId,
  formId,
  canPublish,
  recordsHref,
  fillHref,
  saveRef,
  onDirty,
  buffer,
  setBuffer,
}: FormEditorProps & {
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
  const showSettings = wide || pane === 'field'
  const showList = wide || pane === 'fields'
  const showPreview = pane === 'preview'

  return (
    <div className="mx-auto flex min-w-0 max-w-6xl flex-col gap-4 p-4">
      <div className="flex min-w-0 flex-col gap-3">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="form-title">{t('forms.name')}</Label>
            <Input id="form-title" value={buffer.title} onChange={(event) => edit({ title: event.target.value })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="form-description">{t('forms.description')}</Label>
            <Textarea id="form-description" value={buffer.description} onChange={(event) => edit({ description: event.target.value })} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {buffer.dirty ? <span className="text-sm text-muted-foreground">{t('forms.unsaved')}</span> : null}
          <Button type="button" variant="outline" disabled={busy != null} onClick={() => void saveRef.current?.()}>
            {busy === 'save' ? t('forms.saving') : t('forms.save')}
          </Button>
          <Button type="button" variant="outline" onClick={() => {
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
          {fillHref && buffer.published ? <Link className="text-sm text-primary underline-offset-4 hover:underline" to={fillHref}>{t('forms.fill')}</Link> : null}
          {recordsHref ? <Link className="text-sm text-primary underline-offset-4 hover:underline" to={recordsHref}>{t('forms.records')}</Link> : null}
        </div>
        {!canPublish ? <p className="text-sm text-muted-foreground">{t('forms.no-publish')}</p> : null}
        {!wide ? (
          <div className="flex flex-wrap gap-2">
            {(['fields', 'field', 'preview'] as const).map((item) => (
              <Button key={item} type="button" variant={pane === item ? 'default' : 'outline'} onClick={() => setPane(item)}>
                {t(`forms.pane.${item}`)}
              </Button>
            ))}
          </div>
        ) : null}
      </div>

      <div className={wide ? 'grid min-w-0 grid-cols-[16rem_minmax(0,1fr)] gap-4' : 'min-w-0'}>
        {showList ? (
          <div className="min-w-0 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-medium">{t('forms.fields')}</h2>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const field = createField('text' satisfies FormFieldType)
                  updateSchema({ ...buffer.schema, fields: [...buffer.schema.fields, field] })
                  setSelectedId(field.id)
                  if (!wide) setPane('field')
                }}
              >
                {t('forms.add-field')}
              </Button>
            </div>
            <ul className="space-y-1">
              {buffer.schema.fields.map((field, index) => (
                <li key={field.id} className="flex min-w-0 items-center gap-1">
                  <button
                    type="button"
                    className={`min-w-0 flex-1 truncate rounded-md px-2 py-1 text-left text-sm ${field.id === selectedId ? 'bg-accent' : 'hover:bg-accent'}`}
                    onClick={() => { setSelectedId(field.id); if (!wide) setPane('field') }}
                  >
                    {field.label.trim() || t('forms.field')}
                  </button>
                  <Button type="button" variant="ghost" size="sm" disabled={index === 0} onClick={() => updateSchema({ ...buffer.schema, fields: moveField(buffer.schema.fields, field.id, -1) })}>
                    {t('forms.move-up')}
                  </Button>
                  <Button type="button" variant="ghost" size="sm" disabled={index === buffer.schema.fields.length - 1} onClick={() => updateSchema({ ...buffer.schema, fields: moveField(buffer.schema.fields, field.id, 1) })}>
                    {t('forms.move-down')}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {showSettings && !showPreview ? (
          <div className="min-w-0 rounded-lg border border-border bg-card p-4">
            {selected ? (
              <>
                <div className="mb-3 flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      updateSchema({ ...buffer.schema, fields: buffer.schema.fields.filter((field) => field.id !== selected.id) })
                      setSelectedId(null)
                    }}
                  >
                    {t('forms.remove-field')}
                  </Button>
                </div>
                <FieldSettings
                  field={selected}
                  onChange={(field) => updateSchema({
                    ...buffer.schema,
                    fields: buffer.schema.fields.map((item) => item.id === field.id ? field : item),
                  })}
                />
              </>
            ) : <p className="text-sm text-muted-foreground">{t('forms.select-field')}</p>}
          </div>
        ) : null}
        {pane === 'preview' ? (
          <div className="min-w-0 space-y-3 rounded-lg border border-border bg-card p-4">
            <p className="text-sm font-medium" role="status">{t('forms.preview-banner')}</p>
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

function EditorProblem({ error }: { error: unknown }) {
  const { t } = useTranslation()
  return <p className="p-4 text-sm text-muted-foreground">{textFor(t, error)}</p>
}

function textFor(translate: (key: string, options?: { defaultValue?: string }) => string, error: unknown): string {
  const parsed = readFormError(error)
  if (!parsed.code) return translate('forms.errors.generic')
  return translate(`forms.errors.${parsed.code}`, { defaultValue: translate('forms.errors.generic') })
}
