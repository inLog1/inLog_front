import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft } from 'lucide-react'
import { useGetOrganizationsQuery } from '../../../../entities/organization/model/organizationSlice'
import {
  draftFromRecord,
  emptyRequestDraft,
  inspectRequestDraft,
  useCreateRequestMutation,
  useGetExecutorLaboratoriesQuery,
  useGetRequestCatalogQuery,
  useGetRequestQuery,
  useUpdateRequestMutation,
  type DraftIssue,
  type RequestCatalog,
  type RequestDraftCatalogIds,
  type RequestListItem,
} from '../../../../entities/request'
import { WorkspaceStatus } from '../../../../features/org-project-selector'
import { useWorkspaceHref } from '../../../../features/org-project-selector/model/useEnsureOrgProjectParams'
import { useWorkspaceSection } from '../../../../features/org-project-selector/model/useWorkspaceSection'
import { routes } from '../../../../shared/lib/routes'
import { useUnsavedSource } from '../../../../shared/session/unsaved-work'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../../shared/ui/alert-dialog'
import { Button } from '../../../../shared/ui/button'
import { PageHeader, PageState, WorkPage } from '../../../../shared/ui/page'
import { useLeaveGuard } from '../../forms/model/use-leave-guard'
import { requestFailureCode } from '../model/display'
import { RequestWizardForm, WIZARD_STEPS, type WizardValues } from './RequestWizardForm'
import { RequestsBoundary } from './RequestsBoundary'

export function RequestWizardPage({ mode }: { mode: 'create' | 'edit' }) {
  return (
    <RequestsBoundary>
      <WizardGate mode={mode} />
    </RequestsBoundary>
  )
}

function WizardGate({ mode }: { mode: 'create' | 'edit' }) {
  const { t } = useTranslation()
  const { requestId = '' } = useParams()
  const navigate = useNavigate()
  const href = useWorkspaceHref()
  const [search, setSearch] = useSearchParams()
  const section = useWorkspaceSection('organization', {
    resource: 'requests',
    action: mode === 'create' ? 'create' : 'update',
  })
  const readyOrg = section.kind === 'ready' ? section.organizationId : null
  const [lockedOrg, setLockedOrg] = useState<number | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  if (readyOrg != null && lockedOrg == null) setLockedOrg(readyOrg)
  const urlOrg = Number(search.get('org'))
  const switched = lockedOrg != null && Number.isInteger(urlOrg) && urlOrg > 0 && urlOrg !== lockedOrg
  if (switched && !dirty && mode === 'create') setLockedOrg(urlOrg)
  const leave = useLeaveGuard(dirty)
  useUnsavedSource(mode === 'create' ? 'request-wizard:new' : `request-wizard:${requestId}`, dirty)
  const listHref = href(routes.requests.list(), 'organization')
  const saveRef = useRef<(() => Promise<boolean>) | null>(null)

  useEffect(() => {
    if (mode !== 'edit' || !switched || dirty) return
    navigate(listHref, { replace: true })
  }, [dirty, listHref, mode, navigate, switched])

  if (lockedOrg == null || (!switched && section.kind !== 'ready')) {
    return (
      <WorkspaceStatus
        status={section.kind === 'ready' ? 'loading' : section.status}
        reason={section.kind === 'ready' ? null : section.reason}
        onRetry={section.kind === 'ready' ? undefined : section.refetch}
      />
    )
  }

  const restore = () => {
    setSearch((prev) => {
      const next = new URLSearchParams(prev)
      next.set('org', String(lockedOrg))
      return next
    }, { replace: true })
  }
  const discardOrg = () => {
    setDirty(false)
    if (mode === 'edit') navigate(listHref)
    else setLockedOrg(urlOrg)
  }
  const saveThen = async (after: () => void) => {
    if (saving) return
    setSaving(true)
    const saved = await saveRef.current?.() ?? false
    setSaving(false)
    if (!saved) {
      leave.dismiss()
      return
    }
    setDirty(false)
    after()
  }

  return (
    <>
      <WizardDesk
        key={`${mode}:${lockedOrg}:${requestId}`}
        mode={mode}
        organizationId={lockedOrg}
        requestId={requestId}
        listHref={listHref}
        saveRef={saveRef}
        onDirty={setDirty}
      />
      <AlertDialog open={leave.nextUrl != null}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('requests.wizard.leave-title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('requests.wizard.leave-body')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button type="button" variant="outline" onClick={() => leave.dismiss()}>{t('requests.wizard.leave-stay')}</Button>
            <Button type="button" variant="outline" onClick={() => {
              const next = leave.nextUrl
              setDirty(false)
              leave.dismiss()
              if (next) navigate(next)
            }}>{t('requests.wizard.leave-discard')}</Button>
            <Button type="button" disabled={saving} onClick={() => void saveThen(() => {
              const next = leave.nextUrl
              leave.dismiss()
              if (next) navigate(next)
            })}>{t('requests.wizard.leave-save')}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={switched && dirty && leave.nextUrl == null}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('requests.wizard.org-title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('requests.wizard.org-body')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button type="button" variant="outline" onClick={restore}>{t('requests.wizard.leave-stay')}</Button>
            <Button type="button" variant="outline" onClick={discardOrg}>{t('requests.wizard.leave-discard')}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function WizardDesk({
  mode,
  organizationId,
  requestId,
  listHref,
  saveRef,
  onDirty,
}: {
  mode: 'create' | 'edit'
  organizationId: number
  requestId: string
  listHref: string
  saveRef: { current: (() => Promise<boolean>) | null }
  onDirty: (dirty: boolean) => void
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const href = useWorkspaceHref()
  const organizations = useGetOrganizationsQuery()
  const catalogQuery = useGetRequestCatalogQuery({ organizationId })
  const requestQuery = useGetRequestQuery(
    { organizationId, requestId },
    { skip: mode !== 'edit' || requestId === '' },
  )
  const catalog = catalogQuery.currentData
  const kind = catalog?.organizationKind
  const laboratories = useGetExecutorLaboratoriesQuery(
    { organizationId },
    { skip: kind !== 'customer' },
  )
  const [createRequest] = useCreateRequestMutation()
  const [updateRequest] = useUpdateRequestMutation()
  const initial = emptyWizardValues()
  const [values, setValues] = useState(initial)
  const [baseline, setBaseline] = useState(() => wizardSignature(initial))
  const [step, setStep] = useState(0)
  const [applied, setApplied] = useState(mode === 'create')
  const [saveAttempted, setSaveAttempted] = useState(false)
  const [saving, setSaving] = useState(false)
  const request = requestQuery.currentData?.request
  if (mode === 'edit' && request?.status === 'draft' && !applied) {
    const next = wizardValuesFrom(request)
    setApplied(true)
    setValues(next)
    setBaseline(wizardSignature(next))
  }
  const dirty = wizardSignature(values) !== baseline
  const ids = catalog ? catalogIdsOf(catalog) : null
  const inspected = ids ? inspectRequestDraft(values.details, ids) : { ok: true as const, issues: [] as DraftIssue[] }
  const issues = inspected.ok ? [] : inspected.issues
  const labs = laboratories.currentData?.laboratories ?? []
  const executorId = kind === 'laboratory' ? organizationId : values.executorOrganizationId
  const executorReady = kind === 'laboratory' || (
    executorId != null
    && (laboratories.isLoading || laboratories.isUninitialized || labs.some((item) => item.id === executorId))
  )
  const partyIssue = saveAttempted && kind === 'customer' && !executorReady

  useEffect(() => {
    onDirty(dirty)
  }, [dirty, onDirty])

  saveRef.current = async () => {
    if (saving || !catalog || !ids) return false
    const parsed = inspectRequestDraft(values.details, ids)
    const chosen = catalog.organizationKind === 'laboratory' ? organizationId : values.executorOrganizationId
    const known = catalog.organizationKind === 'laboratory' || (
      chosen != null && (laboratories.isLoading || laboratories.isUninitialized || labs.some((item) => item.id === chosen))
    )
    if (!parsed.ok || !known || chosen == null) {
      setSaveAttempted(true)
      return false
    }
    if (mode === 'edit' && wizardSignature({ ...values, details: parsed.details, executorOrganizationId: chosen }) === baseline) {
      return true
    }
    setSaving(true)
    try {
      if (mode === 'create') {
        const created = await createRequest({
          organizationId,
          executorOrganizationId: chosen,
          details: parsed.details,
        }).unwrap()
        toast.success(t('requests.created'))
        navigate(href(routes.requests.edit(created.request.id), 'organization'), { replace: true })
        return true
      }
      const current = requestQuery.currentData?.request
      if (!current) return false
      const saved = await updateRequest({
        requestId,
        organizationId,
        expectedRevision: current.revision,
        details: parsed.details,
        ...(catalog.organizationKind === 'customer' && chosen !== current.executorOrganizationId
          ? { executorOrganizationId: chosen }
          : {}),
      }).unwrap()
      const next = wizardValuesFrom(saved.request)
      setValues(next)
      setBaseline(wizardSignature(next))
      setSaveAttempted(false)
      toast.success(t('requests.wizard.saved'))
      return true
    } catch (error) {
      const code = requestFailureCode(error)
      toast.error(t(`requests.errors.${code ?? 'generic'}`, { defaultValue: t('requests.errors.generic') }))
      return false
    } finally {
      setSaving(false)
    }
  }

  if (catalogQuery.isError && !catalog) {
    return (
      <WorkPage>
        <PageHeader title={t('requests.wizard.title-new')} />
        <PageState
          kind="error"
          description={t('requests.load-error')}
          action={<Button type="button" variant="outline" onClick={() => void catalogQuery.refetch()}>{t('requests.retry')}</Button>}
        />
      </WorkPage>
    )
  }
  if (!catalog || (mode === 'edit' && requestQuery.isLoading && !request)) {
    return (
      <WorkPage>
        <PageHeader title={t('requests.wizard.title-new')} description={t('requests.loading')} />
        <PageState kind="loading" description={t('requests.loading')} />
      </WorkPage>
    )
  }
  if (mode === 'edit' && requestQuery.isError && !request) {
    const code = requestFailureCode(requestQuery.error)
    return (
      <WorkPage>
        <PageHeader title={t('requests.wizard.title-edit', { number: t('requests.dash') })} />
        <PageState
          kind="error"
          description={t(`requests.errors.${code ?? 'generic'}`, { defaultValue: t('requests.errors.generic') })}
          action={<Button type="button" variant="outline" asChild><Link to={listHref}>{t('requests.wizard.back-to-list')}</Link></Button>}
        />
      </WorkPage>
    )
  }
  if (mode === 'edit' && request && request.status !== 'draft') {
    return (
      <WorkPage>
        <PageHeader title={t('requests.wizard.title-edit', { number: request.number })} />
        <PageState
          kind="empty"
          description={t('requests.errors.not_draft')}
          action={<Button type="button" variant="outline" asChild><Link to={listHref}>{t('requests.wizard.back-to-list')}</Link></Button>}
        />
      </WorkPage>
    )
  }
  if (mode === 'edit' && !applied) {
    return (
      <WorkPage>
        <PageHeader title={t('requests.wizard.title-new')} description={t('requests.loading')} />
        <PageState kind="loading" description={t('requests.loading')} />
      </WorkPage>
    )
  }

  const organizationName = organizations.data?.find((item) => item.id === organizationId)?.shortName ?? ''
  const customerName = mode === 'edit' && request ? request.customerShortName : organizationName
  const executorName = mode === 'edit' && request ? request.executorShortName : organizationName
  const stepLabel = t(`requests.wizard.steps.${WIZARD_STEPS[step] ?? 'parties'}`)

  return (
    <WorkPage>
      <div className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-4">
        <PageHeader
          title={mode === 'create' ? t('requests.wizard.title-new') : t('requests.wizard.title-edit', { number: request?.number ?? '' })}
          description={t('requests.wizard.step-caption', { current: step + 1, total: WIZARD_STEPS.length, label: stepLabel })}
          actions={(
            <Button type="button" variant="outline" asChild>
              <Link to={listHref}>
                <ArrowLeft aria-hidden />
                {t('requests.wizard.back-to-list')}
              </Link>
            </Button>
          )}
        />
        <RequestWizardForm
          kind={kind ?? 'customer'}
          customerName={customerName}
          executorName={executorName}
          values={values}
          catalog={catalog}
          laboratories={labs}
          laboratoriesLoading={kind === 'customer' && (laboratories.isLoading || laboratories.isUninitialized)}
          issues={issues}
          partyIssue={partyIssue}
          step={step}
          saving={saving}
          onStep={setStep}
          onChange={setValues}
          onSave={() => void saveRef.current?.()}
        />
      </div>
    </WorkPage>
  )
}

function emptyWizardValues(): WizardValues {
  return { executorOrganizationId: null, details: emptyRequestDraft() }
}

function wizardValuesFrom(request: RequestListItem): WizardValues {
  return {
    executorOrganizationId: request.executorOrganizationId,
    details: draftFromRecord(request),
  }
}

function wizardSignature(values: WizardValues): string {
  return JSON.stringify(values)
}

function catalogIdsOf(catalog: RequestCatalog): RequestDraftCatalogIds {
  return {
    fields: catalog.fields.map((item) => item.id),
    wells: catalog.wells.map((item) => item.id),
    pads: catalog.pads.map((item) => item.id),
    formations: catalog.formations.map((item) => item.id),
    materials: catalog.materials.map((item) => item.id),
    fluidKinds: catalog.fluidKinds.map((item) => item.id),
    wellTypes: catalog.wellTypes.map((item) => item.id),
    sampleKinds: catalog.sampleKinds.map((item) => item.id),
    workKinds: catalog.workKinds.map((item) => item.id),
    units: catalog.units.map((item) => item.id),
    curators: catalog.curators.map((item) => item.id),
    samples: catalog.samples.map((item) => item.id),
  }
}
