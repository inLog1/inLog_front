import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  effectiveProgramLines,
  findWellById,
  isRequestStatus,
  programPreparedSide,
  readProgramMeta,
  type RequestCatalog,
  type RequestEventView,
  type RequestListItem,
  type RequestProgramStudyLine,
} from '../../../../entities/request'
import { Card } from '../../../../shared/ui/card'
import { formatRequestDay, formatRequestWhen, requestLabel } from '../model/display'
import { fieldCaption, optionLabel, wellCaption } from './draft/draft-labels'

function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="shadow-sm">
      <div className="border-b border-border px-4 py-4 md:px-6">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
      </div>
      <div className="space-y-4 px-4 py-4 text-sm text-foreground md:px-6">{children}</div>
    </Card>
  )
}

export function RequestFactsCard({
  request,
  dash,
}: {
  request: RequestListItem
  dash: string
}) {
  const { t, i18n } = useTranslation()
  const priority = request.details?.priority
  const meta = readProgramMeta(request.details?.programMeta)
  const side = programPreparedSide(request.details?.needs ?? [], meta)
  const desired = request.details?.plannedCompletion
    ? formatRequestDay(request.details.plannedCompletion, i18n.language)
    : ''
  const when = (value?: string) => value ? requestLabel(formatRequestWhen(value, i18n.language), dash) : dash
  const own = request.customerOrganizationId === request.executorOrganizationId
  const rows = [
    [t('requests.field-status'), t(`requests.status.${request.status}`)],
    [t('requests.field-customer'), requestLabel(request.customerShortName, dash)],
    [t('requests.columns.executor'), requestLabel(request.executorShortName, dash)],
    [t('requests.field-author'), requestLabel(request.authorName, dash)],
    [t('requests.field-sent'), when(request.sentAt)],
    [t('requests.card.priority'), priority ? t(`requests.draft.priority-${priority}`, { defaultValue: priority }) : dash],
    [t('requests.card.desired'), requestLabel(desired, dash)],
    [t('requests.program.stage'), t(`requests.program.approval.${meta.approval}`)],
    [t('requests.program.prepared-by'), side ? t(`requests.program.side.${side}`) : dash],
    [t('requests.program.version'), meta.version > 0 ? String(meta.version) : dash],
  ]
  return (
    <SectionCard title={t('requests.card.facts')}>
      <dl className="space-y-3">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="mt-1">{value}</dd>
          </div>
        ))}
      </dl>
      {own ? <p className="text-muted-foreground">{t('requests.program.own')}</p> : null}
      {request.sourceRequestNumber ? (
        <p className="text-muted-foreground">{t('requests.review.source', { number: request.sourceRequestNumber })}</p>
      ) : null}
    </SectionCard>
  )
}

export function RequestObjectsCard({ request, catalog, dash }: { request: RequestListItem; catalog?: RequestCatalog; dash: string }) {
  const { t } = useTranslation()
  const fields = request.details?.fields ?? []
  const subject = request.details?.subject
  return (
    <SectionCard title={t('requests.card.objects')}>
      {fields.length === 0 && subject && (subject.fieldId || subject.wellId || subject.objectNumber) ? (
        <p>{[optionLabel(t, catalog?.fields ?? [], subject.fieldId), optionLabel(t, catalog?.wells ?? [], subject.wellId), subject.objectNumber].filter(Boolean).join(', ') || dash}</p>
      ) : null}
      {fields.length === 0 && !(subject && (subject.fieldId || subject.wellId || subject.objectNumber)) ? (
        <p className="text-muted-foreground">{t('requests.card.objects-empty')}</p>
      ) : null}
      {fields.map((field) => (
        <div key={field.id} className="space-y-2">
          <p className="font-medium">{fieldCaption(t, field, catalog?.fields ?? [], dash)}</p>
          {field.wells.map((well) => (
            <div key={well.id} className="pl-3">
              <p>{t('requests.draft.well-label', { name: wellCaption(t, well, catalog?.wells ?? [], dash) })}</p>
              {well.intervals.length === 0 ? (
                <p className="text-muted-foreground">{t('requests.draft.intervals-empty')}</p>
              ) : (
                <ul className="mt-1 space-y-1 text-muted-foreground">
                  {well.intervals.map((interval) => (
                    <li key={interval.id}>{t('requests.card.interval', { from: interval.from, to: interval.to, unit: interval.unit })}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      ))}
    </SectionCard>
  )
}

function TargetList({
  lines,
  request,
  catalog,
  dash,
}: {
  lines: ReadonlyArray<{ id: string; targets: RequestProgramStudyLine['targets'] }>
  request: RequestListItem
  catalog?: RequestCatalog
  dash: string
}) {
  const { t } = useTranslation()
  const fields = request.details?.fields ?? []
  return (
    <>
      {lines.map((line) => (
        <ul key={line.id} className="space-y-1 text-muted-foreground">
          {line.targets.map((target) => {
            const located = findWellById(fields, target.wellId)
            const name = located ? wellCaption(t, located.well, catalog?.wells ?? [], dash) : dash
            const intervals = target.selection === 'intervals'
              ? target.intervalIds.map((intervalId) => located?.well.intervals.find((item) => item.id === intervalId))
                .filter((item) => item != null)
                .map((item) => t('requests.card.interval', { from: item.from, to: item.to, unit: item.unit }))
                .join(', ')
              : t('requests.card.whole-well')
            return <li key={`${line.id}:${target.wellId}`}>{name}: {intervals}</li>
          })}
        </ul>
      ))}
    </>
  )
}

export function RequestNeedsCard({ request, catalog, dash }: { request: RequestListItem; catalog?: RequestCatalog; dash: string }) {
  const { t } = useTranslation()
  const needs = request.details?.needs ?? []
  const legacy = request.details?.program ?? []
  return (
    <SectionCard title={t('requests.card.needs')}>
      {needs.length === 0 && legacy.length === 0 ? <p className="text-muted-foreground">{t('requests.card.needs-empty')}</p> : null}
      {needs.map((need, index) => {
        const research = optionLabel(t, catalog?.workKinds ?? [], need.researchId)
        return (
          <div key={need.id} className="space-y-1">
            <p className="font-medium">{t('requests.draft.need-title', { index: index + 1 })}</p>
            <p>{requestLabel(need.desiredResult || research, dash)}</p>
            {need.desiredResult && research ? <p className="text-muted-foreground">{research}</p> : null}
            <TargetList lines={[{ id: need.id, targets: need.targets }]} request={request} catalog={catalog} dash={dash} />
          </div>
        )
      })}
      {needs.length === 0 ? legacy.map((line) => (
        <p key={line.id}>{requestLabel(optionLabel(t, catalog?.workKinds ?? [], line.workKindId), dash)}{line.quantity ? ` — ${line.quantity}` : ''}</p>
      )) : null}
    </SectionCard>
  )
}

export function RequestProgramCard({
  request,
  catalog,
  dash,
  editor,
}: {
  request: RequestListItem
  catalog?: RequestCatalog
  dash: string
  editor?: ReactNode
}) {
  const { t } = useTranslation()
  const meta = readProgramMeta(request.details?.programMeta)
  const lines = meta.approval === 'approved' && meta.approvedSnapshot
    ? meta.approvedSnapshot.lines
    : effectiveProgramLines(request.details?.needs ?? [], meta)
  return (
    <SectionCard title={t('requests.card.program')}>
      {editor ?? (
        lines.length === 0 ? <p className="text-muted-foreground">{t('requests.card.program-empty')}</p> : lines.map((line, index) => (
          <ProgramLine key={line.id} line={line} index={index} request={request} catalog={catalog} dash={dash} />
        ))
      )}
      {!editor && meta.note ? <p className="whitespace-pre-wrap">{meta.note}</p> : null}
    </SectionCard>
  )
}

function ProgramLine({
  line,
  index,
  request,
  catalog,
  dash,
}: {
  line: RequestProgramStudyLine
  index: number
  request: RequestListItem
  catalog?: RequestCatalog
  dash: string
}) {
  const { t } = useTranslation()
  const research = optionLabel(t, catalog?.workKinds ?? [], line.researchId)
  const quantity = line.quantity == null ? '' : `${line.quantity}${line.unitId ? ` ${optionLabel(t, catalog?.units ?? [], line.unitId)}` : ''}`
  return (
    <div className="space-y-1">
      <p className="font-medium">{t('requests.program.line', { index: index + 1 })}</p>
      <p>{requestLabel(research, dash)}{quantity ? ` — ${quantity}` : ''}</p>
      {line.note ? <p className="text-muted-foreground">{line.note}</p> : null}
      <TargetList lines={[line]} request={request} catalog={catalog} dash={dash} />
    </div>
  )
}

export function RequestBasisCard({
  request,
  organizationId,
}: {
  request: RequestListItem
  organizationId: number
}) {
  const { t } = useTranslation()
  const document = request.basisDocument
  return (
    <SectionCard title={t('requests.draft.sections.basis')}>
      {document ? (
        <a
          className="font-medium text-primary underline-offset-4 hover:underline"
          href={`${document.url}organization=${organizationId}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {document.filename}
        </a>
      ) : (
        <p className="text-muted-foreground">{request.sourceRequestId ? t('requests.review.basis-again') : t('requests.card.basis-empty')}</p>
      )}
    </SectionCard>
  )
}

export function RequestHistoryCard({ request, dash }: { request: RequestListItem; dash: string }) {
  const { t, i18n } = useTranslation()
  const events = request.events ?? []
  const statusLabel = (value: string) => isRequestStatus(value) ? t(`requests.status.${value}`) : dash
  const title = (event: RequestEventView) => {
    if (event.type === 'derived' && event.previousStatus !== event.newStatus) {
      return t('requests.events.derived', { number: event.comment ?? dash })
    }
    if (event.type === 'derived') return t('requests.events.derived-source', { number: event.comment ?? dash })
    return t(`requests.events.${event.type}`)
  }
  return (
    <SectionCard title={t('requests.events.title')}>
      {events.length === 0 ? <p className="text-muted-foreground">{t('requests.events.empty')}</p> : null}
      <ol className="space-y-4">
        {events.map((event) => (
          <li key={event.id} className="space-y-1">
            <p className="font-medium">{title(event)}</p>
            <p className="text-muted-foreground">
              {requestLabel(event.authorName, dash)}
              {' · '}
              {requestLabel(formatRequestWhen(event.at, i18n.language), dash)}
            </p>
            {event.previousStatus !== event.newStatus ? (
              <p className="text-muted-foreground">{t('requests.events.transition', {
                previous: statusLabel(event.previousStatus),
                next: statusLabel(event.newStatus),
              })}</p>
            ) : null}
            {event.previousApproval && event.nextApproval ? (
              <p className="text-muted-foreground">{t('requests.events.program-transition', {
                previous: t(`requests.program.approval.${event.previousApproval}`, { defaultValue: event.previousApproval }),
                next: t(`requests.program.approval.${event.nextApproval}`, { defaultValue: event.nextApproval }),
              })}</p>
            ) : null}
            {event.comment && event.type !== 'derived' ? <p className="whitespace-pre-wrap">{event.comment}</p> : null}
          </li>
        ))}
      </ol>
    </SectionCard>
  )
}

export function RequestReasonNotice({ request }: { request: RequestListItem }) {
  const { t, i18n } = useTranslation()
  const when = (value?: string) => value ? formatRequestWhen(value, i18n.language) : ''
  const meta = readProgramMeta(request.details?.programMeta)
  if (request.status === 'in_review' && meta.approval === 'returned' && meta.returnReason) {
    return (
      <div role="status" className="rounded-xl border border-border bg-card px-4 py-4 text-sm shadow-sm md:px-6">
        <p className="font-medium text-foreground">{t('requests.program.returned-title')}</p>
        <p className="mt-2 whitespace-pre-wrap text-foreground">{meta.returnReason}</p>
      </div>
    )
  }
  if (request.status === 'rework' && request.returnReason) {
    return (
      <div role="status" className="rounded-xl border border-border bg-card px-4 py-4 text-sm shadow-sm md:px-6">
        <p className="font-medium text-foreground">{t('requests.review.returned-title')}</p>
        <p className="mt-2 whitespace-pre-wrap text-foreground">{request.returnReason}</p>
        {request.returnedAt ? <p className="mt-2 text-muted-foreground">{when(request.returnedAt)}</p> : null}
      </div>
    )
  }
  if (request.status === 'rejected' && request.rejectionReason) {
    return (
      <div role="status" className="rounded-xl border border-border bg-card px-4 py-4 text-sm shadow-sm md:px-6">
        <p className="font-medium text-foreground">{t('requests.review.rejected-title')}</p>
        <p className="mt-2 whitespace-pre-wrap text-foreground">{request.rejectionReason}</p>
        {request.rejectedAt ? <p className="mt-2 text-muted-foreground">{when(request.rejectedAt)}</p> : null}
      </div>
    )
  }
  if (request.status === 'withdrawn') {
    return (
      <div role="status" className="rounded-xl border border-border bg-card px-4 py-4 text-sm text-foreground shadow-sm md:px-6">
        {t('requests.review.withdrawn-note')}
      </div>
    )
  }
  return null
}
