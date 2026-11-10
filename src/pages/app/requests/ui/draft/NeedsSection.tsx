import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2 } from 'lucide-react'
import {
  REQUEST_NEED_TEXT_MAX,
  emptyResearchNeed,
  inspectPlannedQuantity,
  intervalsSelectedByNeed,
  wellsSelectedByNeed,
  type DraftIssue,
  type RequestCatalog,
  type RequestDraftDetails,
  type RequestResearchNeed,
} from '../../../../../entities/request'
import { Badge } from '../../../../../shared/ui/badge'
import { Button } from '../../../../../shared/ui/button'
import { Checkbox } from '../../../../../shared/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../../shared/ui/select'
import { Textarea } from '../../../../../shared/ui/textarea'
import { Input } from '../../../../../shared/ui/input'
import { countStudyWells, quantityDraftValue, setNeedInterval, setNeedWholeWell, studyEntityId } from '../../model/draft-form'
import { fieldCaption, optionLabel, wellCaption } from './draft-labels'
import { DraftField, DraftSection } from './draft-ui'

const NONE = 'none'

export function NeedsSection({
  details,
  catalog,
  invalid,
  commit,
  onIssues,
  onShowObjects,
}: {
  details: RequestDraftDetails
  catalog: RequestCatalog
  invalid: Set<string>
  commit: (recipe: (current: RequestDraftDetails) => RequestDraftDetails) => void
  onIssues: (issues: DraftIssue[]) => void
  onShowObjects: () => void
}) {
  const { t } = useTranslation()
  const dash = t('requests.dash')
  const units = catalog.units.map((item) => item.id)
  const [quantities, setQuantities] = useState<Record<string, string>>({})
  const wellCount = countStudyWells(details.fields)
  const issues = useMemo(() => collectQuantityIssues(details.needs, quantities, units), [details.needs, quantities, units])
  const signature = JSON.stringify(issues)
  useEffect(() => {
    onIssues(JSON.parse(signature) as DraftIssue[])
  }, [onIssues, signature])

  const update = (need: RequestResearchNeed) => commit((current) => ({
    ...current,
    needs: current.needs.map((item) => item.id === need.id ? need : item),
  }))

  return (
    <DraftSection
      id="request-program"
      index={3}
      title={t('requests.draft.sections.program')}
      description={t('requests.draft.program-lead')}
      action={(
        <Button
          type="button"
          disabled={wellCount === 0}
          onClick={() => commit((current) => ({ ...current, needs: [...current.needs, emptyResearchNeed(studyEntityId('need'))] }))}
        >
          <Plus aria-hidden />
          {t('requests.draft.add-need')}
        </Button>
      )}
    >
      {wellCount === 0 && details.needs.length === 0 ? (
        <div className="max-w-2xl space-y-3">
          <p className="text-sm text-muted-foreground">{t('requests.draft.needs-no-wells')}</p>
          <Button type="button" variant="outline" onClick={onShowObjects}>{t('requests.draft.go-to-wells')}</Button>
        </div>
      ) : details.needs.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('requests.draft.needs-empty')}</p>
      ) : (
        <div className="space-y-4">
          {wellCount === 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3">
              <p className="text-sm text-muted-foreground">{t('requests.draft.needs-no-wells')}</p>
              <Button type="button" variant="outline" size="sm" onClick={onShowObjects}>{t('requests.draft.go-to-wells')}</Button>
            </div>
          ) : null}
          {details.needs.map((need, index) => {
            const quantityText = quantities[need.id] ?? (need.quantity == null ? '' : String(need.quantity))
            const quantityIssue = quantityDraftValue(quantityText).ok ? null : 'invalid_quantity'
            const selectedWells = wellsSelectedByNeed(details.fields, need)
            const selectedIntervals = intervalsSelectedByNeed(details.fields, need)
            return (
              <article key={need.id} className="space-y-4 rounded-lg border border-border bg-card px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-2">
                    <h3 className="text-sm font-semibold text-foreground">{t('requests.draft.need-title', { index: index + 1 })}</h3>
                    {need.clarification === 'unlinked_program_line' ? (
                      <p className="max-w-2xl text-sm text-muted-foreground">{t('requests.draft.unlinked')}</p>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t('requests.draft.remove-need')}
                    onClick={() => {
                      setQuantities((prev) => {
                        const next = { ...prev }
                        delete next[need.id]
                        return next
                      })
                      commit((current) => ({ ...current, needs: current.needs.filter((item) => item.id !== need.id) }))
                    }}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-medium text-foreground">{t('requests.draft.need-objects')}</p>
                  {wellCount === 0 ? <p className="text-sm text-muted-foreground">{t('requests.draft.need-selected-empty')}</p> : (
                    <div className="space-y-4">
                      {details.fields.filter((field) => field.wells.length > 0).map((field) => (
                        <div key={field.id} className="space-y-2">
                          <p className="text-xs font-medium text-muted-foreground">{fieldCaption(t, field, catalog.fields, dash)}</p>
                          {field.wells.map((well) => {
                            const target = need.targets.find((item) => item.wellId === well.id)
                            const whole = target?.selection === 'well'
                            return (
                              <div key={well.id} className="rounded-md border border-border px-3 py-3">
                                <div className="flex items-center gap-2 text-sm text-foreground">
                                  <Checkbox
                                    id={`${need.id}-${well.id}-whole`}
                                    checked={whole}
                                    onCheckedChange={(checked) => update(setNeedWholeWell(need, well.id, checked === true))}
                                  />
                                  <label htmlFor={`${need.id}-${well.id}-whole`} className="flex flex-wrap items-center gap-2">
                                    <span>{t('requests.draft.well-label', { name: wellCaption(t, well, catalog.wells, dash) })}</span>
                                    <span className="text-muted-foreground">{t('requests.draft.whole-well')}</span>
                                  </label>
                                </div>
                                {well.intervals.length > 0 ? (
                                  <div className="mt-2 space-y-2 pl-6">
                                    {well.intervals.map((interval) => (
                                      <div key={interval.id} className="flex items-center gap-2 text-sm text-foreground">
                                        <Checkbox
                                          id={`${need.id}-${interval.id}`}
                                          checked={target?.selection === 'intervals' && target.intervalIds.includes(interval.id)}
                                          onCheckedChange={(checked) => update(setNeedInterval(need, well.id, interval.id, checked === true))}
                                        />
                                        <label htmlFor={`${need.id}-${interval.id}`}>
                                          {interval.from}–{interval.to} {t('requests.draft.depth-m')}
                                        </label>
                                      </div>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            )
                          })}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {selectedWells.length === 0 ? <p className="text-sm text-muted-foreground">{t('requests.draft.need-selected-empty')}</p> : selectedWells.map((item) => {
                      const whole = need.targets.find((target) => target.wellId === item.well.id)?.selection === 'well'
                      const ranges = selectedIntervals.filter((interval) => interval.well.id === item.well.id)
                      const suffix = whole
                        ? t('requests.draft.whole-well')
                        : ranges.map((interval) => `${interval.interval.from}–${interval.interval.to}`).join(', ')
                      return (
                        <Badge key={item.well.id} variant="secondary">
                          {fieldCaption(t, item.field, catalog.fields, dash)} · {wellCaption(t, item.well, catalog.wells, dash)} · {suffix}
                        </Badge>
                      )
                    })}
                  </div>
                </div>

                <div className="grid max-w-3xl gap-4 sm:grid-cols-2">
                  <DraftField label={t('requests.draft.research')} field={`needs.${index}.researchId`}>
                    <Select
                      value={need.researchId || NONE}
                      onValueChange={(value) => update({ ...need, researchId: value === NONE ? '' : value })}
                    >
                      <SelectTrigger aria-invalid={invalid.has(`needs.${index}.researchId`)} className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>{t('requests.draft.research-empty')}</SelectItem>
                        {catalog.workKinds.map((item) => (
                          <SelectItem key={item.id} value={item.id}>{optionLabel(t, catalog.workKinds, item.id)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </DraftField>
                  <DraftField label={t('requests.draft.sample-type')}>
                    <Select
                      value={need.sampleTypeId || NONE}
                      onValueChange={(value) => update({ ...need, sampleTypeId: value === NONE ? '' : value })}
                    >
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>{t('requests.wizard.not-selected')}</SelectItem>
                        {catalog.sampleKinds.map((item) => (
                          <SelectItem key={item.id} value={item.id}>{optionLabel(t, catalog.sampleKinds, item.id)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </DraftField>
                  <div className="sm:col-span-2">
                    <DraftField label={t('requests.draft.desired-result')} field={`needs.${index}.desiredResult`} hint={need.researchId ? undefined : t('requests.draft.desired-result-hint')}>
                      <Textarea
                        value={need.desiredResult}
                        maxLength={REQUEST_NEED_TEXT_MAX}
                        aria-invalid={invalid.has(`needs.${index}.desiredResult`)}
                        onChange={(event) => update({ ...need, desiredResult: event.target.value })}
                      />
                    </DraftField>
                  </div>
                  <DraftField label={t('requests.draft.quantity')} field={`needs.${index}.quantity`}>
                    <Input
                      inputMode="decimal"
                      value={quantityText}
                      aria-invalid={quantityIssue != null || invalid.has(`needs.${index}.quantity`)}
                      onChange={(event) => {
                        const raw = event.target.value
                        setQuantities((prev) => ({ ...prev, [need.id]: raw }))
                        const parsed = quantityDraftValue(raw)
                        if (parsed.ok) update({ ...need, quantity: parsed.quantity })
                      }}
                    />
                  </DraftField>
                  <DraftField label={t('requests.draft.unit')} field={`needs.${index}.unitId`} hint={need.quantity != null && need.unitId === '' ? t('requests.draft.unit-required') : undefined}>
                    <Select
                      value={need.unitId || NONE}
                      onValueChange={(value) => update({ ...need, unitId: value === NONE ? '' : value })}
                    >
                      <SelectTrigger aria-invalid={invalid.has(`needs.${index}.quantity`)} className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>{t('requests.wizard.not-selected')}</SelectItem>
                        {catalog.units.map((item) => (
                          <SelectItem key={item.id} value={item.id}>{optionLabel(t, catalog.units, item.id)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </DraftField>
                  <div className="sm:col-span-2">
                    <DraftField label={t('requests.draft.comment')}>
                      <Textarea
                        value={need.comment}
                        maxLength={REQUEST_NEED_TEXT_MAX}
                        onChange={(event) => update({ ...need, comment: event.target.value })}
                      />
                    </DraftField>
                  </div>
                  {quantityIssue ? <p className="text-xs text-destructive sm:col-span-2">{t('requests.errors.invalid_quantity')}</p> : null}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </DraftSection>
  )
}

function collectQuantityIssues(
  needs: readonly RequestResearchNeed[],
  quantities: Record<string, string>,
  units: readonly string[],
): DraftIssue[] {
  const issues: DraftIssue[] = []
  needs.forEach((need, index) => {
    const raw = quantities[need.id]
    if (raw != null && !quantityDraftValue(raw).ok) {
      issues.push({ field: `needs.${index}.quantity`, code: 'invalid_quantity' })
      return
    }
    const planned = inspectPlannedQuantity(need.quantity, need.unitId, units)
    if (!planned.ok) issues.push({ field: `needs.${index}.quantity`, code: planned.code === 'invalid_need' ? 'invalid_need' : planned.code })
  })
  return issues
}
