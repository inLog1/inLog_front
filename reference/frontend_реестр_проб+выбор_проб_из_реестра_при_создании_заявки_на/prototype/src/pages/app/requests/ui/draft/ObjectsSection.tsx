import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2 } from 'lucide-react'
import {
  REQUEST_TITLE_MAX,
  describeIntervalRemoval,
  describeWellRemoval,
  withoutRequestInterval,
  withoutRequestWell,
  type DraftIssue,
  type RequestCatalog,
  type RequestDepthUnit,
  type RequestDraftDetails,
  type RequestWell,
} from '../../../../../entities/request'
import { Button } from '../../../../../shared/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../../../shared/ui/dialog'
import { Input } from '../../../../../shared/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../../shared/ui/select'
import {
  appendStudyWell,
  intervalDraftIssue,
  studyEntityId,
  upsertWellInterval,
} from '../../model/draft-form'
import { fieldCaption, optionLabel, wellCaption } from './draft-labels'
import { DraftField, DraftSection } from './draft-ui'

const MANUAL = 'manual'

type IntervalRow = {
  id: string
  wellId: string
  from: string
  to: string
  unit: RequestDepthUnit
}

type PendingRemoval =
  | { kind: 'well'; id: string; needIds: string[] }
  | { kind: 'interval'; id: string; needIds: string[] }

export function ObjectsSection({
  details,
  catalog,
  commit,
  onIssues,
  saveAttempted,
}: {
  details: RequestDraftDetails
  catalog: RequestCatalog
  commit: (recipe: (current: RequestDraftDetails) => RequestDraftDetails) => void
  onIssues: (issues: DraftIssue[]) => void
  saveAttempted: boolean
}) {
  const { t } = useTranslation()
  const dash = t('requests.dash')
  const [rows, setRows] = useState<Record<string, IntervalRow>>({})
  const [adding, setAdding] = useState(false)
  const [fieldChoice, setFieldChoice] = useState(MANUAL)
  const [wellChoice, setWellChoice] = useState(MANUAL)
  const [fieldName, setFieldName] = useState('')
  const [wellName, setWellName] = useState('')
  const [addError, setAddError] = useState<'duplicate' | 'unnamed' | null>(null)
  const [pending, setPending] = useState<PendingRemoval | null>(null)

  const issues = useMemo(() => collectIntervalIssues(details, rows), [details, rows])
  const signature = JSON.stringify(issues)
  useEffect(() => {
    onIssues(JSON.parse(signature) as DraftIssue[])
  }, [onIssues, signature])

  const resetAdd = () => {
    setAdding(false)
    setFieldChoice(catalog.fields[0]?.id ?? MANUAL)
    setWellChoice(catalog.wells[0]?.id ?? MANUAL)
    setFieldName('')
    setWellName('')
    setAddError(null)
  }

  const openAdd = () => {
    setFieldChoice(catalog.fields[0]?.id ?? MANUAL)
    setWellChoice(catalog.wells[0]?.id ?? MANUAL)
    setFieldName('')
    setWellName('')
    setAddError(null)
    setAdding(true)
  }

  const confirmAdd = () => {
    const manualField = fieldChoice === MANUAL
    const manualWell = wellChoice === MANUAL
    const input = {
      fieldId: studyEntityId('field'),
      catalogFieldId: manualField ? '' : fieldChoice,
      fieldName: manualField ? fieldName : optionLabel(t, catalog.fields, fieldChoice),
      wellId: studyEntityId('well'),
      catalogWellId: manualWell ? '' : wellChoice,
      wellName: manualWell ? wellName : optionLabel(t, catalog.wells, wellChoice),
    }
    let reason: 'duplicate' | 'unnamed' | null = null
    commit((current) => {
      const placed = appendStudyWell(current, input)
      if (!placed.ok) {
        reason = placed.reason
        return current
      }
      return placed.details
    })
    if (reason) {
      setAddError(reason)
      return
    }
    resetAdd()
  }

  const changeRow = (wellId: string, current: IntervalRow, patch: Partial<IntervalRow>) => {
    const next = { ...current, ...patch, wellId, unit: 'm' as const }
    if (patch.from != null) next.from = depthText(patch.from)
    if (patch.to != null) next.to = depthText(patch.to)
    setRows((prev) => ({ ...prev, [next.id]: next }))
    const issue = intervalDraftIssue(next.from, next.to, next.unit)
    if (issue) return
    commit((current) => upsertWellInterval(current, wellId, {
      id: next.id,
      from: Number(next.from.trim().replace(',', '.')),
      to: Number(next.to.trim().replace(',', '.')),
      unit: next.unit,
    }) ?? current)
  }

  const dropIntervalDraft = (intervalId: string) => {
    setRows((prev) => {
      const next = { ...prev }
      delete next[intervalId]
      return next
    })
  }

  const removeWell = (wellId: string) => {
    commit((current) => {
      const next = withoutRequestWell(current, wellId)
      return { ...next, fields: next.fields.filter((field) => field.wells.length > 0) }
    })
    setRows((prev) => {
      const copy = { ...prev }
      for (const [id, row] of Object.entries(copy)) {
        if (row.wellId === wellId) delete copy[id]
      }
      return copy
    })
    setPending(null)
  }

  const removeInterval = (intervalId: string) => {
    dropIntervalDraft(intervalId)
    commit((current) => {
      const stored = current.fields.some((field) => field.wells.some((well) => well.intervals.some((interval) => interval.id === intervalId)))
      return stored ? withoutRequestInterval(current, intervalId) : current
    })
    setPending(null)
  }

  const askRemoveWell = (wellId: string) => {
    const effect = describeWellRemoval(details.needs, wellId)
    if (effect.needIds.length === 0) removeWell(wellId)
    else setPending({ kind: 'well', id: wellId, needIds: effect.needIds })
  }

  const askRemoveInterval = (well: RequestWell, intervalId: string) => {
    const stored = well.intervals.some((interval) => interval.id === intervalId)
    if (!stored) {
      dropIntervalDraft(intervalId)
      return
    }
    const effect = describeIntervalRemoval(details.needs, intervalId)
    if (effect.needIds.length === 0) removeInterval(intervalId)
    else setPending({ kind: 'interval', id: intervalId, needIds: effect.needIds })
  }

  return (
    <DraftSection
      id="request-objects"
      index={2}
      title={t('requests.draft.sections.objects')}
      description={t('requests.draft.objects-lead')}
      action={(
        <Button type="button" onClick={openAdd}>
          <Plus aria-hidden />
          {t('requests.draft.add-well')}
        </Button>
      )}
    >
      {details.fields.every((field) => field.wells.length === 0) ? (
        <p className="text-sm text-muted-foreground">{t('requests.draft.objects-empty')}</p>
      ) : (
        <div className="space-y-6">
          {details.fields.filter((field) => field.wells.length > 0).map((field) => (
            <section key={field.id} className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">{fieldCaption(t, field, catalog.fields, dash)}</h3>
              <div className="space-y-3">
                {field.wells.map((well) => {
                  const visible = visibleRows(well, rows)
                  return (
                    <article key={well.id} className="rounded-lg border border-border bg-card px-4 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs text-muted-foreground">{fieldCaption(t, field, catalog.fields, dash)}</p>
                          <p className="mt-1 text-sm font-medium text-foreground">
                            {t('requests.draft.well-label', { name: wellCaption(t, well, catalog.wells, dash) })}
                          </p>
                        </div>
                        <Button type="button" variant="ghost" size="icon" aria-label={t('requests.draft.remove-well')} onClick={() => askRemoveWell(well.id)}>
                          <Trash2 aria-hidden />
                        </Button>
                      </div>
                      <div className="mt-4 max-w-3xl space-y-3">
                        <p className="text-xs font-medium text-muted-foreground">{t('requests.draft.intervals')}</p>
                        {visible.length === 0 ? <p className="text-sm text-muted-foreground">{t('requests.draft.intervals-empty')}</p> : null}
                        {visible.map((row) => {
                          const issue = intervalDraftIssue(row.from, row.to, row.unit)
                          const started = row.from.trim() !== '' || row.to.trim() !== ''
                          return (
                            <div key={row.id} data-field={`intervals.${row.id}`} className="space-y-3">
                              <div className="flex items-end gap-3">
                                <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2">
                                  <DraftField label={t('requests.draft.interval-from')}>
                                    <Input
                                      inputMode="decimal"
                                      value={row.from}
                                      aria-invalid={issue != null && (started || saveAttempted)}
                                      onChange={(event) => changeRow(well.id, row, { from: event.target.value })}
                                    />
                                  </DraftField>
                                  <DraftField label={t('requests.draft.interval-to')}>
                                    <Input
                                      inputMode="decimal"
                                      value={row.to}
                                      aria-invalid={issue != null && (started || saveAttempted)}
                                      onChange={(event) => changeRow(well.id, row, { to: event.target.value })}
                                    />
                                  </DraftField>
                                </div>
                                <Button type="button" variant="ghost" size="icon" className="shrink-0" aria-label={t('requests.draft.remove-interval')} onClick={() => askRemoveInterval(well, row.id)}>
                                  <Trash2 aria-hidden />
                                </Button>
                              </div>
                              {issue && (started || saveAttempted) ? <p className="text-xs text-destructive">{t(`requests.errors.${issue}`)}</p> : null}
                            </div>
                          )
                        })}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const id = studyEntityId('interval')
                            setRows((prev) => ({ ...prev, [id]: { id, wellId: well.id, from: '', to: '', unit: 'm' } }))
                          }}
                        >
                          <Plus aria-hidden />
                          {t('requests.draft.add-interval')}
                        </Button>
                      </div>
                    </article>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      <Dialog open={adding} onOpenChange={(open) => { if (!open) resetAdd() }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('requests.draft.add-well-title')}</DialogTitle>
            <DialogDescription>{t('requests.draft.add-well-body')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <DraftField label={t('requests.draft.field')}>
              <Select value={fieldChoice} onValueChange={setFieldChoice}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {catalog.fields.map((item) => (
                    <SelectItem key={item.id} value={item.id}>{optionLabel(t, catalog.fields, item.id)}</SelectItem>
                  ))}
                  <SelectItem value={MANUAL}>{t('requests.draft.manual')}</SelectItem>
                </SelectContent>
              </Select>
            </DraftField>
            {fieldChoice === MANUAL ? (
              <DraftField label={t('requests.draft.manual-field')}>
                <Input value={fieldName} maxLength={REQUEST_TITLE_MAX} onChange={(event) => setFieldName(event.target.value)} />
              </DraftField>
            ) : null}
            <DraftField label={t('requests.draft.well')}>
              <Select value={wellChoice} onValueChange={setWellChoice}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {catalog.wells.map((item) => (
                    <SelectItem key={item.id} value={item.id}>{optionLabel(t, catalog.wells, item.id)}</SelectItem>
                  ))}
                  <SelectItem value={MANUAL}>{t('requests.draft.manual')}</SelectItem>
                </SelectContent>
              </Select>
            </DraftField>
            {wellChoice === MANUAL ? (
              <DraftField label={t('requests.draft.manual-well')}>
                <Input value={wellName} maxLength={REQUEST_TITLE_MAX} onChange={(event) => setWellName(event.target.value)} />
              </DraftField>
            ) : null}
            {addError ? <p className="text-sm text-destructive">{t(`requests.draft.add-error.${addError}`)}</p> : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={resetAdd}>{t('requests.draft.cancel')}</Button>
            <Button type="button" onClick={confirmAdd}>{t('requests.draft.add')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={pending != null} onOpenChange={(open) => { if (!open) setPending(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('requests.draft.remove-title')}</DialogTitle>
            <DialogDescription>
              {pending?.kind === 'interval' ? t('requests.draft.remove-interval-body') : t('requests.draft.remove-well-body')}
            </DialogDescription>
          </DialogHeader>
          {pending && pending.needIds.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">{t('requests.draft.remove-needs')}</p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {pending.needIds.map((id) => {
                  const index = details.needs.findIndex((need) => need.id === id)
                  return <li key={id}>{t('requests.draft.need-title', { index: index + 1 })}</li>
                })}
              </ul>
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPending(null)}>{t('requests.draft.cancel')}</Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                if (!pending) return
                if (pending.kind === 'well') removeWell(pending.id)
                else removeInterval(pending.id)
              }}
            >
              {t('requests.draft.remove-confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DraftSection>
  )
}

function depthText(value: string): string {
  const normalized = value.replace(',', '.')
  let result = ''
  let dotted = false
  for (const char of normalized) {
    if (char >= '0' && char <= '9') result += char
    else if (char === '.' && !dotted) {
      dotted = true
      result += char
    }
  }
  return result
}

function visibleRows(well: RequestWell, rows: Record<string, IntervalRow>): IntervalRow[] {
  const stored = well.intervals.map((interval) => rows[interval.id] ?? {
    id: interval.id,
    wellId: well.id,
    from: String(interval.from),
    to: String(interval.to),
    unit: interval.unit,
  })
  const extra = Object.values(rows).filter((row) => row.wellId === well.id && !well.intervals.some((interval) => interval.id === row.id))
  return [...stored, ...extra]
}

function collectIntervalIssues(details: RequestDraftDetails, rows: Record<string, IntervalRow>): DraftIssue[] {
  const issues: DraftIssue[] = []
  for (const field of details.fields) {
    for (const well of field.wells) {
      for (const row of visibleRows(well, rows)) {
        const code = intervalDraftIssue(row.from, row.to, row.unit)
        if (code) issues.push({ field: `intervals.${row.id}`, code })
      }
    }
  }
  return issues
}
