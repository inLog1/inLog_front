import { createElement, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Eye, Info } from 'lucide-react'
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
import { cn } from '../../../shared/lib/utils'
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
import { SectionAppearancePreview } from './SectionAppearancePreview'
import { SectionEditorCard } from './SectionEditorCard'
import { SECTION_ICON_LIST, sectionIcon } from './icons'

const selectClass = 'h-11 w-full min-w-0 rounded-md border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

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

function Field({
  id,
  label,
  hint,
  hintId,
  children,
}: {
  id: string
  label: string
  hint?: string
  hintId?: string
  children: ReactNode
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint ? <p id={hintId} className="text-sm text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

export function SectionEditor({
  organizationId,
  sectionId,
  canPublish,
  previewHref,
  saveRef,
  onDirty,
  onSaved,
  onStatus,
}: {
  organizationId: number
  sectionId: string | null
  canPublish: boolean
  previewHref: string | null
  saveRef: { current: (() => Promise<boolean>) | null }
  onDirty: (dirty: boolean) => void
  onSaved: (sectionId: string) => void
  onStatus: (status: SectionDraftResponse['status'] | null) => void
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
  const blocked = (sectionId != null && draftQuery.isLoading) || options.isLoading
  const failed = draftQuery.isError || options.isError
  useEffect(() => {
    if (blocked || failed) {
      onStatus(null)
      return
    }
    onStatus(status)
  }, [blocked, failed, onStatus, status])
  if (blocked) {
    return <p className="text-sm text-muted-foreground">{t('sections.loading')}</p>
  }
  if (failed) {
    const parsedError = readSectionError(draftQuery.error ?? options.error)
    return (
      <div className="min-w-0 space-y-2">
        <p className="break-words text-sm text-muted-foreground" role="alert">{t(`sections.errors.${parsedError.code ?? 'generic'}`, { defaultValue: t('sections.errors.generic') })}</p>
        <Button type="button" variant="outline" onClick={() => { void draftQuery.refetch(); void options.refetch() }}>{t('sections.retry')}</Button>
      </div>
    )
  }
  const forms = options.data?.forms ?? []
  const views = (options.data?.views ?? []).filter((view) => view.formId === draft.formId)
  const formSelected = forms.some((form) => form.id === draft.formId)
  const locallyDirty = JSON.stringify(draft) !== baseline
  const draftLeavesMenu = status === 'draft' || status === 'unpublished'
  const draftDoesNotChangePublished = status === 'published-dirty' || (status === 'published' && locallyDirty)
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex min-w-0 flex-wrap items-start gap-2.5">
        <Button type="button" variant="secondary" className="h-11 px-4" onClick={() => void persist().then((saved) => { if (saved) onSaved(saved.id) })}>{t('sections.save')}</Button>
        <div className="flex min-w-0 flex-col">
          {previewHref ? (
            <Button asChild variant="outline" className="h-11 px-4">
              <Link to={previewHref}><Eye aria-hidden />{t('sections.preview')}</Link>
            </Button>
          ) : (
            <Button type="button" variant="outline" className="h-11 px-4" disabled aria-describedby="section-preview-hint">
              <Eye aria-hidden />{t('sections.preview')}
            </Button>
          )}
          {previewHref ? null : <p id="section-preview-hint" className="mt-1 max-w-44 text-xs text-muted-foreground">{t('sections.preview-pending')}</p>}
        </div>
        <Button type="button" className="h-11 px-4" disabled={!canPublish} onClick={() => setPublishOpen(true)}>{t('sections.publish')}</Button>
        {status === 'published' || status === 'published-dirty' ? (
          <Button type="button" variant="ghost" className="h-11 px-3 text-muted-foreground" disabled={!canPublish} onClick={() => void withdraw()}>{t('sections.unpublish')}</Button>
        ) : null}
      </div>
      {!canPublish ? <p className="break-words text-sm text-muted-foreground">{t('sections.no-publish')}</p> : null}
      {dependency ? <p className="break-words text-sm text-muted-foreground" role="alert">{t(`sections.errors.${dependency}`)}</p> : null}
      {formWarning ? <p className="break-words text-sm text-muted-foreground" role="status">{t('sections.form-changed')}</p> : null}
      <div className="grid min-w-0 grid-cols-1 items-start gap-6 min-[1100px]:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex min-w-0 flex-col gap-5">
          <SectionEditorCard index="01" title={t('sections.about')} hint={t('sections.about-hint')}>
            <Field id="section-title" label={t('sections.name')}>
              <Input id="section-title" className="h-11" value={draft.title} onChange={(event) => change({ ...draft, title: event.target.value })} />
            </Field>
            <Field id="section-description" label={t('sections.description')}>
              <Textarea id="section-description" className="min-h-24" value={draft.description} onChange={(event) => change({ ...draft, description: event.target.value })} />
            </Field>
            <div className="grid min-w-0 gap-4 sm:grid-cols-2">
              <Field id="section-icon" label={t('sections.icon')}>
                <div className="relative min-w-0">
                  {createElement(sectionIcon(draft.iconKey), {
                    className: 'pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground',
                    'aria-hidden': true,
                  })}
                  <select id="section-icon" className={cn(selectClass, 'pl-9')} value={draft.iconKey} onChange={(event) => {
                    const iconKey = SECTION_ICON_LIST.find((item) => item === event.target.value) ?? draft.iconKey
                    change({ ...draft, iconKey })
                  }}>
                    {SECTION_ICON_LIST.map((icon) => <option key={icon} value={icon}>{t(`sections.icons.${icon}`)}</option>)}
                  </select>
                </div>
              </Field>
              <Field id="section-order" label={t('sections.order')}>
                <Input id="section-order" className="h-11" inputMode="numeric" value={String(draft.order)} onChange={(event) => {
                  const order = Number(event.target.value)
                  if (event.target.value.trim() !== '' && Number.isInteger(order)) change({ ...draft, order })
                }} />
              </Field>
            </div>
          </SectionEditorCard>
          <SectionEditorCard index="02" title={t('sections.data')} hint={t('sections.data-hint')}>
            <Field id="section-form" label={t('sections.form')}>
              <select id="section-form" className={selectClass} value={formSelected ? draft.formId : ''} onChange={(event) => {
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
              {forms.length === 0 ? <p className="text-sm text-muted-foreground" role="status">{t('sections.no-forms')}</p> : null}
            </Field>
            <Field id="section-view" label={t('sections.view-field')} hint={t('sections.view-hint')} hintId="section-view-hint">
              <select id="section-view" className={selectClass} aria-describedby="section-view-hint" value={views.some((view) => view.id === draft.tableViewId) ? draft.tableViewId : ''} onChange={(event) => change({ ...draft, tableViewId: event.target.value })}>
                <option value="">{t('sections.choose-view')}</option>
                {views.map((view) => <option key={view.id} value={view.id}>{view.title}</option>)}
              </select>
              {formSelected && views.length === 0 ? <p className="text-sm text-muted-foreground" role="status">{t('sections.no-views')}</p> : null}
            </Field>
          </SectionEditorCard>
          <SectionEditorCard index="03" title={t('sections.actions')} hint={t('sections.actions-hint')}>
            <div className="grid min-w-0 gap-4 sm:grid-cols-2">
              <div className="flex min-w-0 items-start gap-2 sm:pt-2">
                <Checkbox
                  id="section-show-create"
                  className="mt-0.5"
                  aria-describedby="section-create-hint"
                  checked={draft.showCreate}
                  onCheckedChange={(value) => change({ ...draft, showCreate: value === true })}
                />
                <Label htmlFor="section-show-create" className="font-normal leading-5">{t('sections.show-create')}</Label>
              </div>
              {draft.showCreate ? (
                <Field id="section-create-label" label={t('sections.create-label')} hint={t('sections.create-hint')} hintId="section-create-hint">
                  <Input
                    id="section-create-label"
                    className="h-11"
                    aria-describedby="section-create-hint"
                    placeholder={t('sections.add-record')}
                    value={draft.createLabel}
                    onChange={(event) => change({ ...draft, createLabel: event.target.value })}
                  />
                </Field>
              ) : (
                <p id="section-create-hint" className="text-sm text-muted-foreground sm:pt-2">{t('sections.create-hint')}</p>
              )}
            </div>
          </SectionEditorCard>
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <SectionAppearancePreview
            title={draft.title}
            description={draft.description}
            iconKey={draft.iconKey}
            showCreate={draft.showCreate}
            createLabel={draft.createLabel}
          />
          <section className="min-w-0 rounded-[14px] border border-border bg-card p-4 text-card-foreground">
            <div className="flex items-start gap-2">
              <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-foreground">{t('sections.after-publish')}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{t('sections.after-publish-body')}</p>
              </div>
            </div>
          </section>
          {draftLeavesMenu ? (
            <p className="flex items-start gap-2 rounded-xl border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
              <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              <span className="min-w-0 break-words">{t('sections.draft-menu')}</span>
            </p>
          ) : null}
          {draftDoesNotChangePublished ? (
            <p className="flex items-start gap-2 rounded-xl border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
              <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              <span className="min-w-0 break-words">{t('sections.draft-published')}</span>
            </p>
          ) : null}
        </div>
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
