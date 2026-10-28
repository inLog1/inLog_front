import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { FormEditor } from '../../../../features/form-builder/ui/FormEditor'
import { WorkspaceStatus } from '../../../../features/org-project-selector'
import { useHasOrganizationGrant, useWorkspaceSection } from '../../../../features/org-project-selector/model/useWorkspaceSection'
import { useWorkspaceHref } from '../../../../features/org-project-selector/model/useEnsureOrgProjectParams'
import { routes } from '../../../../shared/lib/routes'
import { Button } from '../../../../shared/ui/button'
import { WorkPage } from '../../../../shared/ui/page'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../../shared/ui/alert-dialog'
import { settleSavedLeave } from '../model/leave-guard'
import { useLeaveGuard } from '../model/use-leave-guard'
import { FormsBoundary } from './FormsBoundary'

export function FormEditorPage() {
  return (
    <FormsBoundary>
      <EditorGate />
    </FormsBoundary>
  )
}

function EditorGate() {
  const { t } = useTranslation()
  const { formId = '' } = useParams()
  const navigate = useNavigate()
  const href = useWorkspaceHref()
  const [search, setSearch] = useSearchParams()
  const section = useWorkspaceSection('organization', { resource: 'forms', action: 'update' })
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
  const canPublish = useHasOrganizationGrant('forms', 'publish', grantOrg)
  const canRecords = useHasOrganizationGrant('form-records', 'read', grantOrg)
  const canRead = useHasOrganizationGrant('forms', 'read', grantOrg)
  const canViews = useHasOrganizationGrant('table-views', 'read', grantOrg)
  const urlOrg = Number(search.get('org'))
  if (readyOrg != null && lockedOrg == null) {
    setLockedOrg(readyOrg)
  }
  const switched = lockedOrg != null && Number.isInteger(urlOrg) && urlOrg > 0 && urlOrg !== lockedOrg
  if (switched && !dirty) setLockedOrg(urlOrg)
  const leave = useLeaveGuard(dirty)
  if (lockedOrg == null) {
    return (
      <WorkspaceStatus
        status={section.kind === 'ready' ? 'loading' : section.status}
        reason={section.kind === 'ready' ? null : section.reason}
        onRetry={section.kind === 'ready' ? undefined : section.refetch}
      />
    )
  }
  if (!switched && section.kind !== 'ready') {
    return (
      <WorkspaceStatus
        status={section.status}
        reason={section.reason}
        onRetry={section.refetch}
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
    <WorkPage>
      <div className="flex w-full min-w-0 max-w-[1200px] flex-col gap-4">
      <FormEditor
        key={lockedOrg}
        organizationId={lockedOrg}
        formId={formId}
        canPublish={canPublish}
        listHref={href(routes.forms.list(), 'organization')}
        recordsHref={canRecords ? href(routes.forms.records(formId), 'organization') : null}
        viewsHref={canViews ? href(routes.forms.views(formId), 'organization') : null}
        fillHref={canRead ? href(routes.forms.fill(formId), 'organization') : null}
        saveRef={saveRef}
        onDirty={setDirty}
      />
      </div>
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
    </WorkPage>
  )
}
