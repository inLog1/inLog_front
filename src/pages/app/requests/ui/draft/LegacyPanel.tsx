import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import {
  subjectNeedsClarification,
  type RequestCatalog,
  type RequestDraftDetails,
} from '../../../../../entities/request'
import { Card } from '../../../../../shared/ui/card'
import { formatRequestDay, requestLabel } from '../../model/display'
import { optionLabel } from './draft-labels'

export function LegacyPanel({ details, catalog }: { details: RequestDraftDetails; catalog: RequestCatalog }) {
  const { t, i18n } = useTranslation()
  const dash = t('requests.dash')
  const subject = details.subject
  const rows = [
    textRow(t('requests.wizard.contract-number'), details.contractNumber),
    textRow(t('requests.wizard.contract-date'), formatRequestDay(details.contractDate, i18n.language)),
    textRow(t('requests.wizard.contract-until'), formatRequestDay(details.contractUntil, i18n.language)),
    textRow(t('requests.wizard.subsoil-user'), details.subsoilUser),
    textRow(t('requests.wizard.work-basis'), details.workBasis),
    textRow(t('requests.wizard.comment'), details.comment),
    subject.objectKind ? textRow(t('requests.wizard.object-kind'), t(`requests.wizard.kind-${subject.objectKind}`)) : null,
    choiceRow(t('requests.wizard.pad'), subject.padId, catalog.pads, t),
    choiceRow(t('requests.wizard.formation'), subject.formationId, catalog.formations, t),
    textRow(t('requests.wizard.object-number'), subject.objectNumber),
    choiceRow(t('requests.wizard.material'), subject.materialId, catalog.materials, t),
    textRow(t('requests.wizard.delivery-date'), formatRequestDay(subject.deliveryDate, i18n.language)),
    textRow(t('requests.wizard.subject-note'), subject.note),
    textRow(t('requests.wizard.diameter'), subject.core.diameterMm),
    textRow(t('requests.wizard.recovery'), subject.core.recoveryPercent),
    choiceRow(t('requests.wizard.well-type'), subject.fluid.wellTypeId, catalog.wellTypes, t),
    choiceRow(t('requests.wizard.sample-kind'), subject.fluid.sampleKindId, catalog.sampleKinds, t),
    choiceRow(t('requests.wizard.fluid-kind'), subject.fluid.fluidKindId, catalog.fluidKinds, t),
    textRow(t('requests.wizard.sampled-on'), formatRequestDay(subject.fluid.sampledOn, i18n.language)),
    textRow(t('requests.wizard.sample-volume'), subject.fluid.sampleVolumeMl),
    ...subject.fluid.sampleCounts.map((item) => textRow(
      t('requests.wizard.sample-count', { kind: optionLabel(t, catalog.fluidKinds, item.fluidKindId) || item.fluidKindId }),
      item.count,
    )),
    textRow(t('requests.wizard.plan-total'), details.corePlan.totalRecovery),
    textRow(t('requests.wizard.plan-consolidated'), details.corePlan.consolidated),
    textRow(t('requests.wizard.plan-unconsolidated'), details.corePlan.unconsolidated),
    textRow(t('requests.wizard.plan-jurassic'), details.corePlan.jurassic),
    textRow(t('requests.wizard.plan-wells'), details.corePlan.wellCount),
    textRow(t('requests.wizard.plan-cylinders'), details.corePlan.cylinderYield),
    textRow(t('requests.wizard.plan-sections'), details.corePlan.thinSectionsPerMeter),
    textRow(t('requests.wizard.plan-due'), formatRequestDay(details.corePlan.programDue, i18n.language)),
  ].filter((row): row is { label: string; value: string } => row != null)

  const samples = details.sampleIds.map((id) => catalog.samples.find((item) => item.id === id) ?? null)
  const visible = rows.length > 0 || details.program.length > 0 || details.sampleIds.length > 0 || details.clarifications.length > 0
  if (!visible) return null

  return (
    <Card className="shadow-sm">
      <div className="space-y-1 border-b border-border px-4 py-4 md:px-6">
        <h2 className="text-base font-semibold text-foreground">{t('requests.draft.legacy-title')}</h2>
        <p className="max-w-2xl text-sm text-muted-foreground">{t('requests.draft.legacy-lead')}</p>
      </div>
      <div className="space-y-4 px-4 py-4 md:px-6 md:py-5">
        {details.clarifications.map((item) => (
          <p key={item.id} className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
            {t(`requests.draft.legacy-note.${item.code}`)}
          </p>
        ))}
        {subjectNeedsClarification(subject) ? (
          <p className="text-sm text-muted-foreground">{t('requests.draft.legacy-subject')}</p>
        ) : null}
        {rows.length > 0 ? (
          <dl className="grid gap-3 sm:grid-cols-2">
            {rows.map((row) => (
              <div key={row.label} className="min-w-0">
                <dt className="text-xs text-muted-foreground">{row.label}</dt>
                <dd className="mt-1 whitespace-pre-wrap text-sm text-foreground">{row.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {details.program.length > 0 ? (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">{t('requests.draft.legacy-program-lines')}</h3>
            <ul className="space-y-2">
              {details.program.map((line) => (
                <li key={line.id} className="rounded-lg border border-border px-3 py-3 text-sm text-foreground">
                  <p>{requestLabel(optionLabel(t, catalog.workKinds, line.workKindId), dash)}</p>
                  <p className="mt-1 text-muted-foreground">
                    {[
                      line.quantity ? `${line.quantity} ${optionLabel(t, catalog.units, line.unitId)}`.trim() : '',
                      line.code,
                      line.note,
                      optionLabel(t, catalog.curators, line.curatorId),
                      formatRequestDay(line.dueDate, i18n.language),
                    ].filter(Boolean).join(' · ')}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {details.sampleIds.length > 0 ? (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">{t('requests.draft.legacy-samples')}</h3>
            <ul className="space-y-1 text-sm text-foreground">
              {details.sampleIds.map((id, index) => {
                const sample = samples[index]
                return <li key={id}>{sample ? `${sample.number} · ${sample.geologicalNumber}` : id}</li>
              })}
            </ul>
          </div>
        ) : null}
      </div>
    </Card>
  )
}

function textRow(label: string, value: string): { label: string; value: string } | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  return { label, value: trimmed }
}

function choiceRow(
  label: string,
  id: string,
  options: readonly { id: string; label: string }[],
  t: TFunction,
): { label: string; value: string } | null {
  if (!id.trim()) return null
  return { label, value: optionLabel(t, options, id) || id }
}
