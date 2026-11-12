import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  effectiveProgramLines,
  findWellById,
  isRequestPriority,
  isRequestStatus,
  programPreparedSide,
  readProgramMeta,
  type RequestCatalog,
  type RequestEventView,
  type RequestListItem,
  type RequestPriority,
  type RequestProgramApproval,
  type RequestProgramStudyLine,
} from '../../../../entities/request'
import { cn } from '../../../../shared/lib/utils'
import { Card } from '../../../../shared/ui/card'
import { formatRequestDay, formatRequestWhen, requestLabel } from '../model/display'
import { fieldCaption, optionLabel, wellCaption } from './draft/draft-labels'
import { RequestStatusBadge, RequestStatusText } from './RequestStatusBadge'

const PRIORITY_TOKEN: Record<RequestPriority, string> = {
  low: '--low-priority',
  medium: '--medium-priority',
  high: '--important-priority',
  critical: '--critical-priority',
  normal: '--medium-priority',
  urgent: '--important-priority',
}

const STAGE_TONE: Record<RequestProgramApproval, { chip: string; text: string }> = {
  unspecified: {
    chip: 'bg-muted text-muted-foreground',
    text: 'text-muted-foreground',
  },
  draft: {
    chip: 'bg-muted text-muted-foreground',
    text: 'text-muted-foreground',
  },
  pending_customer: {
    chip: 'bg-[color-mix(in_srgb,var(--primary)_14%,transparent)] text-primary',
    text: 'text-primary',
  },
  returned: {
    chip: 'bg-[color-mix(in_srgb,var(--warning)_22%,transparent)] text-[color-mix(in_srgb,var(--warning)_62%,var(--foreground))]',
    text: 'text-[color-mix(in_srgb,var(--warning)_62%,var(--foreground))]',
  },
  approved: {
    chip: 'bg-[color-mix(in_srgb,var(--success)_16%,transparent)] text-[color-mix(in_srgb,var(--success)_75%,var(--foreground))]',
    text: 'text-[color-mix(in_srgb,var(--success)_75%,var(--foreground))]',
  },
}

function isProgramApproval(value: string): value is RequestProgramApproval {
  return value in STAGE_TONE
}

function FactRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-x-4 gap-y-1">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right">{value}</dd>
    </div>
  )
}

function PriorityValue({ priority }: { priority: RequestPriority }) {
  const { t } = useTranslation()
  const token = PRIORITY_TOKEN[priority]
  const color = `color-mix(in srgb, var(${token}) 70%, var(--foreground))`
  return (
    <span className="inline-flex items-center justify-end gap-1.5 font-medium">
      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: `var(${token})` }} aria-hidden />
      <span style={{ color }}>{t(`requests.draft.priority-${priority}`)}</span>
    </span>
  )
}

function StageValue({ approval }: { approval: RequestProgramApproval }) {
  const { t } = useTranslation()
  return (
    <span className={cn('inline-flex max-w-full items-center gap-1.5 rounded-full px-2 py-0.5 text-left text-xs font-medium', STAGE_TONE[approval].chip)}>
      <span className="size-1.5 shrink-0 rounded-full bg-current" aria-hidden />
      <span className="min-w-0">{t(`requests.program.approval.${approval}`)}</span>
    </span>
  )
}

function StatusMark({ value, dash }: { value: string; dash: string }) {
  if (!isRequestStatus(value)) return dash
  return <RequestStatusText status={value} />
}

function StageMark({ value, dash }: { value: string; dash: string }) {
  const { t } = useTranslation()
  if (!isProgramApproval(value)) return dash
  return <span className={cn('font-medium', STAGE_TONE[value].text)}>{t(`requests.program.approval.${value}`)}</span>
}

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
  const rows: { key: string; label: string; value: ReactNode }[] = [
    { key: 'status', label: t('requests.field-status'), value: <RequestStatusBadge status={request.status} /> },
    { key: 'customer', label: t('requests.field-customer'), value: requestLabel(request.customerShortName, dash) },
    { key: 'executor', label: t('requests.columns.executor'), value: requestLabel(request.executorShortName, dash) },
    { key: 'author', label: t('requests.field-author'), value: requestLabel(request.authorName, dash) },
    { key: 'sent', label: t('requests.field-sent'), value: when(request.sentAt) },
    {
      key: 'priority',
      label: t('requests.card.priority'),
      value: priority && isRequestPriority(priority) ? <PriorityValue priority={priority} /> : dash,
    },
    { key: 'desired', label: t('requests.card.desired'), value: requestLabel(desired, dash) },
    { key: 'stage', label: t('requests.program.stage'), value: <StageValue approval={meta.approval} /> },
    { key: 'prepared', label: t('requests.program.prepared-by'), value: side ? t(`requests.program.side.${side}`) : dash },
    { key: 'version', label: t('requests.program.version'), value: meta.version > 0 ? String(meta.version) : dash },
  ]
  return (
    <SectionCard title={t('requests.card.facts')}>
      <dl className="space-y-3">
        {rows.map((row) => (
          <FactRow key={row.key} label={row.label} value={row.value} />
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
              <p className="flex flex-wrap items-center gap-x-1.5 text-muted-foreground">
                <StatusMark value={event.previousStatus} dash={dash} />
                <span aria-hidden>→</span>
                <StatusMark value={event.newStatus} dash={dash} />
              </p>
            ) : null}
            {event.previousApproval && event.nextApproval ? (
              <p className="flex flex-wrap items-center gap-x-1.5 text-muted-foreground">
                <StageMark value={event.previousApproval} dash={dash} />
                <span aria-hidden>→</span>
                <StageMark value={event.nextApproval} dash={dash} />
              </p>
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
