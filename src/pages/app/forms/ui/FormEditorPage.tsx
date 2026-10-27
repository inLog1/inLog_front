import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { FormEditor } from '../../../../features/form-builder/ui/FormEditor'
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
  const saveRef = useRef<(() => Promise<boolean>) | null>(null)
  const grantOrg = lockedOrg ?? readyOrg
  const canPublish = useHasOrganizationGrant('forms', 'publish', grantOrg)
  const canRecords = useHasOrganizationGrant('form-records', 'read', grantOrg)
  const canRead = useHasOrganizationGrant('forms', 'read', grantOrg)
  const urlOrg = Number(search.get('org'))
  if (readyOrg != null && lockedOrg == null) {
    setLockedOrg(readyOrg)
  }
  const switched = lockedOrg != null && Number.isInteger(urlOrg) && urlOrg > 0 && urlOrg !== lockedOrg
  if (switched && !dirty) setLockedOrg(urlOrg)
  const leave = useLeaveGuard(dirty && !switched)
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
  return (
    <>
      <FormEditor
        key={lockedOrg}
        organizationId={lockedOrg}
        formId={formId}
        canPublish={canPublish}
        recordsHref={canRecords ? href(routes.forms.records(formId), 'organization') : null}
        fillHref={canRead ? href(routes.forms.fill(formId), 'organization') : null}
        saveRef={saveRef}
        onDirty={setDirty}
      />
      <AlertDialog open={leave.nextUrl != null}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('forms.leave-title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('forms.leave-body')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button type="button" variant="outline" onClick={leave.dismiss}>{t('forms.leave-stay')}</Button>
            <Button type="button" variant="outline" onClick={() => { setDirty(false); if (leave.nextUrl) navigate(leave.nextUrl) }}>{t('forms.leave-discard')}</Button>
            <Button type="button" onClick={() => void (async () => {
              const saved = await saveRef.current?.()
              if (saved && leave.nextUrl) {
                setDirty(false)
                navigate(leave.nextUrl)
              }
            })()}>{t('forms.leave-save')}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={switched && dirty}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('forms.org-title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('forms.org-body')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button type="button" variant="outline" onClick={restore}>{t('forms.org-stay')}</Button>
            <Button type="button" variant="outline" onClick={() => { setDirty(false); setLockedOrg(urlOrg) }}>{t('forms.org-discard')}</Button>
            <Button type="button" onClick={() => void (async () => {
              const saved = await saveRef.current?.()
              if (saved) {
                setDirty(false)
                setLockedOrg(urlOrg)
              }
            })()}>{t('forms.org-save')}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
