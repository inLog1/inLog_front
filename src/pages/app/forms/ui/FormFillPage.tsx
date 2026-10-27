import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { FormFill } from '../../../../features/form-fill/ui/FormFill'
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

export function FormFillPage() {
  return (
    <FormsBoundary>
      <FillGate />
    </FormsBoundary>
  )
}

function FillGate() {
  const { t } = useTranslation()
  const { formId = '' } = useParams()
  const navigate = useNavigate()
  const href = useWorkspaceHref()
  const [search, setSearch] = useSearchParams()
  const section = useWorkspaceSection('organization', { resource: 'forms', action: 'read' })
  const readyOrg = section.kind === 'ready' ? section.organizationId : null
  const [lockedOrg, setLockedOrg] = useState<number | null>(null)
  const [dirty, setDirty] = useState(false)
  const canCreate = useHasOrganizationGrant('form-records', 'create', lockedOrg ?? readyOrg)
  const urlOrg = Number(search.get('org'))
  if (readyOrg != null && lockedOrg == null) setLockedOrg(readyOrg)
  const switched = lockedOrg != null && Number.isInteger(urlOrg) && urlOrg > 0 && urlOrg !== lockedOrg
  if (switched && !dirty) setLockedOrg(urlOrg)
  const leave = useLeaveGuard(dirty && !switched)
  if (lockedOrg == null || (!switched && section.kind !== 'ready')) {
    return (
      <WorkspaceStatus
        status={section.kind === 'ready' ? 'loading' : section.status}
        reason={section.kind === 'ready' ? null : section.reason}
        onRetry={section.kind === 'ready' ? undefined : section.refetch}
      />
    )
  }
  return (
    <div className="min-w-0">
      <div className="px-4 pt-4">
        <Link className="text-sm text-primary underline-offset-4 hover:underline" to={href(routes.forms.list(), 'organization')}>{t('forms.back-forms')}</Link>
      </div>
      <FormFill
        key={lockedOrg}
        organizationId={lockedOrg}
        formId={formId}
        canCreate={canCreate}
        recordHref={(recordId) => href(routes.forms.record(formId, recordId), 'organization')}
        onDirty={setDirty}
      />
      <AlertDialog open={leave.nextUrl != null || (switched && dirty)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{switched ? t('forms.org-title') : t('forms.leave-title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('forms.fill-leave-body')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button type="button" variant="outline" onClick={() => {
              if (switched) {
                setSearch((prev) => {
                  const next = new URLSearchParams(prev)
                  next.set('org', String(lockedOrg))
                  return next
                }, { replace: true })
              } else leave.dismiss()
            }}>{t('forms.leave-stay')}</Button>
            <Button type="button" variant="outline" onClick={() => {
              setDirty(false)
              if (switched) setLockedOrg(urlOrg)
              else if (leave.nextUrl) navigate(leave.nextUrl)
            }}>{t('forms.leave-discard')}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
