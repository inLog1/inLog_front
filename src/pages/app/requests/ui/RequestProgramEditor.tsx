import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  emptyResearchNeed,
  type RequestCatalog,
  type RequestListItem,
  type RequestProgramStudyLine,
} from '../../../../entities/request'
import { Checkbox } from '../../../../shared/ui/checkbox'
import { Input } from '../../../../shared/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../shared/ui/select'
import { Textarea } from '../../../../shared/ui/textarea'
import { quantityDraftValue, setNeedInterval, setNeedWholeWell } from '../model/draft-form'
import { fieldCaption, optionLabel, wellCaption } from './draft/draft-labels'
import { DraftField } from './draft/draft-ui'

const NONE = 'none'

export function RequestProgramEditor({
  request,
  catalog,
  lines,
  note,
  onLines,
  onNote,
}: {
  request: RequestListItem
  catalog?: RequestCatalog
  lines: RequestProgramStudyLine[]
  note: string
  onLines: (lines: RequestProgramStudyLine[]) => void
  onNote: (note: string) => void
}) {
  const { t } = useTranslation()
  const dash = t('requests.dash')
  const fields = request.details?.fields ?? []
  const needs = request.details?.needs ?? []
  const [quantities, setQuantities] = useState<Record<string, string>>({})
  const replace = (line: RequestProgramStudyLine) => onLines(lines.map((item) => item.id === line.id ? line : item))

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t('requests.program.editor-lead')}</p>
      {lines.map((line, index) => {
        const need = needs.find((item) => item.id === line.needId)
        const quantityText = quantities[line.id] ?? (line.quantity == null ? '' : String(line.quantity))
        const quantityIssue = quantityDraftValue(quantityText).ok ? null : 'invalid_quantity'
        const carrier = { ...emptyResearchNeed(line.id), targets: line.targets }
        return (
          <article key={line.id} className="space-y-4 rounded-lg border border-border px-4 py-4">
            <h3 className="text-sm font-semibold text-foreground">{t('requests.program.line', { index: index + 1 })}</h3>
            {need?.desiredResult ? (
              <p className="text-sm text-muted-foreground">{t('requests.program.customer-result')}: {need.desiredResult}</p>
            ) : null}
            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">{t('requests.draft.need-objects')}</p>
              {fields.filter((field) => field.wells.length > 0).map((field) => (
                <div key={field.id} className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">{fieldCaption(t, field, catalog?.fields ?? [], dash)}</p>
                  {field.wells.map((well) => {
                    const target = line.targets.find((item) => item.wellId === well.id)
                    const whole = target?.selection === 'well'
                    return (
                      <div key={well.id} className="rounded-md border border-border px-3 py-3">
                        <div className="flex items-center gap-2 text-sm">
                          <Checkbox
                            id={`${line.id}-${well.id}-whole`}
                            checked={whole}
                            onCheckedChange={(checked) => {
                              const next = setNeedWholeWell(carrier, well.id, checked === true)
                              replace({ ...line, targets: next.targets })
                            }}
                          />
                          <label htmlFor={`${line.id}-${well.id}-whole`}>
                            {t('requests.draft.well-label', { name: wellCaption(t, well, catalog?.wells ?? [], dash) })}
                            <span className="ml-2 text-muted-foreground">{t('requests.draft.whole-well')}</span>
                          </label>
                        </div>
                        {well.intervals.length > 0 ? (
                          <div className="mt-2 space-y-2 pl-6">
                            {well.intervals.map((interval) => (
                              <div key={interval.id} className="flex items-center gap-2 text-sm">
                                <Checkbox
                                  id={`${line.id}-${interval.id}`}
                                  checked={target?.selection === 'intervals' && target.intervalIds.includes(interval.id)}
                                  onCheckedChange={(checked) => {
                                    const next = setNeedInterval(carrier, well.id, interval.id, checked === true)
                                    replace({ ...line, targets: next.targets })
                                  }}
                                />
                                <label htmlFor={`${line.id}-${interval.id}`}>
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
            <div className="grid max-w-3xl gap-4 sm:grid-cols-2">
              <DraftField label={t('requests.draft.research')} field={`program.${index}.researchId`}>
                <Select value={line.researchId || NONE} onValueChange={(value) => replace({ ...line, researchId: value === NONE ? '' : value })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>{t('requests.draft.research-empty')}</SelectItem>
                    {(catalog?.workKinds ?? []).map((item) => (
                      <SelectItem key={item.id} value={item.id}>{optionLabel(t, catalog?.workKinds ?? [], item.id)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </DraftField>
              <DraftField label={t('requests.draft.quantity')} field={`program.${index}.quantity`}>
                <Input
                  inputMode="decimal"
                  value={quantityText}
                  aria-invalid={quantityIssue != null || undefined}
                  onChange={(event) => {
                    const raw = event.target.value
                    setQuantities((prev) => ({ ...prev, [line.id]: raw }))
                    const parsed = quantityDraftValue(raw)
                    if (parsed.ok) replace({ ...line, quantity: parsed.quantity })
                  }}
                />
              </DraftField>
              <DraftField
                label={t('requests.draft.unit')}
                field={`program.${index}.unitId`}
                hint={line.quantity != null && line.unitId === '' ? t('requests.draft.unit-required') : undefined}
              >
                <Select value={line.unitId || NONE} onValueChange={(value) => replace({ ...line, unitId: value === NONE ? '' : value })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>{t('requests.wizard.not-selected')}</SelectItem>
                    {(catalog?.units ?? []).map((item) => (
                      <SelectItem key={item.id} value={item.id}>{optionLabel(t, catalog?.units ?? [], item.id)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </DraftField>
              <div className="sm:col-span-2">
                <DraftField label={t('requests.program.line-note')}>
                  <Textarea value={line.note} maxLength={1000} onChange={(event) => replace({ ...line, note: event.target.value })} />
                </DraftField>
              </div>
              {quantityIssue ? <p className="text-xs text-destructive sm:col-span-2">{t('requests.errors.invalid_quantity')}</p> : null}
            </div>
          </article>
        )
      })}
      <DraftField label={t('requests.program.note')}>
        <Textarea value={note} maxLength={1000} onChange={(event) => onNote(event.target.value)} />
      </DraftField>
    </div>
  )
}
