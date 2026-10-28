import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useGetSessionAccessQuery } from '../../../../entities/access'
import { ViewEditor } from '../../../../features/table-view/ui/ViewEditor'
import { WorkspaceStatus } from '../../../../features/org-project-selector'
import { useHasOrganizationGrant, useWorkspaceSection } from '../../../../features/org-project-selector/model/useWorkspaceSection'
import { useWorkspaceHref } from '../../../../features/org-project-selector/model/useEnsureOrgProjectParams'
import { routes } from '../../../../shared/lib/routes'
import { Button } from '../../../../shared/ui/button'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../../shared/ui/alert-dialog'
import { useUnsavedSource } from '../../../../shared/session/unsaved-work'
import { settleSavedLeave } from '../model/leave-guard'
import { useLeaveGuard } from '../model/use-leave-guard'
import { FormsBoundary } from './FormsBoundary'

export function FormViewCreatePage() {
  return (
    <FormsBoundary>
      <EditorGate viewId={null} />
    </FormsBoundary>
  )
}

export function FormViewEditPage() {
  const { viewId = '' } = useParams()
  return (
    <FormsBoundary>
      <EditorGate viewId={viewId} />
    </FormsBoundary>
  )
}

function EditorGate({ viewId }: { viewId: string | null }) {
  const { t } = useTranslation()
  const { formId = '' } = useParams()
  const navigate = useNavigate()
  const href = useWorkspaceHref()
  const [search, setSearch] = useSearchParams()
  const section = useWorkspaceSection('organization', { resource: 'forms', action: 'read' })
  const readyOrg = section.kind === 'ready' ? section.organizationId : null
  const [lockedOrg, setLockedOrg] = useState<number | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const saveRef = useRef<(() => Promise<boolean>) | null>(null)
  const attempt = useRef(0)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])
  const grantOrg = lockedOrg ?? readyOrg
  const canCreate = useHasOrganizationGrant('table-views', 'create', grantOrg)
  const canUpdate = useHasOrganizationGrant('table-views', 'update', grantOrg)
  const canRecords = useHasOrganizationGrant('form-records', 'read', grantOrg)
  const access = useGetSessionAccessQuery(undefined, { skip: grantOrg == null })
  const grantsReady = access.isSuccess && access.data?.accessState === 'ready'
  const canEdit = viewId == null ? canCreate : canUpdate
  const urlOrg = Number(search.get('org'))
  if (readyOrg != null && lockedOrg == null) setLockedOrg(readyOrg)
  const switched = lockedOrg != null && Number.isInteger(urlOrg) && urlOrg > 0 && urlOrg !== lockedOrg
  if (switched && !dirty) setLockedOrg(urlOrg)
  const leave = useLeaveGuard(dirty)
  useUnsavedSource(viewId ?? 'table-view-draft', dirty)
  if (lockedOrg == null || !grantsReady) {
    return (
      <WorkspaceStatus
        status={section.kind === 'ready' ? 'loading' : section.status}
        reason={section.kind === 'ready' ? null : section.reason}
        onRetry={section.kind === 'ready' ? undefined : section.refetch}
      />
    )
  }
  if (!canEdit || !canRecords) return <WorkspaceStatus status="forbidden" reason="missing-permission" />
  if (!switched && section.kind !== 'ready') {
    return <WorkspaceStatus status={section.status} reason={section.reason} onRetry={section.refetch} />
  }
  const restore = () => {
    setSearch((prev) => {
      const next = new URLSearchParams(prev)
      next.set('org', String(lockedOrg))
      return next
    }, { replace: true })
  }
  const cancelLeave = () => { attempt.current += 1 }
  const saveThen = async (after: () => void) => {
    if (saving) return
    const ticket = ++attempt.current
    setSaving(true)
    const saved = await saveRef.current?.() ?? false
    if (!mounted.current) return
    setSaving(false)
    if (settleSavedLeave({ ticket, currentTicket: attempt.current, mounted: true, saved }) !== 'navigate') return
    setDirty(false)
    after()
  }
  return (
    <div className="mx-auto flex min-w-0 max-w-5xl flex-col gap-4 p-4 pb-20">
      <ViewEditor
        key={`${lockedOrg}:${viewId ?? 'new'}`}
        organizationId={lockedOrg}
        formId={formId}
        viewId={viewId}
        canPreview={canRecords}
        recordHref={(recordId) => href(routes.forms.record(formId, recordId), 'organization')}
        saveRef={saveRef}
        onDirty={setDirty}
        onSaved={(id) => {
          setDirty(false)
          navigate(href(routes.forms.view(formId, id), 'organization'))
        }}
      />
      <AlertDialog open={leave.nextUrl != null}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('forms.leave-title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('forms.leave-body')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button type="button" variant="outline" onClick={() => { cancelLeave(); leave.dismiss() }}>{t('forms.leave-stay')}</Button>
            <Button type="button" variant="outline" onClick={() => {
              const next = leave.nextUrl
              cancelLeave()
              setDirty(false)
              leave.dismiss()
              if (next) navigate(next)
            }}>{t('forms.leave-discard')}</Button>
            <Button type="button" disabled={saving} onClick={() => void saveThen(() => {
              const next = leave.nextUrl
              leave.dismiss()
              if (next) navigate(next)
            })}>{t('forms.leave-save')}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={switched && dirty && leave.nextUrl == null}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('forms.org-title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('forms.org-body')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button type="button" variant="outline" onClick={() => { cancelLeave(); restore() }}>{t('forms.org-stay')}</Button>
            <Button type="button" variant="outline" onClick={() => { cancelLeave(); setDirty(false); setLockedOrg(urlOrg) }}>{t('forms.org-discard')}</Button>
            <Button type="button" disabled={saving} onClick={() => void saveThen(() => setLockedOrg(urlOrg))}>{t('forms.org-save')}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
