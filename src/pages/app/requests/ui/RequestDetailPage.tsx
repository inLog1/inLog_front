import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  readProgramMeta,
  type RequestProgramStudyLine,
  useApproveRequestProgramMutation,
  useDeriveRequestMutation,
  useGetRequestCatalogQuery,
  useGetRequestQuery,
  useRejectRequestMutation,
  useReturnRequestMutation,
  useReturnRequestProgramMutation,
  useSaveRequestProgramMutation,
  useStartRequestReviewMutation,
  useSubmitRequestProgramMutation,
  useWithdrawRequestMutation,
} from '../../../../entities/request'
import { WorkspaceStatus } from '../../../../features/org-project-selector'
import { useWorkspaceHref } from '../../../../features/org-project-selector/model/useEnsureOrgProjectParams'
import { useHasOrganizationGrant, useWorkspaceSection } from '../../../../features/org-project-selector/model/useWorkspaceSection'
import { routes } from '../../../../shared/lib/routes'
import { Button } from '../../../../shared/ui/button'
import { PageHeader, PageState, WorkPage } from '../../../../shared/ui/page'
import { formatRequestWhen, requestFailureCode, requestLabel } from '../model/display'
import { programActions, programEditorSeed } from '../model/program-actions'
import {
  RequestBasisCard,
  RequestFactsCard,
  RequestHistoryCard,
  RequestNeedsCard,
  RequestObjectsCard,
  RequestProgramCard,
  RequestReasonNotice,
} from './RequestDetailCards'
import { RequestProgramEditor } from './RequestProgramEditor'
import { RequestReviewDialog, type ReviewDialogKind } from './RequestReviewDialog'
import { RequestStatusBadge } from './RequestStatusBadge'
import { RequestsBoundary } from './RequestsBoundary'

export function RequestDetailPage() {
  return (
    <RequestsBoundary>
      <DetailGate />
    </RequestsBoundary>
  )
}

function DetailGate() {
  const section = useWorkspaceSection('organization', { resource: 'requests', action: 'read' })
  const { requestId = '' } = useParams()
  if (section.kind !== 'ready') {
    return (
      <WorkspaceStatus
        status={section.status}
        reason={section.reason}
        onRetry={section.refetch}
      />
    )
  }
  return <RequestCard key={`${section.organizationId}:${requestId}`} organizationId={section.organizationId} requestId={requestId} />
}

function RequestCard({ organizationId, requestId }: { organizationId: number; requestId: string }) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const href = useWorkspaceHref()
  const query = useGetRequestQuery({ organizationId, requestId })
  const catalog = useGetRequestCatalogQuery({ organizationId })
  const canAccept = useHasOrganizationGrant('requests', 'accept', organizationId)
  const canReject = useHasOrganizationGrant('requests', 'reject', organizationId)
  const canCancel = useHasOrganizationGrant('requests', 'cancel', organizationId)
  const canUpdate = useHasOrganizationGrant('requests', 'update', organizationId)
  const canCreate = useHasOrganizationGrant('requests', 'create', organizationId)
  const canManageProgram = useHasOrganizationGrant('requests', 'manage_program', organizationId)
  const canApproveProgram = useHasOrganizationGrant('requests', 'approve_program', organizationId)
  const [startReview, startState] = useStartRequestReviewMutation()
  const [returnRequest, returnState] = useReturnRequestMutation()
  const [rejectRequest, rejectState] = useRejectRequestMutation()
  const [withdrawRequest, withdrawState] = useWithdrawRequestMutation()
  const [deriveRequest, deriveState] = useDeriveRequestMutation()
  const [saveProgram, saveProgramState] = useSaveRequestProgramMutation()
  const [submitProgram, submitProgramState] = useSubmitRequestProgramMutation()
  const [approveProgram, approveProgramState] = useApproveRequestProgramMutation()
  const [returnProgram, returnProgramState] = useReturnRequestProgramMutation()
  const [dialog, setDialog] = useState<ReviewDialogKind | null>(null)
  const [editing, setEditing] = useState(false)
  const [lines, setLines] = useState<RequestProgramStudyLine[]>([])
  const [note, setNote] = useState('')
  const [seenRevision, setSeenRevision] = useState<number | null>(null)
  const request = query.currentData?.request
  const listHref = href(routes.requests.list(), 'organization')
  const dash = t('requests.dash')
  const busy = startState.isLoading || returnState.isLoading || rejectState.isLoading || withdrawState.isLoading || deriveState.isLoading
    || saveProgramState.isLoading || submitProgramState.isLoading || approveProgramState.isLoading || returnProgramState.isLoading

  const fail = (error: unknown) => {
    const code = requestFailureCode(error)
    toast.error(t(`requests.errors.${code ?? 'generic'}`, { defaultValue: t('requests.errors.generic') }))
  }
  const revisionBody = () => {
    if (!request) return null
    return { requestId: request.id, organizationId, expectedRevision: request.revision }
  }
  const run = async (work: () => Promise<void>) => {
    try {
      await work()
      setDialog(null)
    } catch (error) {
      fail(error)
    }
  }

  if (query.isError && !request) {
    const code = requestFailureCode(query.error)
    return (
      <WorkPage>
        <PageHeader title={t('requests.detail-title', { number: dash })} />
        <PageState
          kind="error"
          description={t(`requests.errors.${code ?? 'generic'}`, { defaultValue: t('requests.errors.generic') })}
          action={<Button type="button" variant="outline" asChild><Link to={listHref}>{t('requests.wizard.back-to-list')}</Link></Button>}
        />
      </WorkPage>
    )
  }
  if (!request) {
    return (
      <WorkPage>
        <PageHeader title={t('requests.detail-title', { number: dash })} description={t('requests.loading')} />
        <PageState kind="loading" description={t('requests.loading')} />
      </WorkPage>
    )
  }

  const executor = request.executorOrganizationId === organizationId
  const customer = request.customerOrganizationId === organizationId
  const meta = readProgramMeta(request.details?.programMeta)
  const program = programActions({
    status: request.status,
    customerOrganizationId: request.customerOrganizationId,
    executorOrganizationId: request.executorOrganizationId,
    organizationId,
    needs: request.details?.needs ?? [],
    meta,
    canManage: canManageProgram,
    canApprove: canApproveProgram,
    editing,
  })
  const seed = programEditorSeed(request)
  if (request.revision !== seenRevision) {
    setSeenRevision(request.revision)
    setLines(seed.lines)
    setNote(seed.note)
    if (seenRevision != null) setEditing(false)
  }
  const runProgram = (work: () => Promise<void>, done: string) => {
    void run(async () => {
      await work()
      toast.success(t(done))
    })
  }
  const actions = (
    <>
      {executor && canAccept && request.status === 'sent' ? (
        <Button type="button" disabled={busy} onClick={() => void run(async () => {
          const body = revisionBody()
          if (!body) return
          await startReview(body).unwrap()
          toast.success(t('requests.review.started'))
        })}>{t('requests.review.start')}</Button>
      ) : null}
      {executor && canAccept && request.status === 'in_review' ? (
        <Button type="button" variant="outline" disabled={busy} onClick={() => setDialog('return')}>{t('requests.review.return')}</Button>
      ) : null}
      {executor && canReject && request.status === 'in_review' ? (
        <Button type="button" variant="destructive" disabled={busy} onClick={() => setDialog('reject')}>{t('requests.review.reject')}</Button>
      ) : null}
      {customer && canCancel && request.status === 'sent' ? (
        <Button type="button" variant="outline" disabled={busy} onClick={() => setDialog('withdraw')}>{t('requests.review.withdraw')}</Button>
      ) : null}
      {customer && canUpdate && request.status === 'rework' ? (
        <Button type="button" disabled={busy} onClick={() => navigate(href(routes.requests.edit(request.id), 'organization'))}>
          {t('requests.card.open-edit')}
        </Button>
      ) : null}
      {customer && canUpdate && request.status === 'draft' ? (
        <Button type="button" disabled={busy} onClick={() => navigate(href(routes.requests.edit(request.id), 'organization'))}>
          {t('requests.card.open-edit')}
        </Button>
      ) : null}
      {canCreate && (request.status === 'rejected' || request.status === 'withdrawn') ? (
        <Button type="button" variant="outline" disabled={busy} onClick={() => setDialog('derive')}>{t('requests.review.derive')}</Button>
      ) : null}
      {program.includes('prepare') ? (
        <Button type="button" disabled={busy} onClick={() => setEditing(true)}>{t('requests.program.prepare')}</Button>
      ) : null}
      {program.includes('edit') ? (
        <Button type="button" variant="outline" disabled={busy} onClick={() => setEditing(true)}>{t('requests.program.edit')}</Button>
      ) : null}
      {program.includes('save') ? (
        <Button type="button" variant="outline" disabled={busy} onClick={() => runProgram(async () => {
          const body = revisionBody()
          if (!body) return
          await saveProgram({ ...body, lines, note }).unwrap()
        }, 'requests.program.saved')}>{t('requests.program.save')}</Button>
      ) : null}
      {program.includes('submit') ? (
        <Button type="button" disabled={busy} onClick={() => runProgram(async () => {
          const body = revisionBody()
          if (!body) return
          await submitProgram(body).unwrap()
        }, 'requests.program.submitted')}>{t('requests.program.submit')}</Button>
      ) : null}
      {program.includes('agree') ? (
        <Button type="button" disabled={busy} onClick={() => runProgram(async () => {
          const body = revisionBody()
          if (!body) return
          await approveProgram(body).unwrap()
        }, 'requests.program.agreed')}>{t('requests.program.agree')}</Button>
      ) : null}
      {program.includes('approve') ? (
        <Button type="button" disabled={busy} onClick={() => runProgram(async () => {
          const body = revisionBody()
          if (!body) return
          await approveProgram(body).unwrap()
        }, 'requests.program.approved')}>{t('requests.program.approve')}</Button>
      ) : null}
      {program.includes('return_program') ? (
        <Button type="button" variant="outline" disabled={busy} onClick={() => setDialog('program-return')}>{t('requests.program.return')}</Button>
      ) : null}
    </>
  )

  const confirm = (reason?: string) => {
    const body = revisionBody()
    if (!body || !dialog) return
    void run(async () => {
      if (dialog === 'return' && reason) {
        await returnRequest({ ...body, reason }).unwrap()
        toast.success(t('requests.review.returned'))
      }
      if (dialog === 'reject' && reason) {
        await rejectRequest({ ...body, reason }).unwrap()
        toast.success(t('requests.review.rejected'))
      }
      if (dialog === 'withdraw') {
        await withdrawRequest(body).unwrap()
        toast.success(t('requests.review.withdrawn'))
      }
      if (dialog === 'program-return' && reason) {
        await returnProgram({ ...body, reason }).unwrap()
        toast.success(t('requests.program.program-returned'))
      }
      if (dialog === 'derive') {
        const created = await deriveRequest(body).unwrap()
        toast.success(t('requests.review.derived', { number: created.request.number }))
        toast.message(t('requests.review.basis-again'))
        navigate(href(routes.requests.edit(created.request.id), 'organization'))
      }
    })
  }

  return (
    <WorkPage>
      <PageHeader
        breadcrumbs={[
          { label: t('nav.requests'), to: listHref },
          { label: request.number },
        ]}
        title={requestLabel(request.title, request.number)}
        description={(
          <span className="flex flex-wrap items-center gap-2">
            <span>{request.number}</span>
            <RequestStatusBadge status={request.status} />
            <span>{t('requests.field-created')}: {requestLabel(formatRequestWhen(request.createdAt, i18n.language), dash)}</span>
          </span>
        )}
        actions={actions}
      />
      <RequestReasonNotice request={request} />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_26rem] xl:grid-cols-[minmax(0,1fr)_32rem]">
        <div className="min-w-0 space-y-4">
          <RequestObjectsCard request={request} catalog={catalog.currentData} dash={dash} />
          <RequestNeedsCard request={request} catalog={catalog.currentData} dash={dash} />
          <RequestProgramCard
            request={request}
            catalog={catalog.currentData}
            dash={dash}
            editor={program.includes('save') ? (
              <RequestProgramEditor
                request={request}
                catalog={catalog.currentData}
                lines={lines}
                note={note}
                onLines={setLines}
                onNote={setNote}
              />
            ) : undefined}
          />
          <RequestBasisCard request={request} organizationId={organizationId} />
        </div>
        <div className="space-y-4">
          <RequestFactsCard request={request} dash={dash} />
          <RequestHistoryCard request={request} dash={dash} />
        </div>
      </div>
      <RequestReviewDialog kind={dialog} busy={busy} onClose={() => { if (!busy) setDialog(null) }} onConfirm={confirm} />
    </WorkPage>
  )
}
