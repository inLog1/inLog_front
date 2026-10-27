import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { readFormError, useCreateFormMutation, useGetFormsQuery } from '../../../../entities/form'
import { useGetOrganizationsQuery } from '../../../../entities/organization/model/organizationSlice'
import { WorkspaceStatus } from '../../../../features/org-project-selector'
import { useHasOrganizationGrant, useWorkspaceSection } from '../../../../features/org-project-selector/model/useWorkspaceSection'
import { useWorkspaceHref } from '../../../../features/org-project-selector/model/useEnsureOrgProjectParams'
import { routes } from '../../../../shared/lib/routes'
import { Button } from '../../../../shared/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../../../shared/ui/dialog'
import { Input } from '../../../../shared/ui/input'
import { Label } from '../../../../shared/ui/label'
import { Textarea } from '../../../../shared/ui/textarea'
import { FormsBoundary } from './FormsBoundary'

export function FormsPage() {
  return (
    <FormsBoundary>
      <FormsList />
    </FormsBoundary>
  )
}

function FormsList() {
  const { t } = useTranslation()
  const section = useWorkspaceSection('organization', { resource: 'forms', action: 'read' })
  const organizationId = section.kind === 'ready' ? section.organizationId : null
  const canCreate = useHasOrganizationGrant('forms', 'create', organizationId)
  const canUpdate = useHasOrganizationGrant('forms', 'update', organizationId)
  const canRecords = useHasOrganizationGrant('form-records', 'read', organizationId)
  const canViews = useHasOrganizationGrant('table-views', 'read', organizationId)
  const href = useWorkspaceHref()
  const navigate = useNavigate()
  const organizations = useGetOrganizationsQuery(undefined, { skip: organizationId == null })
  const forms = useGetFormsQuery({ organizationId: organizationId ?? 0 }, { skip: organizationId == null })
  const [createForm, createState] = useCreateFormMutation()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  if (section.kind !== 'ready' || organizationId == null) {
    return (
      <WorkspaceStatus
        status={section.kind === 'ready' ? 'loading' : section.status}
        reason={section.kind === 'ready' ? null : section.reason}
        onRetry={section.refetch}
      />
    )
  }
  const organizationName = organizations.data?.find((item) => item.id === organizationId)?.shortName ?? String(organizationId)
  const submit = async () => {
    try {
      const created = await createForm({ organizationId, title, description }).unwrap()
      setOpen(false)
      setTitle('')
      setDescription('')
      navigate(href(routes.forms.editor(created.id), 'organization'))
    } catch (error) {
      const parsed = readFormError(error)
      toast.error(t(`forms.errors.${parsed.code ?? 'generic'}`, { defaultValue: t('forms.errors.generic') }))
    }
  }
  return (
    <div className="mx-auto flex min-w-0 max-w-5xl flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{t('nav.forms')}</h2>
        {canCreate ? <Button type="button" onClick={() => setOpen(true)}>{t('forms.create')}</Button> : null}
      </div>
      {forms.isLoading ? <p className="text-sm text-muted-foreground">{t('forms.loading')}</p> : null}
      {forms.isError ? <p className="text-sm text-muted-foreground">{t('forms.errors.generic')}</p> : null}
      {forms.data && forms.data.forms.length === 0 ? <p className="text-sm text-muted-foreground">{t('forms.list-empty')}</p> : null}
      {forms.data && forms.data.forms.length > 0 ? (
        <div className="min-w-0 overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-2 py-2 font-medium">{t('forms.name')}</th>
                <th className="px-2 py-2 font-medium">{t('forms.organization')}</th>
                <th className="px-2 py-2 font-medium">{t('forms.column-status')}</th>
                <th className="px-2 py-2 font-medium">{t('forms.column-version')}</th>
                <th className="px-2 py-2 font-medium">{t('forms.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {forms.data.forms.map((form) => (
                <tr key={form.id} className="border-b border-border">
                  <td className="px-2 py-2">{form.title}</td>
                  <td className="px-2 py-2">{organizationName}</td>
                  <td className="px-2 py-2">{t(`forms.status.${form.status}`)}</td>
                  <td className="px-2 py-2">{form.publishedVersionNumber == null ? t('forms.no-version') : t('forms.version', { number: form.publishedVersionNumber })}</td>
                  <td className="px-2 py-2">
                    <div className="flex flex-wrap gap-2">
                      {canUpdate ? <Link className="text-primary underline-offset-4 hover:underline" to={href(routes.forms.editor(form.id), 'organization')}>{t('forms.edit')}</Link> : null}
                      {form.publishedVersionId ? <Link className="text-primary underline-offset-4 hover:underline" to={href(routes.forms.fill(form.id), 'organization')}>{t('forms.fill')}</Link> : null}
                      {canRecords ? <Link className="text-primary underline-offset-4 hover:underline" to={href(routes.forms.records(form.id), 'organization')}>{t('forms.records')}</Link> : null}
                      {canViews ? <Link className="text-primary underline-offset-4 hover:underline" to={href(routes.forms.views(form.id), 'organization')}>{t('tableViews.link')}</Link> : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('forms.create-title')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="new-form-title">{t('forms.name')}</Label>
              <Input id="new-form-title" value={title} onChange={(event) => setTitle(event.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="new-form-description">{t('forms.description')}</Label>
              <Textarea id="new-form-description" value={description} onChange={(event) => setDescription(event.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" disabled={createState.isLoading} onClick={() => void submit()}>{t('forms.create-submit')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
