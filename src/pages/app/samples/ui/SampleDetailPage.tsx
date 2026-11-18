import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import {
  displaySampleInterval,
  displaySampleStage,
  displayWell,
  sampleTypeOf,
  useGetSampleDocumentsQuery,
  useGetSampleHistoryQuery,
  useGetSampleQuery,
  useGetSamplesQuery,
  type Sample,
} from '../../../../entities/sample'
import { WorkspaceStatus } from '../../../../features/org-project-selector'
import { useWorkspaceHref } from '../../../../features/org-project-selector/model/useEnsureOrgProjectParams'
import { useHasOrganizationGrant, useWorkspaceSection } from '../../../../features/org-project-selector/model/useWorkspaceSection'
import { routes } from '../../../../shared/lib/routes'
import { Button } from '../../../../shared/ui/button'
import { Card } from '../../../../shared/ui/card'
import { PageHeader, PageState, WorkPage } from '../../../../shared/ui/page'
import { sampleDay, sampleQueryStatus } from '../model/display'
import { sampleTypeMessageKey } from '../model/labels'
import { registrationParentHref } from '../model/registration'
import { SampleInspectionBadge, SampleStatusBadge } from './SampleBadges'
import { SampleDocuments } from './SampleDocuments'
import { SampleEditForm } from './SampleEditForm'
import { SampleHistory } from './SampleHistory'
import { SamplesBoundary } from './SamplesBoundary'

export function SampleDetailPage() {
  return (
    <SamplesBoundary>
      <SampleScreen />
    </SamplesBoundary>
  )
}

function SampleScreen() {
  const { sampleId = '' } = useParams()
  const section = useWorkspaceSection('organization', { resource: 'requests', action: 'read' })
  if (!sampleId) return <MissingSample />
  if (section.kind !== 'ready') {
    return <WorkspaceStatus status={section.status} reason={section.reason} onRetry={section.refetch} />
  }
  return <SampleDesk key={`${section.organizationId}:${sampleId}`} organizationId={section.organizationId} sampleId={sampleId} />
}

function SampleDesk({ organizationId, sampleId }: { organizationId: number; sampleId: string }) {
  const { t } = useTranslation()
  const href = useWorkspaceHref()
  const canUpdate = useHasOrganizationGrant('requests', 'update', organizationId)
  const canCreate = useHasOrganizationGrant('requests', 'create', organizationId)
  const sampleQuery = useGetSampleQuery({ organizationId, sampleId })
  const sample = sampleQuery.currentData?.sample
  const readable = Boolean(sample && !sample.deletedAt)
  const historyQuery = useGetSampleHistoryQuery({ organizationId, sampleId }, { skip: !sampleQuery.isSuccess })
  const documentsQuery = useGetSampleDocumentsQuery({ organizationId, sampleId }, { skip: !readable })
  const listQuery = useGetSamplesQuery({ organizationId }, { skip: !readable })
  const listHref = href(routes.samples.list(), 'organization')
  const hrefFor = (id: string) => href(routes.samples.detail(id), 'organization')
  const status = sampleQueryStatus(sampleQuery.error)

  if (sampleQuery.isError && status === 403) return <DeniedSample listHref={listHref} />
  if (sampleQuery.isError && status === 404) return <MissingSample listHref={listHref} />
  if (sampleQuery.isError && !sample) {
    return (
      <WorkPage>
        <BackLink to={listHref} />
        <PageState
          kind="error"
          description={t('samples.load-error')}
          action={<Button type="button" variant="outline" onClick={() => void sampleQuery.refetch()}>{t('samples.retry')}</Button>}
        />
      </WorkPage>
    )
  }
  if (!sample) {
    return (
      <WorkPage>
        <PageState kind="loading" description={t('samples.card-loading')} />
      </WorkPage>
    )
  }
  if (sample.deletedAt) {
    return (
      <WorkPage width="form">
        <BackLink to={listHref} />
        <PageHeader title={t('samples.deleted-title', { code: sample.code })} description={t('samples.deleted')} />
        <Card className="shadow-sm">
          <SampleHistory
            events={historyQuery.currentData?.events ?? []}
            loading={!historyQuery.currentData && !historyQuery.isError}
            failed={historyQuery.isError && !historyQuery.currentData}
          />
        </Card>
      </WorkPage>
    )
  }

  const samples = (listQuery.currentData?.samples ?? []).filter((item) => !item.deletedAt)
  const parent = sample.parentId ? samples.find((item) => item.id === sample.parentId) : undefined
  const children = samples.filter((item) => item.parentId === sample.id).sort((left, right) => left.code.localeCompare(right.code, 'ru', { numeric: true }))
  const interval = displaySampleInterval(sample)

  return (
    <WorkPage>
      <PageHeader
        breadcrumbs={[{ label: t('samples.page-title'), to: listHref }, { label: sample.code }]}
        title={t('samples.card-title', { code: sample.code })}
        description={t('samples.card-lead')}
      />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]">
        <div className="order-2 min-w-0 space-y-4 lg:order-1">
          <Card className="min-w-0 overflow-hidden p-4 shadow-sm sm:p-5">
            <h2 className="text-base font-semibold">{t('samples.form.title')}</h2>
            <p className="mt-1 mb-4 text-sm text-muted-foreground">{t('samples.form.lead')}</p>
            <SampleEditForm sample={sample} organizationId={organizationId} canUpdate={canUpdate} />
          </Card>
          <FactCard title={t('samples.receipt.title')}>
            <Facts rows={[
              [t('samples.receipt.supplier'), sample.supplier],
              [t('samples.receipt.document'), sample.document],
              [t('samples.receipt.conditions'), sample.conditions],
              [t('samples.columns.received'), sampleDay(sample.receivedAt, t('samples.dash'))],
            ]} />
          </FactCard>
          <Card className="min-w-0 overflow-hidden shadow-sm">
            <section aria-labelledby="sample-relations-title">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
                <h2 id="sample-relations-title" className="text-base font-semibold">{t('samples.relations.title')}</h2>
                {canCreate && displaySampleStage(sample.stage) !== 'Утилизирована' ? (
                  <Button type="button" variant="outline" size="sm" asChild>
                    <Link to={registrationParentHref(href(routes.samples.register(), 'organization'), sample.id)}>
                      <Plus aria-hidden />
                      {t('samples.relations.create')}
                    </Link>
                  </Button>
                ) : null}
              </div>
              <div className="space-y-4 px-5 py-4 text-sm sm:px-6">
                <div>
                  <p className="text-xs text-muted-foreground">{t('samples.relations.parent')}</p>
                  {parent ? (
                    <Link className="mt-1 inline-block font-medium text-primary underline-offset-4 hover:underline" to={hrefFor(parent.id)}>{parent.code}</Link>
                  ) : (
                    <p className="mt-1 text-muted-foreground">{sample.parentId ? t('samples.relations.parent-missing') : t('samples.relations.independent')}</p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t('samples.relations.children', { total: children.length })}</p>
                  {listQuery.isError ? <p className="mt-1 text-destructive" role="alert">{t('samples.relations.error')}</p> : null}
                  {!listQuery.currentData && !listQuery.isError ? <p className="mt-1 text-muted-foreground">{t('samples.loading')}</p> : null}
                  {listQuery.currentData && children.length === 0 ? <p className="mt-1 text-muted-foreground">{t('samples.relations.none')}</p> : null}
                  {children.length > 0 ? (
                    <ul className="mt-2 divide-y divide-border">
                      {children.map((child) => (
                        <li key={child.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                          <Link className="font-medium text-primary underline-offset-4 hover:underline" to={hrefFor(child.id)}>{child.code}</Link>
                          <span className="flex items-center gap-2 text-xs text-muted-foreground">
                            {typeLabel(t, child)}
                            <SampleStatusBadge value={displaySampleStage(child.stage)} />
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>
            </section>
          </Card>
          <Card className="min-w-0 overflow-hidden shadow-sm">
            <SampleDocuments
              organizationId={organizationId}
              sampleId={sample.id}
              documents={documentsQuery.currentData?.documents ?? []}
              loading={!documentsQuery.currentData && !documentsQuery.isError}
              failed={documentsQuery.isError && !documentsQuery.currentData}
              samples={samples}
              hrefFor={hrefFor}
            />
          </Card>
        </div>
        <div className="order-1 min-w-0 space-y-4 lg:order-2">
          <FactCard title={t('samples.summary.title')}>
            <div className="mb-3 flex flex-wrap gap-2">
              <SampleStatusBadge value={displaySampleStage(sample.stage)} />
              <SampleInspectionBadge value={sample.inspection} />
            </div>
            <Facts rows={factList([
              fact(t('samples.columns.type'), typeLabel(t, sample)),
              sample.externalCode && sample.externalCode.trim() ? fact(t('samples.summary.external'), sample.externalCode) : false,
              sample.material.trim() ? fact(t('samples.summary.material'), sample.material) : false,
            ])} />
          </FactCard>
          <FactCard title={t('samples.origin.title')}>
            <Facts rows={factList([
              fact(t('samples.columns.field'), sample.field),
              fact(t('samples.columns.well'), displayWell(sample.well)),
              fact(t('samples.columns.formation'), sample.formation),
              fact(sample.parentId ? t('samples.origin.parent-interval') : t('samples.columns.interval'), sample.interval),
              sample.parentId && sample.subsampleInterval?.trim() ? fact(t('samples.origin.own-interval'), sample.subsampleInterval) : false,
              fact(t('samples.columns.collected'), sampleDay(sample.collectedAt, t('samples.dash'))),
            ])} />
            {interval.inherited ? <p className="mt-3 text-xs text-muted-foreground">{t('samples.interval.inherited-note')}</p> : null}
          </FactCard>
          <FactCard title={t('samples.container.title')}>
            <Facts rows={[
              [t('samples.container.kind'), sample.container],
              [t('samples.container.quantity'), sample.quantity],
            ]} />
          </FactCard>
          <Card className="shadow-sm">
            <SampleHistory
              events={historyQuery.currentData?.events ?? []}
              loading={!historyQuery.currentData && !historyQuery.isError}
              failed={historyQuery.isError && !historyQuery.currentData}
            />
          </Card>
        </div>
      </div>
    </WorkPage>
  )
}

function FactCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="shadow-sm">
      <div className="border-b border-border px-4 py-4 md:px-6">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
      </div>
      <div className="px-4 py-4 text-sm md:px-6">{children}</div>
    </Card>
  )
}

function fact(label: string, value: string): readonly [string, string] {
  return [label, value]
}

function factList(rows: ReadonlyArray<readonly [string, string] | false>): ReadonlyArray<readonly [string, string]> {
  return rows.filter((row): row is readonly [string, string] => row !== false)
}

function Facts({ rows }: { rows: ReadonlyArray<readonly [string, string]> }) {
  const { t } = useTranslation()
  const dash = t('samples.dash')
  return (
    <dl className="space-y-2.5">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-baseline justify-between gap-4">
          <dt className="min-w-0 text-muted-foreground">{label}</dt>
          <dd className="max-w-[60%] min-w-0 break-words text-right">{value.trim() ? value : dash}</dd>
        </div>
      ))}
    </dl>
  )
}

function typeLabel(t: (key: string) => string, sample: Sample): string {
  const type = sampleTypeOf(sample)
  const key = sampleTypeMessageKey(type)
  return key ? t(key) : type
}

function BackLink({ to }: { to: string }) {
  const { t } = useTranslation()
  return <Link className="text-sm text-primary underline-offset-4 hover:underline" to={to}>{t('samples.back')}</Link>
}

function MissingSample({ listHref }: { listHref?: string }) {
  const { t } = useTranslation()
  const href = useWorkspaceHref()
  const to = listHref ?? href(routes.samples.list(), 'organization')
  return (
    <WorkPage width="form">
      <BackLink to={to} />
      <PageHeader title={t('samples.not-found-title')} description={t('samples.not-found')} />
    </WorkPage>
  )
}

function DeniedSample({ listHref }: { listHref: string }) {
  const { t } = useTranslation()
  return (
    <WorkPage width="form">
      <BackLink to={listHref} />
      <h1 className="text-lg font-semibold">{t('samples.forbidden-title')}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t('samples.forbidden')}</p>
    </WorkPage>
  )
}
