import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { ClipboardList, Info, MoreHorizontal, Pencil, Plus, Table2 } from 'lucide-react'
import { toast } from 'sonner'
import { readFormError, useCreateFormMutation, useGetFormsQuery, type FormListItem, type FormStatus } from '../../../../entities/form'
import { useGetOrganizationsQuery } from '../../../../entities/organization/model/organizationSlice'
import { WorkspaceStatus } from '../../../../features/org-project-selector'
import { useHasOrganizationGrant, useWorkspaceSection } from '../../../../features/org-project-selector/model/useWorkspaceSection'
import { useWorkspaceHref } from '../../../../features/org-project-selector/model/useEnsureOrgProjectParams'
import { routes } from '../../../../shared/lib/routes'
import { cn } from '../../../../shared/lib/utils'
import { Button } from '../../../../shared/ui/button'
import { PageHeader, PageState, WorkPage } from '../../../../shared/ui/page'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../../../shared/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../../../../shared/ui/dropdown-menu'
import { Input } from '../../../../shared/ui/input'
import { Label } from '../../../../shared/ui/label'
import { Textarea } from '../../../../shared/ui/textarea'
import { formListActions, type FormListAction, type FormListActionKind } from '../model/list-actions'
import { FormsBoundary } from './FormsBoundary'

const ACTION_LABEL: Record<FormListActionKind, string> = {
  configure: 'forms.configure',
  fill: 'forms.open-fill',
  records: 'forms.view-records',
  tables: 'forms.open-tables',
}

const STATUS_TONE: Record<FormStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  published: 'bg-[color-mix(in_srgb,var(--success)_16%,transparent)] text-[color-mix(in_srgb,var(--success)_78%,var(--foreground))]',
  'published-dirty': 'bg-[color-mix(in_srgb,var(--warning)_22%,transparent)] text-[color-mix(in_srgb,var(--warning)_62%,var(--foreground))]',
}

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
  const organizationName = organizations.data?.find((item) => item.id === organizationId)?.shortName
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
  const rows = forms.data?.forms.map((form) => ({
    form,
    version: form.publishedVersionNumber == null ? t('forms.unpublished') : String(form.publishedVersionNumber),
    actions: formListActions({
      canUpdate,
      canRecords,
      canViews,
      published: Boolean(form.publishedVersionId),
      hrefs: {
        configure: href(routes.forms.editor(form.id), 'organization'),
        fill: href(routes.forms.fill(form.id), 'organization'),
        records: href(routes.forms.records(form.id), 'organization'),
        tables: href(routes.forms.views(form.id), 'organization'),
      },
    }),
  })) ?? []
  return (
    <WorkPage>
      <PageHeader
        title={t('forms.list-title')}
        description={t('forms.list-lead')}
        actions={organizationName || canCreate ? (
          <>
            {organizationName ? <p className="text-sm text-muted-foreground">{organizationName}</p> : null}
            {canCreate ? (
              <Button type="button" onClick={() => setOpen(true)}>
                <Plus aria-hidden />
                {t('forms.create')}
              </Button>
            ) : null}
          </>
        ) : undefined}
      />
      {forms.isLoading ? <PageState kind="loading" description={t('forms.loading')} /> : null}
      {forms.isError ? <PageState kind="error" description={t('forms.errors.generic')} /> : null}
      {forms.data && forms.data.forms.length === 0 ? <PageState kind="empty" description={t('forms.list-empty')} /> : null}
      {rows.length > 0 ? (
        <>
          <div className="flex flex-col gap-3 md:hidden">
            {rows.map((row) => (
              <article key={row.form.id} className="rounded-xl border border-border bg-card p-4">
                <FormIdentity form={row.form} href={row.actions.primary?.href ?? null} />
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <FormStatusBadge status={row.form.status} />
                  <span className="text-sm text-muted-foreground">{row.version}</span>
                </div>
                <div className="mt-4">
                  <FormRowActions form={row.form} primary={row.actions.primary} menu={row.actions.menu} />
                </div>
              </article>
            ))}
            <p className="flex items-start gap-2 text-sm text-muted-foreground">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
              {t('forms.list-note')}
            </p>
          </div>
          <div className="hidden overflow-hidden rounded-xl border border-border bg-card md:block">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th scope="col" className="px-4 py-3 font-medium">{t('forms.column-form')}</th>
                  <th scope="col" className="px-4 py-3 font-medium">{t('forms.column-status')}</th>
                  <th scope="col" className="px-4 py-3 font-medium">{t('forms.column-published-version')}</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">{t('forms.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.form.id} className="border-b border-border last:border-b-0">
                    <td className="px-4 py-3 align-top">
                      <FormIdentity form={row.form} href={row.actions.primary?.href ?? null} />
                    </td>
                    <td className="px-4 py-3 align-top">
                      <FormStatusBadge status={row.form.status} />
                    </td>
                    <td className="px-4 py-3 align-top text-foreground">{row.version}</td>
                    <td className="px-4 py-3 align-top">
                      <FormRowActions form={row.form} primary={row.actions.primary} menu={row.actions.menu} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="flex items-start gap-2 border-t border-border px-4 py-3 text-sm text-muted-foreground">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
              {t('forms.list-note')}
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <LegendCard title={t('forms.list-status.draft')} tone="draft" body={t('forms.legend-draft')} />
            <LegendCard title={t('forms.column-published-version')} tone="published" body={t('forms.legend-published')} />
          </div>
        </>
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
    </WorkPage>
  )
}

function FormIdentity({ form, href }: { form: FormListItem; href: string | null }) {
  const titleClass = 'break-words text-base font-medium text-foreground'
  return (
    <div className="min-w-0">
      {href ? (
        <Link className={cn(titleClass, 'underline-offset-4 hover:underline')} to={href}>{form.title}</Link>
      ) : (
        <p className={titleClass}>{form.title}</p>
      )}
      {form.description.trim() ? <p className="mt-1 break-words whitespace-pre-wrap text-sm text-muted-foreground">{form.description}</p> : null}
    </div>
  )
}

function FormStatusBadge({ status }: { status: FormStatus }) {
  const { t } = useTranslation()
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium', STATUS_TONE[status])}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {t(`forms.list-status.${status}`)}
    </span>
  )
}

function FormRowActions({
  form,
  primary,
  menu,
}: {
  form: FormListItem
  primary: FormListAction | null
  menu: FormListAction[]
}) {
  const { t } = useTranslation()
  if (!primary && menu.length === 0) return null
  return (
    <div className="flex flex-wrap items-center justify-start gap-2 md:justify-end">
      {primary ? (
        <Button asChild variant="outline" size="sm">
          <Link to={primary.href}>{t(ACTION_LABEL[primary.kind])}</Link>
        </Button>
      ) : null}
      {menu.length > 0 ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="icon" className="size-8" aria-label={t('forms.more-actions', { title: form.title })}>
              <MoreHorizontal aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-52">
            {menu.map((action) => (
              <DropdownMenuItem key={action.kind} asChild>
                <Link to={action.href}>
                  <ActionIcon kind={action.kind} />
                  {t(ACTION_LABEL[action.kind])}
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  )
}

function ActionIcon({ kind }: { kind: FormListActionKind }) {
  if (kind === 'records') return <ClipboardList aria-hidden />
  if (kind === 'tables') return <Table2 aria-hidden />
  return <Pencil aria-hidden />
}

function LegendCard({ title, tone, body }: { title: string; tone: FormStatus; body: string }) {
  return (
    <article className="rounded-xl border border-border bg-card p-4">
      <h2 className="flex items-center gap-2 text-sm font-medium text-foreground">
        <span className={cn('size-2 rounded-full', tone === 'published' ? 'bg-[var(--success)]' : 'bg-muted-foreground')} aria-hidden />
        {title}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
    </article>
  )
}
