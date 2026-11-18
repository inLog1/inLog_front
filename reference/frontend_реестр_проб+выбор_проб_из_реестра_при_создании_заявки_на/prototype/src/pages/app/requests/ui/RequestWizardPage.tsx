import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useGetOrganizationsQuery } from '../../../../entities/organization/model/organizationSlice'
import {
  draftFromRecord,
  emptyRequestDraft,
  inspectRequestDraft,
  inspectRequestForSend,
  useCreateRequestMutation,
  useGetExecutorLaboratoriesQuery,
  useGetRequestCatalogQuery,
  useGetRequestQuery,
  useSendRequestMutation,
  useUpdateRequestMutation,
  useUploadRequestBasisMutation,
  type DraftIssue,
  type SendGap,
  type RequestCatalog,
  type RequestDraftCatalogIds,
  type RequestListItem,
} from '../../../../entities/request'
import { WorkspaceStatus } from '../../../../features/org-project-selector'
import { useWorkspaceHref } from '../../../../features/org-project-selector/model/useEnsureOrgProjectParams'
import { useHasOrganizationGrant, useWorkspaceSection } from '../../../../features/org-project-selector/model/useWorkspaceSection'
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
import { RequestDraftForm, type DraftFormHandle, type WizardValues } from './draft/RequestDraftForm'
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
    { skip: kind == null },
  )
  const [createRequest] = useCreateRequestMutation()
  const [updateRequest] = useUpdateRequestMutation()
  const [sendRequest] = useSendRequestMutation()
  const [uploadBasis] = useUploadRequestBasisMutation()
  const canSend = useHasOrganizationGrant('requests', 'send', organizationId)
  const canUpdate = useHasOrganizationGrant('requests', 'update', organizationId)
  const initial = emptyWizardValues(mode)
  const [values, setValues] = useState(initial)
  const [baseline, setBaseline] = useState(() => wizardSignature(initial))
  const [applied, setApplied] = useState(mode === 'create')
  const formRef = useRef<DraftFormHandle>(null)
  const [saveAttempted, setSaveAttempted] = useState(false)
  const [sendAttempted, setSendAttempted] = useState(false)
  const [sendGaps, setSendGaps] = useState<SendGap[]>([])
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [pendingBasisFile, setPendingBasisFile] = useState<File | null>(null)
  const request = requestQuery.currentData?.request
  const revising = request?.status === 'rework' && request.customerOrganizationId === organizationId
  if (mode === 'edit' && request && (request.status === 'draft' || revising) && !applied) {
    const next = wizardValuesFrom(request)
    setApplied(true)
    setValues(next)
    setBaseline(wizardSignature(next))
  }
  if (mode === 'create' && catalog && values.customerOrganizationId == null) {
    const next = {
      ...values,
      customerOrganizationId: organizationId,
      executorOrganizationId: catalog.organizationKind === 'laboratory' ? organizationId : values.executorOrganizationId,
    }
    setValues(next)
    setBaseline(wizardSignature(next))
  }
  const dirty = wizardSignature(values) !== baseline
  const ids = catalog ? catalogIdsOf(catalog) : null
  const inspected = ids ? inspectRequestDraft(values.details, ids) : { ok: true as const, issues: [] as DraftIssue[] }
  const issues = inspected.ok ? [] : inspected.issues
  const labs = laboratories.currentData?.laboratories ?? []
  const customers = laboratories.currentData?.customers ?? []
  const partiesLoading = kind != null && (laboratories.isLoading || laboratories.isUninitialized)
  const customerId = values.customerOrganizationId ?? organizationId
  const executorId = values.executorOrganizationId ?? (kind === 'laboratory' ? organizationId : null)
  const listed = (items: { id: number }[], id: number | null) => id != null && (partiesLoading || items.some((item) => item.id === id))
  const customerReady = kind == null || (kind === 'customer'
    ? customerId === organizationId
    : listed(customers.length > 0 ? customers : [{ id: organizationId }], customerId))
  const executorReady = listed(labs, executorId)
  const activeIsParty = customerId === organizationId || executorId === organizationId
  const partyCode = !saveAttempted || (customerReady && executorReady && activeIsParty)
    ? null
    : !executorReady
      ? 'executor_required'
      : 'foreign_party'

  useEffect(() => {
    onDirty(dirty)
  }, [dirty, onDirty])

  const buildPayload = () => {
    if (!catalog || !ids) return null
    const blocking = formRef.current?.blockingIssues() ?? []
    const parsed = inspectRequestDraft(values.details, ids)
    const chosenCustomer = values.customerOrganizationId ?? organizationId
    const chosenExecutor = values.executorOrganizationId ?? (catalog.organizationKind === 'laboratory' ? organizationId : null)
    const knownCustomer = catalog.organizationKind === 'customer'
      ? chosenCustomer === organizationId
      : partiesLoading || customers.some((item) => item.id === chosenCustomer) || chosenCustomer === organizationId
    const knownExecutor = chosenExecutor != null && (partiesLoading || labs.some((item) => item.id === chosenExecutor))
    const staysParty = chosenCustomer === organizationId || chosenExecutor === organizationId
    return {
      blocking,
      parsed,
      chosenCustomer,
      chosenExecutor,
      knownCustomer,
      knownExecutor,
      staysParty,
    }
  }

  saveRef.current = async () => {
    if (saving || !catalog || !ids) return false
    const built = buildPayload()
    if (!built) return false
    const { blocking, parsed, chosenCustomer, chosenExecutor, knownCustomer, knownExecutor, staysParty } = built
    if (!parsed.ok || blocking.length > 0 || !knownCustomer || !knownExecutor || !staysParty || chosenExecutor == null) {
      setSaveAttempted(true)
      const field = !knownCustomer || chosenCustomer == null
        ? 'customerOrganizationId'
        : !knownExecutor || !staysParty
          ? 'executorOrganizationId'
          : (!parsed.ok ? parsed.issues[0]?.field : blocking[0]?.field) ?? 'projectName'
      formRef.current?.focusField(field)
      return false
    }
    if (mode === 'edit' && wizardSignature({
      ...values,
      customerOrganizationId: chosenCustomer,
      executorOrganizationId: chosenExecutor,
      details: parsed.details,
    }) === baseline) {
      return true
    }
    setSaving(true)
    try {
      if (mode === 'create') {
        const created = await createRequest({
          organizationId,
          customerOrganizationId: chosenCustomer,
          executorOrganizationId: chosenExecutor,
          details: parsed.details,
        }).unwrap()
        if (pendingBasisFile) {
          await uploadBasis({
            organizationId,
            requestId: created.request.id,
            file: pendingBasisFile,
          }).unwrap()
          setPendingBasisFile(null)
        }
        toast.success(t('requests.created'))
        navigate(listHref, { replace: true })
        return true
      }
      const current = requestQuery.currentData?.request
      if (!current) return false
      const saved = await updateRequest({
        requestId,
        organizationId,
        expectedRevision: current.revision,
        details: parsed.details,
        ...(chosenCustomer !== current.customerOrganizationId ? { customerOrganizationId: chosenCustomer } : {}),
        ...(chosenExecutor !== current.executorOrganizationId ? { executorOrganizationId: chosenExecutor } : {}),
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

  const handleSend = async () => {
    if (sending || saving || !canSend) return
    const built = buildPayload()
    if (!built) return
    const { blocking, parsed, chosenCustomer, chosenExecutor, knownCustomer, knownExecutor, staysParty } = built
    setSendAttempted(true)
    if (!parsed.ok || blocking.length > 0 || !knownCustomer || !knownExecutor || !staysParty || chosenExecutor == null) {
      setSendGaps([])
      setSaveAttempted(true)
      const field = !knownCustomer || chosenCustomer == null
        ? 'customerOrganizationId'
        : !knownExecutor || !staysParty
          ? 'executorOrganizationId'
          : (!parsed.ok ? parsed.issues[0]?.field : blocking[0]?.field) ?? 'projectName'
      formRef.current?.focusField(field)
      return
    }
    const current = mode === 'edit' ? requestQuery.currentData?.request : undefined
    const hasBasis = !!(current?.basisDocument) || (mode === 'create' && pendingBasisFile != null)
    const readiness = inspectRequestForSend({
      customerOrganizationId: chosenCustomer,
      executorOrganizationId: chosenExecutor,
      details: parsed.details,
      hasBasisDocument: hasBasis,
    })
    if (!readiness.ok) {
      setSendGaps(readiness.gaps)
      formRef.current?.focusSendGap(readiness.gaps[0])
      return
    }
    setSendGaps([])
    if (mode === 'edit' && (!requestId || !current)) return
    const sendBody = {
      organizationId,
      details: parsed.details,
      ...(chosenCustomer !== current?.customerOrganizationId ? { customerOrganizationId: chosenCustomer } : {}),
      ...(chosenExecutor !== current?.executorOrganizationId ? { executorOrganizationId: chosenExecutor } : {}),
    }
    setSending(true)
    let targetId = requestId
    let revision = current?.revision ?? 0
    try {
      if (mode === 'create') {
        const created = await createRequest({
          organizationId,
          customerOrganizationId: chosenCustomer,
          executorOrganizationId: chosenExecutor,
          details: parsed.details,
        }).unwrap()
        targetId = created.request.id
        revision = created.request.revision
        if (pendingBasisFile) {
          const uploaded = await uploadBasis({
            organizationId,
            requestId: targetId,
            file: pendingBasisFile,
          }).unwrap()
          revision = uploaded.request.revision
          setPendingBasisFile(null)
        }
      }
      const sent = await sendRequest({
        requestId: targetId,
        expectedRevision: revision,
        ...sendBody,
      }).unwrap()
      const nextValues = wizardValuesFrom(sent.request)
      setValues(nextValues)
      setBaseline(wizardSignature(nextValues))
      setSaveAttempted(false)
      setSendAttempted(false)
      toast.success(t(current?.status === 'rework' ? 'requests.review.resent' : 'requests.sent-success'))
      navigate(mode === 'create' ? listHref : href(routes.requests.detail(targetId), 'organization'), { replace: true })
    } catch (error) {
      const code = requestFailureCode(error)
      toast.error(t(`requests.errors.${code ?? 'generic'}`, { defaultValue: t('requests.errors.generic') }))
      if (mode === 'create' && targetId) {
        navigate(href(routes.requests.edit(targetId), 'organization'), { replace: true })
      }
    } finally {
      setSending(false)
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
  if (mode === 'edit' && request && request.status !== 'draft' && !revising) {
    return (
      <WorkPage>
        <PageHeader title={t('requests.wizard.title-edit', { number: request.number })} />
        <PageState
          kind="empty"
          description={t('requests.errors.not_draft')}
          action={<Button type="button" variant="outline" asChild><Link to={href(routes.requests.detail(request.id), 'organization')}>{t('requests.review.open-card')}</Link></Button>}
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
  const partyName = (id: number | null, fallback: string) => (
    customers.find((item) => item.id === id)?.shortName
    ?? labs.find((item) => item.id === id)?.shortName
    ?? fallback
  )
  const customerName = partyName(values.customerOrganizationId, mode === 'edit' && request ? request.customerShortName : organizationName)
  const executorName = partyName(values.executorOrganizationId, mode === 'edit' && request ? request.executorShortName : organizationName)
  const pageTitle = mode === 'create' ? t('requests.wizard.title-new') : t('requests.wizard.title-edit', { number: request?.number ?? '' })

  return (
    <WorkPage>
      <PageHeader
        breadcrumbs={[
          { label: t('nav.requests'), to: listHref },
          { label: pageTitle },
        ]}
        title={pageTitle}
        description={t('requests.draft.lead-sent-enabled')}
      />
      <RequestDraftForm
        ref={formRef}
        kind={kind ?? 'customer'}
        customerName={customerName}
        executorName={executorName}
        values={values}
        catalog={catalog}
        customers={customers}
        laboratories={labs}
        partiesLoading={partiesLoading}
        issues={issues}
        partyIssue={partyCode != null}
        partyCode={partyCode}
        saveAttempted={saveAttempted}
        sendAttempted={sendAttempted}
        saving={saving}
        sending={sending}
        organizationId={organizationId}
        requestId={mode === 'edit' ? requestId : null}
        basisDocument={request?.basisDocument}
        canSend={canSend && (mode === 'create' || request?.status === 'draft' || revising)}
        canEditBasis={(mode === 'create' ? canSend : canUpdate) && (mode === 'create' || request?.status === 'draft' || revising)}
        pendingBasisFile={pendingBasisFile}
        onPendingBasisFile={mode === 'create' ? setPendingBasisFile : undefined}
        sendGaps={sendGaps}
        sendLabel={t(revising ? 'requests.review.resend' : 'requests.draft.send')}
        notices={[
          ...(revising && request?.returnReason ? [t('requests.review.return-banner', { reason: request.returnReason })] : []),
          ...(request?.sourceRequestId && !request.basisDocument ? [t('requests.review.basis-again')] : []),
        ]}
        onChange={setValues}
        onSave={() => void saveRef.current?.()}
        onSend={() => void handleSend()}
      />
    </WorkPage>
  )
}

function emptyWizardValues(mode: 'create' | 'edit'): WizardValues {
  const details = emptyRequestDraft()
  if (mode === 'create') details.priority = 'medium'
  return { customerOrganizationId: null, executorOrganizationId: null, details }
}

function wizardValuesFrom(request: RequestListItem): WizardValues {
  return {
    customerOrganizationId: request.customerOrganizationId,
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
