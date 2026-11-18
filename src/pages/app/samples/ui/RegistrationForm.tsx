import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  SAMPLE_TYPES,
  displaySampleStage,
  displayWell,
  inheritedSampleOrigin,
  sampleTypeOf,
  useCreateSampleMutation,
  useCreateSubsampleMutation,
  useGetSamplesQuery,
  type Sample,
} from '../../../../entities/sample'
import { Button } from '../../../../shared/ui/button'
import { CalendarDatePicker } from '../../../../shared/ui/calendar-date-picker'
import { Card } from '../../../../shared/ui/card'
import { Input } from '../../../../shared/ui/input'
import { Label } from '../../../../shared/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../shared/ui/select'
import { Textarea } from '../../../../shared/ui/textarea'
import { PageState } from '../../../../shared/ui/page'
import {
  SAMPLE_LOCATION_ROOMS,
  type SampleLocationChoice,
} from '../model/edit-plan'
import { SAMPLE_ROOM_MESSAGE_KEY, SAMPLE_STAGE_MESSAGE_KEY, sampleTypeMessageKey } from '../model/labels'
import {
  REGISTRATION_SECTIONS,
  REGISTRATION_STAGES,
  applyInitialParent,
  continueRegistrationDraft,
  emptyRegistrationDraft,
  prepareRegistration,
  registrationApiKey,
  registrationChanged,
  registrationFailure,
  registrationIssueKey,
  registrationParentKey,
  registrationWithStage,
  resolveRegistrationParent,
  type ParentProblem,
  type RegistrationDraft,
  type RegistrationIssue,
  type RegistrationStage,
} from '../model/registration'

/**
 * Documents stay a separate card so the next stage can fill this slot.
 * This stage does not accept files: nothing here is stored.
 */
export function RegistrationDocumentsPanel() {
  const { t } = useTranslation()
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-4">
      <p className="text-sm font-semibold">{t('samples.registration.documents.summary')}</p>
      <p className="mt-2 text-sm text-muted-foreground">{t('samples.registration.documents.later')}</p>
    </div>
  )
}

export function RegistrationForm({
  organizationId,
  initialParentId,
  suspended,
  onDirty,
  onBack,
  onCancel,
  onFinish,
}: {
  organizationId: number
  initialParentId: string
  suspended: boolean
  onDirty: (dirty: boolean) => void
  onBack: () => void
  onCancel: () => void
  onFinish: () => void
}) {
  const { t } = useTranslation()
  const query = useGetSamplesQuery({ organizationId })
  const [createSample] = useCreateSampleMutation()
  const [createSubsample] = useCreateSubsampleMutation()
  const formRef = useRef<HTMLFormElement>(null)
  const saving = useRef(false)
  const applied = useRef(initialParentId === '')
  const [draft, setDraft] = useState<RegistrationDraft>(emptyRegistrationDraft)
  const [baseline, setBaseline] = useState<RegistrationDraft | null>(() => initialParentId ? null : emptyRegistrationDraft())
  const [parentNotice, setParentNotice] = useState<ParentProblem | null>(null)
  const [issues, setIssues] = useState<RegistrationIssue[]>([])
  const [saveError, setSaveError] = useState<{ code: string; field: string | null } | null>(null)
  const [busy, setBusy] = useState(false)
  const [registeredCount, setRegisteredCount] = useState(0)
  const samples = query.currentData?.samples ?? []
  const parentListId = useId()

  useEffect(() => {
    if (applied.current) return
    if (!query.isSuccess && !query.isError) return
    applied.current = true
    const next = applyInitialParent(emptyRegistrationDraft(), query.currentData?.samples ?? [], organizationId, initialParentId)
    setDraft(next.draft)
    setBaseline(next.draft)
    setParentNotice(next.notice)
  }, [initialParentId, organizationId, query.currentData, query.isError, query.isSuccess])

  const dirty = baseline != null && registrationChanged(draft, baseline)
  useEffect(() => {
    onDirty(dirty)
  }, [dirty, onDirty])

  if (initialParentId && baseline == null) {
    return <PageState kind={query.isError ? 'error' : 'loading'} description={query.isError ? t('samples.load-error') : t('samples.loading')} />
  }

  const resolution = resolveRegistrationParent(samples, organizationId, draft.parentCode)
  const parent = resolution.status === 'ready' ? resolution.parent : null
  const origin = parent ? inheritedSampleOrigin(parent) : null
  const planned = draft.stage === 'Запланирован отбор'
  const locked = busy || suspended
  const currentYear = new Date().getFullYear()
  const parents = samples
    .filter((item) => displaySampleStage(item.stage) !== 'Утилизирована')
    .slice()
    .sort((left, right) => left.code.localeCompare(right.code, 'ru', { numeric: true }))

  function edit(patch: Partial<RegistrationDraft>) {
    setDraft((current) => ({ ...current, ...patch }))
    setIssues([])
    setSaveError(null)
    if ('parentCode' in patch) setParentNotice(null)
  }

  function fieldMessage(field: string): string | null {
    const issue = issues.find((item) => item.field === field)
    if (issue) return t(registrationIssueKey(issue))
    if (saveError?.field === field) return t(registrationApiKey(saveError.code), { code: saveError.code })
    return null
  }

  async function save(mode: 'finish' | 'continue') {
    if (saving.current || suspended) return
    if (draft.parentCode.trim() && !query.isSuccess) {
      setSaveError({ code: 'unavailable', field: 'parentCode' })
      focusRegistrationField(formRef.current, 'parentCode')
      return
    }
    const prepared = prepareRegistration(organizationId, draft, query.isSuccess ? samples : [])
    if (!prepared.ok) {
      setIssues(prepared.issues)
      setSaveError(null)
      const field = prepared.issues[0]?.field
      if (field) requestAnimationFrame(() => focusRegistrationField(formRef.current, field))
      return
    }
    saving.current = true
    setBusy(true)
    setIssues([])
    setSaveError(null)
    try {
      const saved = prepared.request.kind === 'sample'
        ? await createSample(prepared.request.body).unwrap()
        : await createSubsample(prepared.request.body).unwrap()
      if (!saved.sample?.id) {
        setSaveError({ code: 'unavailable', field: null })
        return
      }
      if (mode === 'continue') {
        const total = registeredCount + 1
        setRegisteredCount(total)
        setDraft((current) => continueRegistrationDraft(current))
        toast.success(t('samples.registration.saved-more', { total }))
        requestAnimationFrame(() => document.getElementById('sample-external-code')?.focus())
        return
      }
      toast.success(t('samples.registration.saved'))
      onFinish()
    } catch (error) {
      const failure = registrationFailure(error)
      setSaveError(failure)
      if (failure.field) requestAnimationFrame(() => focusRegistrationField(formRef.current, failure.field))
    } finally {
      saving.current = false
      setBusy(false)
    }
  }

  return (
    <form
      ref={formRef}
      noValidate
      aria-busy={busy}
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        void save('finish')
      }}
      className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_17.5rem]"
    >
      <div className="order-2 flex min-w-0 flex-col gap-4 lg:order-1">
        {parentNotice && !draft.parentCode.trim() ? (
          <div className="rounded-xl border border-border bg-card px-4 py-4 text-sm shadow-sm">
            <p role="alert" className="text-destructive">{t(registrationParentKey(parentNotice))}</p>
          </div>
        ) : null}
        {registeredCount > 0 ? (
          <div className="rounded-xl border border-border bg-card px-4 py-4 text-sm shadow-sm">
            <p role="status">{t('samples.registration.session', { total: registeredCount })}</p>
          </div>
        ) : null}
        {query.isError ? <p role="alert" className="text-sm text-destructive">{t('samples.load-error')}</p> : null}
        {saveError ? (
          <p role="alert" className="text-sm text-destructive">{t(registrationApiKey(saveError.code), { code: saveError.code })}</p>
        ) : null}
        <fieldset disabled={locked} className="m-0 flex min-w-0 flex-col gap-4 border-0 p-0">
          <RegistrationSection
            id="sample-identification"
            index={1}
            title={t('samples.registration.sections.identification')}
            description={t('samples.registration.identification.lead')}
          >
            <p className="mb-4 text-sm text-muted-foreground">{t('samples.registration.id-hint')}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <RegistrationField
                  id="sample-parent-code"
                  field="parentCode"
                  label={t('samples.registration.fields.parent')}
                  hint={t('samples.registration.parent-hint')}
                  error={fieldMessage('parentCode')}
                >
                  <Input
                    id="sample-parent-code"
                    className="bg-card"
                    list={parentListId}
                    value={draft.parentCode}
                    aria-invalid={fieldMessage('parentCode') ? true : undefined}
                    placeholder={t('samples.registration.placeholders.parent')}
                    onChange={(event) => edit({ parentCode: event.target.value })}
                  />
                  <datalist id={parentListId}>
                    {parents.map((item) => (
                      <option key={item.id} value={item.code}>{parentOption(t, item)}</option>
                    ))}
                  </datalist>
                </RegistrationField>
              </div>
              <RegistrationField
                id="sample-external-code"
                field="externalCode"
                label={t('samples.registration.fields.external')}
              >
                <Input
                  id="sample-external-code"
                  className="bg-card"
                  value={draft.externalCode}
                  placeholder={t('samples.registration.placeholders.external')}
                  onChange={(event) => edit({ externalCode: event.target.value })}
                />
              </RegistrationField>
              <RegistrationField
                id="sample-type"
                field="sampleType"
                label={t('samples.registration.fields.type')}
                required={!parent}
                hint={parent ? t('samples.registration.inherited') : undefined}
                error={fieldMessage('sampleType')}
              >
                {parent ? (
                  <Input id="sample-type" className="bg-muted" readOnly aria-readonly="true" value={typeLabel(t, sampleTypeOf(parent))} />
                ) : (
                  <Select
                    value={draft.sampleType || '__none__'}
                    disabled={locked}
                    onValueChange={(value) => edit({ sampleType: value === '__none__' ? '' : value })}
                  >
                    <SelectTrigger id="sample-type" className="w-full bg-card" aria-invalid={fieldMessage('sampleType') ? true : undefined}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">{t('samples.registration.fields.type-empty')}</SelectItem>
                      {SAMPLE_TYPES.map((value) => (
                        <SelectItem key={value} value={value}>{typeLabel(t, value)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </RegistrationField>
              <RegistrationField
                id="sample-material"
                field="material"
                label={t('samples.registration.fields.material')}
              >
                <Input
                  id="sample-material"
                  className="bg-card"
                  value={draft.material}
                  placeholder={t('samples.registration.placeholders.material')}
                  onChange={(event) => edit({ material: event.target.value })}
                />
              </RegistrationField>
            </div>
          </RegistrationSection>
          <RegistrationSection
            id="sample-origin"
            index={2}
            title={t('samples.registration.sections.origin')}
            description={t('samples.registration.origin.lead')}
          >
            {parent ? <p className="mb-4 text-sm text-muted-foreground">{t('samples.registration.inherited-origin')}</p> : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <RegistrationField id="sample-field" field="field" label={t('samples.registration.fields.field')} required={!parent} error={fieldMessage('field')}>
                <Input
                  id="sample-field"
                  className={parent ? 'bg-muted' : 'bg-card'}
                  readOnly={Boolean(parent)}
                  aria-readonly={parent ? true : undefined}
                  aria-invalid={fieldMessage('field') ? true : undefined}
                  value={origin ? origin.field : draft.field}
                  onChange={parent ? undefined : (event) => edit({ field: event.target.value })}
                />
              </RegistrationField>
              <RegistrationField id="sample-well" field="well" label={t('samples.registration.fields.well')} required={!parent} error={fieldMessage('well')}>
                <Input
                  id="sample-well"
                  className={parent ? 'bg-muted' : 'bg-card'}
                  readOnly={Boolean(parent)}
                  aria-readonly={parent ? true : undefined}
                  aria-invalid={fieldMessage('well') ? true : undefined}
                  value={origin ? displayWell(origin.well) : draft.well}
                  onChange={parent ? undefined : (event) => edit({ well: event.target.value })}
                  onBlur={parent ? undefined : (event) => {
                    const next = displayWell(event.target.value)
                    if (next !== draft.well) edit({ well: next })
                  }}
                />
              </RegistrationField>
              <RegistrationField id="sample-formation" field="formation" label={t('samples.registration.fields.formation')}>
                <Input
                  id="sample-formation"
                  className={parent ? 'bg-muted' : 'bg-card'}
                  readOnly={Boolean(parent)}
                  aria-readonly={parent ? true : undefined}
                  value={origin ? origin.formation : draft.formation}
                  onChange={parent ? undefined : (event) => edit({ formation: event.target.value })}
                />
              </RegistrationField>
              <RegistrationField
                id="sample-interval"
                field="interval"
                label={parent ? t('samples.registration.fields.parent-interval') : t('samples.registration.fields.interval')}
              >
                <Input
                  id="sample-interval"
                  className={parent ? 'bg-muted' : 'bg-card'}
                  readOnly={Boolean(parent)}
                  aria-readonly={parent ? true : undefined}
                  placeholder={t('samples.registration.placeholders.interval')}
                  value={origin ? origin.interval : draft.interval}
                  onChange={parent ? undefined : (event) => edit({ interval: event.target.value })}
                />
              </RegistrationField>
              {parent ? (
                <RegistrationField
                  id="sample-subsample-interval"
                  field="subsampleInterval"
                  label={t('samples.registration.fields.subsample-interval')}
                  hint={t('samples.registration.fields.subsample-hint')}
                  error={fieldMessage('subsampleInterval')}
                >
                  <Input
                    id="sample-subsample-interval"
                    className="bg-card"
                    aria-invalid={fieldMessage('subsampleInterval') ? true : undefined}
                    placeholder={t('samples.registration.placeholders.subsample')}
                    value={draft.subsampleInterval}
                    onChange={(event) => edit({ subsampleInterval: event.target.value })}
                  />
                </RegistrationField>
              ) : null}
              <RegistrationField id="sample-collected" field="collectedAt" label={t('samples.registration.fields.collected')} error={fieldMessage('collectedAt')}>
                <CalendarDatePicker
                  id="sample-collected"
                  value={(origin ? origin.collectedAt : draft.collectedAt) || null}
                  disabled={Boolean(parent)}
                  fromYear={currentYear - 30}
                  toYear={currentYear + 5}
                  aria-invalid={fieldMessage('collectedAt') ? true : undefined}
                  triggerClassName={parent ? 'bg-muted opacity-100' : 'bg-card'}
                  onChange={(value) => {
                    if (!parent) edit({ collectedAt: value ?? '' })
                  }}
                />
              </RegistrationField>
            </div>
          </RegistrationSection>
          <RegistrationSection
            id="sample-receipt"
            index={3}
            title={planned ? t('samples.registration.sections.planning') : t('samples.registration.sections.receipt')}
            description={planned ? t('samples.registration.planning.lead') : t('samples.registration.receipt.lead')}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <RegistrationField id="sample-stage" field="stage" label={t('samples.registration.fields.stage')} error={fieldMessage('stage')}>
                <Select
                  value={draft.stage}
                  disabled={locked}
                  onValueChange={(value) => {
                    if (value !== 'Поступила' && value !== 'Запланирован отбор') return
                    setDraft((current) => registrationWithStage(current, value))
                    setIssues([])
                    setSaveError(null)
                  }}
                >
                  <SelectTrigger id="sample-stage" className="w-full bg-card" aria-invalid={fieldMessage('stage') ? true : undefined}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REGISTRATION_STAGES.map((value) => (
                      <SelectItem key={value} value={value}>{stageLabel(t, value)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </RegistrationField>
              {planned ? (
                <p className="self-end text-sm text-muted-foreground">{t('samples.registration.planned-date')}</p>
              ) : (
                <RegistrationField
                  id="sample-received"
                  field="receivedAt"
                  label={t('samples.registration.fields.received')}
                  required
                  error={fieldMessage('receivedAt')}
                >
                  <CalendarDatePicker
                    id="sample-received"
                    value={draft.receivedAt || null}
                    fromYear={currentYear - 30}
                    toYear={currentYear}
                    aria-invalid={fieldMessage('receivedAt') ? true : undefined}
                    triggerClassName="bg-card"
                    onChange={(value) => edit({ receivedAt: value ?? '' })}
                  />
                </RegistrationField>
              )}
              <RegistrationField
                id="sample-location-room"
                field="location"
                label={t('samples.registration.fields.location')}
                required={!planned}
                error={fieldMessage('location')}
              >
                <LocationChoice
                  place={draft.place}
                  invalid={Boolean(fieldMessage('location'))}
                  disabled={locked}
                  onChange={(place) => edit({ place })}
                />
              </RegistrationField>
              <RegistrationField id="sample-supplier" field="supplier" label={t('samples.registration.fields.supplier')}>
                <Input
                  id="sample-supplier"
                  className="bg-card"
                  value={draft.supplier}
                  placeholder={t('samples.registration.placeholders.supplier')}
                  onChange={(event) => edit({ supplier: event.target.value })}
                />
              </RegistrationField>
              <RegistrationField id="sample-container" field="container" label={t('samples.registration.fields.container')}>
                <Input
                  id="sample-container"
                  className="bg-card"
                  value={draft.container}
                  placeholder={t('samples.registration.placeholders.container')}
                  onChange={(event) => edit({ container: event.target.value })}
                />
              </RegistrationField>
              <RegistrationField id="sample-quantity" field="quantity" label={t('samples.registration.fields.quantity')}>
                <Input
                  id="sample-quantity"
                  className="bg-card"
                  value={draft.quantity}
                  placeholder={t('samples.registration.placeholders.quantity')}
                  onChange={(event) => edit({ quantity: event.target.value })}
                />
              </RegistrationField>
              <div className="sm:col-span-2">
                <RegistrationField id="sample-conditions" field="conditions" label={t('samples.registration.fields.conditions')}>
                  <Textarea
                    id="sample-conditions"
                    rows={2}
                    value={draft.conditions}
                    placeholder={t('samples.registration.placeholders.conditions')}
                    onChange={(event) => edit({ conditions: event.target.value })}
                  />
                </RegistrationField>
              </div>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">{t('samples.registration.inspection-default')}</p>
          </RegistrationSection>
          <RegistrationSection
            id="sample-documents"
            index={4}
            title={t('samples.registration.sections.documents')}
            description={t('samples.registration.documents.lead')}
          >
            <RegistrationDocumentsPanel />
          </RegistrationSection>
        </fieldset>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-4 shadow-sm md:px-6">
          <div>
            <Button type="button" variant="ghost" disabled={busy} onClick={onBack}>{t('samples.registration.back-choice')}</Button>
            <p className="px-2 text-xs text-muted-foreground">{t('samples.registration.back-choice-hint')}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
              {registeredCount > 0 ? t('samples.registration.finish') : t('samples.registration.cancel')}
            </Button>
            <Button type="button" variant="outline" disabled={locked} onClick={() => void save('continue')}>
              {t('samples.registration.submit-another')}
            </Button>
            <Button type="submit" disabled={locked}>
              {busy ? t('samples.registration.saving') : t('samples.registration.submit')}
            </Button>
          </div>
        </div>
      </div>
      <RegistrationNav parentCode={parent?.code ?? ''} registeredCount={registeredCount} planned={planned} />
    </form>
  )
}

function LocationChoice({
  place,
  invalid,
  disabled,
  onChange,
}: {
  place: SampleLocationChoice
  invalid: boolean
  disabled: boolean
  onChange: (place: SampleLocationChoice) => void
}) {
  const { t } = useTranslation()
  const custom = place.choice.startsWith('custom:') ? place.choice : null
  return (
    <div className="space-y-2">
      <Select
        value={place.choice}
        disabled={disabled}
        onValueChange={(value) => onChange({ ...place, choice: value, other: value === '__other__' ? place.other : '' })}
      >
        <SelectTrigger id="sample-location-room" className="w-full bg-card" aria-invalid={invalid || undefined}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">{t('samples.form.room-empty')}</SelectItem>
          {SAMPLE_LOCATION_ROOMS.map((room) => (
            <SelectItem key={room.id} value={room.id}>{t(SAMPLE_ROOM_MESSAGE_KEY[room.id])}</SelectItem>
          ))}
          {custom ? <SelectItem value={custom}>{custom.slice('custom:'.length)}</SelectItem> : null}
          <SelectItem value="__other__">{t('samples.form.room-other')}</SelectItem>
        </SelectContent>
      </Select>
      {place.choice === '__other__' ? (
        <Input
          className="bg-card"
          aria-label={t('samples.form.room-name')}
          value={place.other}
          onChange={(event) => onChange({ ...place, other: event.target.value })}
        />
      ) : null}
      <Input
        className="bg-card"
        aria-label={t('samples.form.location-details')}
        placeholder={t('samples.form.location-details-hint')}
        value={place.details}
        onChange={(event) => onChange({ ...place, details: event.target.value })}
      />
    </div>
  )
}

function RegistrationNav({
  parentCode,
  registeredCount,
  planned,
}: {
  parentCode: string
  registeredCount: number
  planned: boolean
}) {
  const { t } = useTranslation()
  const [active, setActive] = useState<string>(REGISTRATION_SECTIONS[0].id)
  useEffect(() => {
    const nodes = REGISTRATION_SECTIONS
      .map((item) => document.getElementById(item.id))
      .filter((node): node is HTMLElement => node != null)
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0]
      if (visible?.target.id) setActive(visible.target.id)
    }, { rootMargin: '-15% 0px -55% 0px', threshold: [0.15, 0.4] })
    nodes.forEach((node) => observer.observe(node))
    return () => observer.disconnect()
  }, [planned])
  const labelFor = (id: string) => {
    if (planned && id === 'sample-receipt') return t('samples.registration.sections.planning')
    if (id === 'sample-identification') return t('samples.registration.sections.identification')
    if (id === 'sample-origin') return t('samples.registration.sections.origin')
    if (id === 'sample-receipt') return t('samples.registration.sections.receipt')
    return t('samples.registration.sections.documents')
  }
  return (
    <aside className="order-1 min-w-0 lg:sticky lg:top-4 lg:order-2">
      <Card className="shadow-sm">
        <div className="space-y-1 border-b border-border px-4 py-4">
          <h2 className="text-sm font-semibold text-foreground">{t('samples.registration.nav-title')}</h2>
          <p className="text-sm text-muted-foreground">
            {parentCode ? t('samples.registration.subsample-id', { code: parentCode }) : t('samples.registration.independent-id')}
          </p>
          <p className="text-sm text-muted-foreground">{t('samples.registration.required-hint')}</p>
          {registeredCount > 0 ? <p className="text-sm text-muted-foreground">{t('samples.registration.saved-count', { total: registeredCount })}</p> : null}
        </div>
        <nav aria-label={t('samples.registration.nav-label')} className="flex gap-2 overflow-x-auto p-3 lg:flex-col lg:overflow-visible">
          {REGISTRATION_SECTIONS.map((item, index) => (
            <button
              key={item.id}
              type="button"
              aria-current={active === item.id ? 'true' : undefined}
              onClick={() => {
                setActive(item.id)
                document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }}
              className={`shrink-0 rounded-lg border px-3 py-2 text-left text-sm lg:w-full ${active === item.id ? 'border-primary bg-card text-foreground' : 'border-border bg-card text-muted-foreground hover:text-foreground'}`}
            >
              <span className="mr-2 text-xs font-medium">{index + 1}</span>
              {labelFor(item.id)}
            </button>
          ))}
        </nav>
      </Card>
    </aside>
  )
}

function RegistrationSection({
  id,
  index,
  title,
  description,
  children,
}: {
  id: string
  index: number
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <Card id={id} className="scroll-mt-24 shadow-sm">
      <div className="flex gap-3 border-b border-border px-4 py-4 md:px-6">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium text-foreground">{index}</span>
        <div className="min-w-0 space-y-1">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="px-4 py-4 md:px-6 md:py-5">{children}</div>
    </Card>
  )
}

function RegistrationField({
  id,
  field,
  label,
  required = false,
  hint,
  error,
  children,
}: {
  id: string
  field: string
  label: string
  required?: boolean
  hint?: string
  error?: string | null
  children: ReactNode
}) {
  const { t } = useTranslation()
  return (
    <div className="relative min-w-0 space-y-2" data-field={field}>
      <Label htmlFor={id}>
        {label}
        {required ? <span className="ml-1 text-destructive" aria-hidden="true">*</span> : null}
        {required ? <span className="sr-only"> {t('samples.required')}</span> : null}
      </Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {error ? <p id={`${id}-error`} role="alert" className="text-sm text-destructive">{error}</p> : null}
    </div>
  )
}

function typeLabel(t: (key: string) => string, value: string): string {
  const key = sampleTypeMessageKey(value)
  return key ? t(key) : value
}

function stageLabel(t: (key: string) => string, value: RegistrationStage): string {
  const key = SAMPLE_STAGE_MESSAGE_KEY[value]
  return key ? t(key) : value
}

function parentOption(t: (key: string) => string, sample: Sample): string {
  return `${typeLabel(t, sampleTypeOf(sample))} · ${sample.field} · ${displayWell(sample.well)}`
}

function focusRegistrationField(form: HTMLFormElement | null, field: string | null) {
  if (!form || !field) return
  const target = form.querySelector<HTMLElement>(`[data-field="${CSS.escape(field)}"]`)
  target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  target?.querySelector<HTMLElement>('input, textarea, button, select')?.focus({ preventScroll: true })
}
