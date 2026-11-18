import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  SAMPLE_INSPECTIONS,
  SAMPLE_STAGES,
  isSampleInspection,
  useUpdateSampleInspectionMutation,
  useUpdateSamplePlaceMutation,
  useUpdateSampleStatusMutation,
  type Sample,
  type SampleInspection,
} from '../../../../entities/sample'
import { Button } from '../../../../shared/ui/button'
import { Input } from '../../../../shared/ui/input'
import { Label } from '../../../../shared/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../shared/ui/select'
import { Textarea } from '../../../../shared/ui/textarea'
import { sampleFailureCode } from '../model/display'
import {
  SAMPLE_LOCATION_ROOMS,
  planSampleEdit,
  sampleEditDraft,
  sampleLocationChoice,
  sampleLocationText,
  type SampleEditIssue,
  type SampleLocationChoice,
} from '../model/edit-plan'
import { SAMPLE_INSPECTION_MESSAGE_KEY, SAMPLE_ROOM_MESSAGE_KEY, SAMPLE_STAGE_MESSAGE_KEY } from '../model/labels'

type Notice =
  | { kind: 'unchanged' }
  | { kind: 'field'; field: SampleEditIssue }
  | { kind: 'error'; code: string }

const FIELD_CODE: Record<SampleEditIssue, string> = {
  inspectionNote: 'note_required',
  location: 'location_required',
  receivedAt: 'received_at_required',
}

export function SampleEditForm({
  sample,
  organizationId,
  canUpdate,
}: {
  sample: Sample
  organizationId: number
  canUpdate: boolean
}) {
  const { t } = useTranslation()
  const formRef = useRef<HTMLFormElement>(null)
  const [draft, setDraft] = useState(() => sampleEditDraft(sample))
  const [place, setPlace] = useState(() => sampleLocationChoice(sample.location))
  const [notice, setNotice] = useState<Notice | null>(null)
  const [busy, setBusy] = useState(false)
  const [changeStatus] = useUpdateSampleStatusMutation()
  const [changeInspection] = useUpdateSampleInspectionMutation()
  const [changePlace] = useUpdateSamplePlaceMutation()
  const signature = [sample.id, sample.stage ?? '', sample.inspection, sample.inspectionNote, sample.location, sample.receivedAt].join('\u0000')
  const sampleRef = useRef(sample)
  sampleRef.current = sample

  useEffect(() => {
    const current = sampleRef.current
    setDraft(sampleEditDraft(current))
    setPlace(sampleLocationChoice(current.location))
  }, [signature])

  const planned = draft.stage === 'Запланирован отбор'
  const needsNote = draft.inspection === 'С ограничениями' || draft.inspection === 'Не соответствует'
  const fieldIssue = notice?.kind === 'field' ? notice.field : notice?.kind === 'error'
    ? (notice.code === 'note_required' ? 'inspectionNote' : notice.code === 'location_required' ? 'location' : notice.code === 'received_at_required' ? 'receivedAt' : null)
    : null
  const stageChoices = draft.stage && !(SAMPLE_STAGES as readonly string[]).includes(draft.stage)
    ? [draft.stage, ...SAMPLE_STAGES]
    : [...SAMPLE_STAGES]
  const customRoom = place.choice.startsWith('custom:') ? place.choice : null

  function edit(patch: Partial<typeof draft>) {
    setDraft((current) => ({ ...current, ...patch }))
    setNotice(null)
  }

  function editPlace(next: SampleLocationChoice) {
    setPlace(next)
    setDraft((current) => ({ ...current, location: sampleLocationText(next) }))
    setNotice(null)
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || !canUpdate) return
    const current = sampleRef.current
    const plan = planSampleEdit(current, {
      ...draft,
      location: sampleLocationText(place),
      receivedAt: draft.stage === 'Запланирован отбор' ? current.receivedAt : draft.receivedAt,
    })
    if (!plan.ok) {
      setNotice({ kind: 'field', field: plan.issue })
      requestAnimationFrame(() => focusSampleField(formRef.current, plan.issue))
      return
    }
    if (plan.calls.length === 0) {
      setNotice({ kind: 'unchanged' })
      return
    }
    setBusy(true)
    setNotice(null)
    try {
      for (const call of plan.calls) {
        if (call.kind === 'status') {
          await changeStatus({
            organizationId,
            sampleId: current.id,
            stage: call.stage,
            location: call.location,
            receivedAt: call.receivedAt,
          }).unwrap()
        } else if (call.kind === 'place') {
          await changePlace({
            organizationId,
            sampleId: current.id,
            location: call.location,
            receivedAt: call.receivedAt,
          }).unwrap()
        } else {
          await changeInspection({
            organizationId,
            sampleId: current.id,
            inspection: call.inspection,
            inspectionNote: call.inspectionNote,
          }).unwrap()
        }
      }
      toast.success(t('samples.saved'))
    } catch (error) {
      const code = sampleFailureCode(error) ?? 'generic'
      setNotice({ kind: 'error', code })
      const field = code === 'note_required' ? 'inspectionNote' : code === 'location_required' ? 'location' : code === 'received_at_required' ? 'receivedAt' : null
      if (field) requestAnimationFrame(() => focusSampleField(formRef.current, field))
    } finally {
      setBusy(false)
    }
  }

  const message = notice == null ? null : notice.kind === 'unchanged'
    ? t('samples.unchanged')
    : notice.kind === 'field'
      ? t(`samples.errors.${FIELD_CODE[notice.field]}`)
      : t(`samples.errors.${notice.code}`, { defaultValue: t('samples.errors.generic') })

  return (
    <form ref={formRef} noValidate onSubmit={(event) => void onSubmit(event)} className="space-y-4">
      <fieldset disabled={!canUpdate || busy} className="min-w-0 space-y-4">
        <div className="grid items-start gap-4 md:grid-cols-2">
          <div className="min-w-0 space-y-3 rounded-lg border border-border bg-muted/20 p-4">
            <h3 className="text-sm font-semibold">{t('samples.form.stage')}</h3>
            <Select
              value={draft.stage || '__unspecified__'}
              onValueChange={(value) => edit({ stage: value === '__unspecified__' ? '' : value })}
            >
              <SelectTrigger className="w-full bg-card" aria-label={t('samples.form.stage')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {!draft.stage ? <SelectItem value="__unspecified__">{t('samples.stage.unspecified')}</SelectItem> : null}
                {stageChoices.map((value) => (
                  <SelectItem key={value} value={value}>{stageLabel(t, value)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0 space-y-3 rounded-lg border border-border bg-muted/20 p-4">
            <div>
              <h3 className="text-sm font-semibold">{t('samples.form.inspection')}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{t('samples.form.inspection-lead')}</p>
            </div>
            <Select
              value={draft.inspection}
              onValueChange={(value) => {
                if (isSampleInspection(value)) edit({ inspection: value })
              }}
            >
              <SelectTrigger className="w-full bg-card" aria-label={t('samples.form.inspection')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SAMPLE_INSPECTIONS.map((value) => (
                  <SelectItem key={value} value={value}>{inspectionLabel(t, value)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div data-field="inspectionNote">
              <SampleField id="sample-inspection-note" label={t('samples.form.note')} required={needsNote}>
                <Textarea
                  id="sample-inspection-note"
                  value={draft.inspectionNote}
                  rows={2}
                  required={needsNote}
                  aria-invalid={fieldIssue === 'inspectionNote' || undefined}
                  placeholder={needsNote ? t('samples.form.note-hint') : undefined}
                  onChange={(event) => edit({ inspectionNote: event.target.value })}
                />
              </SampleField>
              {fieldIssue === 'inspectionNote' ? <p className="text-sm text-destructive">{t('samples.errors.note_required')}</p> : null}
            </div>
          </div>
        </div>
        <div className="grid items-start gap-4 rounded-lg border border-border bg-muted/20 p-4 md:grid-cols-2">
          <div data-field="location">
            <SampleField id="sample-location-room" label={t('samples.form.location')} required={!planned}>
              <Select value={place.choice} onValueChange={(value) => editPlace({ ...place, choice: value, other: value === '__other__' ? place.other : '' })}>
                <SelectTrigger id="sample-location-room" className="w-full bg-card" aria-invalid={fieldIssue === 'location' || undefined}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t('samples.form.room-empty')}</SelectItem>
                  {SAMPLE_LOCATION_ROOMS.map((room) => (
                    <SelectItem key={room.id} value={room.id}>{t(SAMPLE_ROOM_MESSAGE_KEY[room.id])}</SelectItem>
                  ))}
                  {customRoom ? <SelectItem value={customRoom}>{customRoom.slice('custom:'.length)}</SelectItem> : null}
                  <SelectItem value="__other__">{t('samples.form.room-other')}</SelectItem>
                </SelectContent>
              </Select>
            </SampleField>
            {place.choice === '__other__' ? (
              <Input
                className="mt-2 bg-card"
                aria-label={t('samples.form.room-name')}
                value={place.other}
                onChange={(event) => editPlace({ ...place, other: event.target.value })}
              />
            ) : null}
            {fieldIssue === 'location' ? <p className="mt-2 text-sm text-destructive">{t('samples.errors.location_required')}</p> : null}
          </div>
          <div className="space-y-3">
            <SampleField id="sample-location-details" label={t('samples.form.location-details')}>
              <Input
                id="sample-location-details"
                className="bg-card"
                value={place.details}
                placeholder={t('samples.form.location-details-hint')}
                onChange={(event) => editPlace({ ...place, details: event.target.value })}
              />
            </SampleField>
            {!planned ? (
              <div data-field="receivedAt">
                <SampleField id="sample-received-at" label={t('samples.form.received')} required>
                  <Input
                    id="sample-received-at"
                    className="bg-card"
                    type="date"
                    required
                    value={draft.receivedAt}
                    aria-invalid={fieldIssue === 'receivedAt' || undefined}
                    onChange={(event) => edit({ receivedAt: event.target.value })}
                  />
                </SampleField>
                {fieldIssue === 'receivedAt' ? <p className="mt-2 text-sm text-destructive">{t('samples.errors.received_at_required')}</p> : null}
              </div>
            ) : null}
          </div>
        </div>
      </fieldset>
      {canUpdate ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={busy}>{busy ? t('samples.saving') : t('samples.save')}</Button>
          <p className="text-xs text-muted-foreground">{t('samples.save-hint')}</p>
        </div>
      ) : <p className="text-xs text-muted-foreground">{t('samples.readonly')}</p>}
      {message ? (
        <p role={notice?.kind === 'unchanged' ? 'status' : 'alert'} className={notice?.kind === 'unchanged' ? 'text-sm text-muted-foreground' : 'text-sm text-destructive'}>
          {message}
        </p>
      ) : null}
    </form>
  )
}

function SampleField({ id, label, required = false, children }: { id: string; label: string; required?: boolean; children: ReactNode }) {
  const { t } = useTranslation()
  return (
    <div className="min-w-0 space-y-1.5">
      <Label htmlFor={id}>
        {label}
        {required ? <span className="ml-1 text-destructive" aria-hidden="true">*</span> : null}
        {required ? <span className="sr-only"> {t('samples.required')}</span> : null}
      </Label>
      {children}
    </div>
  )
}

function stageLabel(t: (key: string, options?: { label?: string; defaultValue?: string }) => string, value: string): string {
  const key = SAMPLE_STAGE_MESSAGE_KEY[value]
  const label = key ? t(key) : value
  return (SAMPLE_STAGES as readonly string[]).includes(value) || value === 'Не указан' ? label : t('samples.stage.legacy', { label })
}

function inspectionLabel(t: (key: string) => string, value: SampleInspection): string {
  const key = SAMPLE_INSPECTION_MESSAGE_KEY[value]
  return key ? t(key) : value
}

function focusSampleField(form: HTMLFormElement | null, field: string) {
  const target = form?.querySelector<HTMLElement>(`[data-field="${CSS.escape(field)}"]`)
  target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  target?.querySelector<HTMLElement>('input, textarea, button, select')?.focus({ preventScroll: true })
}
