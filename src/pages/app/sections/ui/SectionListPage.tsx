import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { readSectionError, useGetSectionsQuery } from '../../../../entities/section'
import { WorkspaceStatus } from '../../../../features/org-project-selector'
import { useHasOrganizationGrant, useOrganizationAccessReady, useWorkspaceSection } from '../../../../features/org-project-selector/model/useWorkspaceSection'
import { useWorkspaceHref } from '../../../../features/org-project-selector/model/useEnsureOrgProjectParams'
import { routes } from '../../../../shared/lib/routes'
import { Button } from '../../../../shared/ui/button'
import { SectionsBoundary } from './SectionsBoundary'

export function SectionListPage() {
  return (
    <SectionsBoundary>
      <ListGate />
    </SectionsBoundary>
  )
}

function ListGate() {
  const { t } = useTranslation()
  const href = useWorkspaceHref()
  const section = useWorkspaceSection('organization')
  const organizationId = section.kind === 'ready' ? section.organizationId : null
  const accessReady = useOrganizationAccessReady(organizationId)
  const canCreate = useHasOrganizationGrant('sections', 'create', organizationId)
  const canUpdate = useHasOrganizationGrant('sections', 'update', organizationId)
  const list = useGetSectionsQuery({ organizationId: organizationId ?? 0 }, { skip: organizationId == null || (!canCreate && !canUpdate) })
  if (section.kind !== 'ready' || organizationId == null) {
    return (
      <WorkspaceStatus
        status={section.kind === 'ready' ? 'loading' : section.status}
        reason={section.kind === 'ready' ? null : section.reason}
        onRetry={section.kind === 'ready' ? undefined : section.refetch}
      />
    )
  }
  if (!accessReady) return <WorkspaceStatus status="loading" reason={null} />
  if (!canCreate && !canUpdate) return <WorkspaceStatus status="forbidden" reason="missing-permission" />
  return (
    <div className="mx-auto flex min-w-0 max-w-5xl flex-col gap-4 p-4 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{t('nav.sections')}</h2>
        {canCreate ? <Button asChild><Link to={href(routes.settings.sectionNew(), 'organization')}>{t('sections.create')}</Link></Button> : null}
      </div>
      {list.isLoading ? <p className="text-sm text-muted-foreground">{t('sections.loading')}</p> : null}
      {list.isError ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{t(`sections.errors.${readSectionError(list.error).code ?? 'generic'}`, { defaultValue: t('sections.errors.generic') })}</p>
          <Button type="button" variant="outline" onClick={() => void list.refetch()}>{t('sections.retry')}</Button>
        </div>
      ) : null}
      {list.data && list.data.sections.length === 0 ? <p className="text-sm text-muted-foreground">{t('sections.empty')}</p> : null}
      <div className="flex min-w-0 flex-col gap-2">
        {list.currentData?.sections.map((item) => (
          <article key={item.id} className="min-w-0 rounded-xl border border-border bg-card p-4">
            <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
              <h3 className="min-w-0 font-medium break-words">{item.title}</h3>
              <span className="text-sm text-muted-foreground">{t(`sections.status.${item.status}`)}</span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{item.organizationName}</p>
            <p className="mt-1 text-sm break-words">{t('sections.form')}: {item.formTitle ?? t('sections.resource-hidden')}</p>
            <p className="text-sm break-words">{t('sections.view')}: {item.viewTitle ?? t('sections.resource-hidden')}</p>
            {canUpdate ? <Link className="mt-2 inline-block text-sm text-primary underline-offset-4 hover:underline" to={href(routes.settings.section(item.id), 'organization')}>{t('sections.open')}</Link> : null}
          </article>
        ))}
      </div>
    </div>
  )
}
