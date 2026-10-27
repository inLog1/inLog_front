import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import {
  emptySectionConfig,
  parseSectionConfig,
  readSectionError,
  useGetSectionDraftQuery,
  useGetSectionOptionsQuery,
  useCreateSectionMutation,
  usePublishSectionMutation,
  useSaveSectionDraftMutation,
  useUnpublishSectionMutation,
  type SectionConfig,
  type SectionDraftResponse,
} from '../../../entities/section'
import { startSingleSave, type SingleSlot } from '../../../shared/lib/single-save'
import { Button } from '../../../shared/ui/button'
import { Checkbox } from '../../../shared/ui/checkbox'
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
import { Textarea } from '../../../shared/ui/textarea'
import { SECTION_ICON_LIST } from './icons'

const selectClass = 'h-9 min-w-0 rounded-md border border-border bg-background px-2 text-sm text-foreground'

function configOf(detail: SectionDraftResponse): SectionConfig {
  return {
    schemaVersion: 1,
    title: detail.title,
    description: detail.description,
    iconKey: detail.iconKey,
    formId: detail.formId,
    tableViewId: detail.tableViewId,
    showCreate: detail.showCreate,
    createLabel: detail.createLabel,
    order: detail.order,
  }
}

export function SectionEditor({
  organizationId,
  sectionId,
  canPublish,
  previewHref,
  saveRef,
  onDirty,
  onSaved,
}: {
  organizationId: number
  sectionId: string | null
  canPublish: boolean
  previewHref: string | null
  saveRef: { current: (() => Promise<boolean>) | null }
  onDirty: (dirty: boolean) => void
  onSaved: (sectionId: string) => void
}) {
  const { t } = useTranslation()
  const draftQuery = useGetSectionDraftQuery(
    { organizationId, sectionId: sectionId ?? '' },
    { skip: sectionId == null },
  )
  const options = useGetSectionOptionsQuery({ organizationId })
  const [createSection] = useCreateSectionMutation()
  const [saveDraft] = useSaveSectionDraftMutation()
  const [publishSection] = usePublishSectionMutation()
  const [unpublishSection] = useUnpublishSectionMutation()
  const [draft, setDraft] = useState<SectionConfig>(() => emptySectionConfig())
  const [baseline, setBaseline] = useState('')
  const [readyKey, setReadyKey] = useState('')
  const [revision, setRevision] = useState(0)
  const [draftRevision, setDraftRevision] = useState(0)
  const [status, setStatus] = useState<SectionDraftResponse['status']>('draft')
  const [dependency, setDependency] = useState<string | null>(null)
  const [formWarning, setFormWarning] = useState(false)
  const [publishOpen, setPublishOpen] = useState(false)
  const known = useRef<{ id: string | null }>({ id: sectionId })
  const slot = useRef<SingleSlot<{ id: string; revision: number; draftRevision: number } | null>>({ pending: null })
  const loadedKey = sectionId == null ? 'new' : draftQuery.data ? `${draftQuery.data.id}:${draftQuery.data.revision}:${draftQuery.data.draftRevision}` : ''
  if (loadedKey && readyKey !== loadedKey && (sectionId == null || draftQuery.data)) {
    const next = draftQuery.data ? configOf(draftQuery.data) : emptySectionConfig()
    setReadyKey(loadedKey)
    setDraft(next)
    setBaseline(JSON.stringify(next))
    setRevision(draftQuery.data?.revision ?? 0)
    setDraftRevision(draftQuery.data?.draftRevision ?? 0)
    setStatus(draftQuery.data?.status ?? 'draft')
    setDependency(draftQuery.data?.dependency ?? null)
  }
  const change = (next: SectionConfig) => {
    setDraft(next)
    onDirty(JSON.stringify(next) !== baseline)
  }
  const remember = useCallback((saved: SectionDraftResponse) => {
    const next = configOf(saved)
    known.current.id = saved.id
    setRevision(saved.revision)
    setDraftRevision(saved.draftRevision)
    setStatus(saved.status)
    setDependency(saved.dependency)
    setDraft(next)
    setBaseline(JSON.stringify(next))
    onDirty(false)
  }, [onDirty])
  const persist = useCallback(async (): Promise<{ id: string; revision: number; draftRevision: number } | null> => {
    return startSingleSave(slot.current, async () => {
      const parsed = parseSectionConfig(draft, 'draft')
      if (!parsed.ok) {
        toast.error(t(`sections.issues.${parsed.issues[0]?.code ?? 'invalid_section'}`, { defaultValue: t('sections.errors.invalid_section') }))
        return null
      }
      try {
        let saved: SectionDraftResponse
        if (known.current.id == null) {
          const created = await createSection({
            organizationId,
            title: parsed.config.title,
            description: parsed.config.description,
          }).unwrap()
          known.current.id = created.id
          saved = await saveDraft({
            ...parsed.config,
            organizationId,
            sectionId: created.id,
            expectedRevision: created.revision,
            expectedDraftRevision: created.draftRevision,
          }).unwrap()
        } else {
          saved = await saveDraft({
            ...parsed.config,
            organizationId,
            sectionId: known.current.id,
            expectedRevision: revision,
            expectedDraftRevision: draftRevision,
          }).unwrap()
        }
        remember(saved)
        toast.success(t('sections.saved'))
        return { id: saved.id, revision: saved.revision, draftRevision: saved.draftRevision }
      } catch (error) {
        const parsedError = readSectionError(error)
        toast.error(t(`sections.errors.${parsedError.code ?? 'generic'}`, { defaultValue: t('sections.errors.generic') }))
        return null
      }
    })
  }, [createSection, draft, draftRevision, organizationId, remember, revision, saveDraft, t])
  useEffect(() => {
    saveRef.current = async () => (await persist()) != null
    return () => {
      saveRef.current = null
    }
  }, [persist, saveRef])
  const publish = async () => {
    const checked = parseSectionConfig(draft, 'publish')
    if (!checked.ok) {
      setPublishOpen(false)
      toast.error(t(`sections.issues.${checked.issues[0]?.code ?? 'invalid_link'}`, { defaultValue: t('sections.errors.invalid_section') }))
      return
    }
    const dirty = JSON.stringify(draft) !== baseline || known.current.id == null
    const saved = dirty ? await persist() : { id: known.current.id ?? '', revision, draftRevision }
    if (!saved?.id) return
    try {
      await publishSection({
        organizationId,
        sectionId: saved.id,
        expectedRevision: saved.revision,
        expectedDraftRevision: saved.draftRevision,
      }).unwrap()
      toast.success(t('sections.published'))
      setPublishOpen(false)
    } catch (error) {
      const parsedError = readSectionError(error)
      toast.error(t(`sections.errors.${parsedError.code ?? 'generic'}`, { defaultValue: t('sections.errors.generic') }))
    }
  }
  const withdraw = async () => {
    const id = known.current.id
    if (!id) return
    try {
      const result = await unpublishSection({ organizationId, sectionId: id, expectedRevision: revision }).unwrap()
      setRevision(result.revision)
      setStatus('unpublished')
      toast.success(t('sections.unpublished'))
    } catch (error) {
      const parsedError = readSectionError(error)
      toast.error(t(`sections.errors.${parsedError.code ?? 'generic'}`, { defaultValue: t('sections.errors.generic') }))
    }
  }
  if ((sectionId != null && draftQuery.isLoading) || options.isLoading) {
    return <p className="text-sm text-muted-foreground">{t('sections.loading')}</p>
  }
  if (draftQuery.isError || options.isError) {
    const parsedError = readSectionError(draftQuery.error ?? options.error)
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">{t(`sections.errors.${parsedError.code ?? 'generic'}`, { defaultValue: t('sections.errors.generic') })}</p>
        <Button type="button" variant="outline" onClick={() => { void draftQuery.refetch(); void options.refetch() }}>{t('sections.retry')}</Button>
      </div>
    )
  }
  const forms = options.data?.forms ?? []
  const views = (options.data?.views ?? []).filter((view) => view.formId === draft.formId)
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={() => void persist().then((saved) => { if (saved) onSaved(saved.id) })}>{t('sections.save')}</Button>
        {previewHref ? <Button asChild variant="outline"><Link to={previewHref}>{t('sections.preview')}</Link></Button> : <p className="text-sm text-muted-foreground">{t('sections.preview-after-save')}</p>}
        <Button type="button" disabled={!canPublish} onClick={() => setPublishOpen(true)}>{t('sections.publish')}</Button>
        {status === 'published' || status === 'published-dirty' ? (
          <Button type="button" variant="outline" disabled={!canPublish} onClick={() => void withdraw()}>{t('sections.unpublish')}</Button>
        ) : null}
        <span className="text-sm text-muted-foreground">{t(`sections.status.${status}`)}</span>
      </div>
      {!canPublish ? <p className="text-sm text-muted-foreground">{t('sections.no-publish')}</p> : null}
      {dependency ? <p className="text-sm text-muted-foreground" role="alert">{t(`sections.errors.${dependency}`)}</p> : null}
      {formWarning ? <p className="text-sm text-muted-foreground" role="status">{t('sections.form-changed')}</p> : null}
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="section-title">{t('sections.name')}</Label>
          <Input id="section-title" value={draft.title} onChange={(event) => change({ ...draft, title: event.target.value })} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="section-order">{t('sections.order')}</Label>
          <Input id="section-order" inputMode="numeric" value={String(draft.order)} onChange={(event) => {
            const order = Number(event.target.value)
            if (event.target.value.trim() !== '' && Number.isInteger(order)) change({ ...draft, order })
          }} />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="section-description">{t('sections.description')}</Label>
        <Textarea id="section-description" value={draft.description} onChange={(event) => change({ ...draft, description: event.target.value })} />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1 text-sm">
          {t('sections.icon')}
          <select className={selectClass} value={draft.iconKey} onChange={(event) => {
            const iconKey = SECTION_ICON_LIST.find((item) => item === event.target.value) ?? draft.iconKey
            change({ ...draft, iconKey })
          }}>
            {SECTION_ICON_LIST.map((icon) => <option key={icon} value={icon}>{t(`sections.icons.${icon}`)}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          {t('sections.form')}
          <select className={selectClass} value={forms.some((form) => form.id === draft.formId) ? draft.formId : ''} onChange={(event) => {
            const formId = event.target.value
            const compatible = options.data?.views.some((view) => view.id === draft.tableViewId && view.formId === formId) ?? false
            if (draft.tableViewId && !compatible) {
              setFormWarning(true)
              change({ ...draft, formId, tableViewId: '' })
              return
            }
            setFormWarning(false)
            change({ ...draft, formId })
          }}>
            <option value="">{t('sections.choose-form')}</option>
            {forms.map((form) => <option key={form.id} value={form.id}>{form.title}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          {t('sections.view')}
          <select className={selectClass} value={views.some((view) => view.id === draft.tableViewId) ? draft.tableViewId : ''} onChange={(event) => change({ ...draft, tableViewId: event.target.value })}>
            <option value="">{t('sections.choose-view')}</option>
            {views.map((view) => <option key={view.id} value={view.id}>{view.title}</option>)}
          </select>
        </label>
      </div>
      <p className="text-sm text-muted-foreground">{t('sections.shared-view')}</p>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={draft.showCreate} onCheckedChange={(value) => change({ ...draft, showCreate: value === true })} />
        {t('sections.show-create')}
      </label>
      <div className="space-y-1">
        <Label htmlFor="section-create-label">{t('sections.create-label')}</Label>
        <Input id="section-create-label" value={draft.createLabel} onChange={(event) => change({ ...draft, createLabel: event.target.value })} />
      </div>
      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('sections.publish')}</DialogTitle>
            <DialogDescription>{t('sections.publish-note')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPublishOpen(false)}>{t('sections.cancel')}</Button>
            <Button type="button" onClick={() => void publish()}>{t('sections.publish')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
