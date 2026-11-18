import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useGetSessionAccessQuery } from '../../../../entities/access'
import { readTableError, useDeleteTableViewMutation, useGetTableViewsQuery } from '../../../../entities/table-view'
import { useGetFormsQuery } from '../../../../entities/form'
import { WorkspaceStatus } from '../../../../features/org-project-selector'
import { useHasOrganizationGrant, useWorkspaceSection } from '../../../../features/org-project-selector/model/useWorkspaceSection'
import { useWorkspaceHref } from '../../../../features/org-project-selector/model/useEnsureOrgProjectParams'
import { routes } from '../../../../shared/lib/routes'
import { Button } from '../../../../shared/ui/button'
import { PageHeader, PageState, WorkPage } from '../../../../shared/ui/page'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../../../shared/ui/dialog'
import { FormsBoundary } from './FormsBoundary'

export function FormViewsPage() {
  return (
    <FormsBoundary>
      <ViewsGate />
    </FormsBoundary>
  )
}

function ViewsGate() {
  const { t, i18n } = useTranslation()
  const { formId = '' } = useParams()
  const href = useWorkspaceHref()
  const section = useWorkspaceSection('organization', { resource: 'forms', action: 'read' })
  const organizationId = section.kind === 'ready' ? section.organizationId : null
  const canViews = useHasOrganizationGrant('table-views', 'read', organizationId)
  const canCreate = useHasOrganizationGrant('table-views', 'create', organizationId)
  const canUpdate = useHasOrganizationGrant('table-views', 'update', organizationId)
  const canDelete = useHasOrganizationGrant('table-views', 'delete', organizationId)
  const canRecords = useHasOrganizationGrant('form-records', 'read', organizationId)
  const access = useGetSessionAccessQuery(undefined, { skip: organizationId == null })
  const grantsReady = access.isSuccess && access.data?.accessState === 'ready'
  const forms = useGetFormsQuery({ organizationId: organizationId ?? 0 }, { skip: organizationId == null || !canViews })
  const views = useGetTableViewsQuery(
    { organizationId: organizationId ?? 0, formId },
    { skip: organizationId == null || !canViews || formId === '' },
  )
  const [remove, removeState] = useDeleteTableViewMutation()
  const [pendingId, setPendingId] = useState<string | null>(null)
  if (section.kind !== 'ready' || organizationId == null) {
    return (
      <WorkspaceStatus
        status={section.kind === 'ready' ? 'loading' : section.status}
        reason={section.kind === 'ready' ? null : section.reason}
        onRetry={section.kind === 'ready' ? undefined : section.refetch}
      />
    )
  }
  if (!grantsReady) return <WorkspaceStatus status="loading" reason={null} />
  if (!canViews) {
    return <WorkspaceStatus status="forbidden" reason="missing-permission" />
  }
  const formTitle = forms.data?.forms.find((form) => form.id === formId)?.title ?? ''
  const confirm = async () => {
    if (pendingId == null) return
    try {
      await remove({ organizationId, formId, viewId: pendingId }).unwrap()
      setPendingId(null)
    } catch (error) {
      const parsed = readTableError(error)
      toast.error(t(`tableViews.errors.${parsed.code ?? 'generic'}`, { defaultValue: t('tableViews.errors.generic') }))
    }
  }
  return (
    <WorkPage>
      <PageHeader
        title={t('tableViews.title')}
        description={formTitle ? `${t('tableViews.form')}: ${formTitle}` : t('nav.forms-description')}
        breadcrumbs={[{ label: t('nav.forms'), to: href(routes.forms.list(), 'organization') }, { label: t('tableViews.title') }]}
        actions={canCreate && canRecords ? (
          <Button asChild>
            <Link to={href(routes.forms.viewCreate(formId), 'organization')}>{t('tableViews.create')}</Link>
          </Button>
        ) : undefined}
      />
      {views.isLoading ? <PageState kind="loading" description={t('tableViews.loading')} /> : null}
      {views.isError ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{t('tableViews.errors.generic')}</p>
          <Button type="button" variant="outline" onClick={() => void views.refetch()}>{t('tableViews.retry')}</Button>
        </div>
      ) : null}
      {views.data && views.data.views.length === 0 ? <PageState kind="empty" description={t('tableViews.empty')} /> : null}
      {views.data && views.data.views.length > 0 ? (
        <div className="min-w-0 max-w-full overflow-x-auto">
          <table className="w-full min-w-[36rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-2 py-2 font-medium">{t('tableViews.name')}</th>
                <th className="px-2 py-2 font-medium">{t('tableViews.form')}</th>
                <th className="px-2 py-2 font-medium">{t('tableViews.updated')}</th>
                <th className="px-2 py-2 font-medium">{t('tableViews.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {views.data.views.map((view) => (
                <tr key={view.id} className="border-b border-border">
                  <td className="px-2 py-2">{view.title}</td>
                  <td className="px-2 py-2">{formTitle}</td>
                  <td className="px-2 py-2">{new Date(view.updatedAt).toLocaleString(i18n.language)}</td>
                  <td className="px-2 py-2">
                    <div className="flex flex-wrap gap-2">
                      {canRecords ? <Link className="text-primary underline-offset-4 hover:underline" to={href(routes.forms.view(formId, view.id), 'organization')}>{t('tableViews.open-view')}</Link> : null}
                      {canUpdate && canRecords ? <Link className="text-primary underline-offset-4 hover:underline" to={href(routes.forms.viewEdit(formId, view.id), 'organization')}>{t('tableViews.edit')}</Link> : null}
                      {canDelete ? <button type="button" className="text-primary underline-offset-4 hover:underline" onClick={() => setPendingId(view.id)}>{t('tableViews.delete')}</button> : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <Dialog open={pendingId != null} onOpenChange={(open) => { if (!open) setPendingId(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('tableViews.delete-title')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t('tableViews.delete-body')}</p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPendingId(null)}>{t('tableViews.cancel')}</Button>
            <Button type="button" disabled={removeState.isLoading} onClick={() => void confirm()}>{t('tableViews.delete-confirm')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </WorkPage>
  )
}
