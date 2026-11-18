import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { FormFill } from '../../../../features/form-fill/ui/FormFill'
import { WorkspaceStatus } from '../../../../features/org-project-selector'
import { useHasOrganizationGrant, useWorkspaceSection } from '../../../../features/org-project-selector/model/useWorkspaceSection'
import { useWorkspaceHref } from '../../../../features/org-project-selector/model/useEnsureOrgProjectParams'
import { acceptReturnTo } from '../../../../entities/section'
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
  const canUpdate = useHasOrganizationGrant('forms', 'update', lockedOrg ?? readyOrg)
  const urlOrg = Number(search.get('org'))
  if (readyOrg != null && lockedOrg == null) setLockedOrg(readyOrg)
  const switched = lockedOrg != null && Number.isInteger(urlOrg) && urlOrg > 0 && urlOrg !== lockedOrg
  if (switched && !dirty) setLockedOrg(urlOrg)
  const leave = useLeaveGuard(dirty)
  useUnsavedSource(`form-fill:${formId}`, dirty)
  if (lockedOrg == null || (!switched && section.kind !== 'ready')) {
    return (
      <WorkspaceStatus
        status={section.kind === 'ready' ? 'loading' : section.status}
        reason={section.kind === 'ready' ? null : section.reason}
        onRetry={section.kind === 'ready' ? undefined : section.refetch}
      />
    )
  }
  const sectionBack = acceptReturnTo(search.get('returnTo'), lockedOrg)
  const backHref = sectionBack ?? href(routes.forms.list(), 'organization')
  return (
    <div className="min-w-0">
      <FormFill
        key={`${lockedOrg}:${formId}`}
        organizationId={lockedOrg}
        formId={formId}
        canCreate={canCreate}
        backHref={backHref}
        backLabel={sectionBack ? t('sections.back') : t('forms.back-forms')}
        configureHref={canUpdate ? href(routes.forms.editor(formId), 'organization') : null}
        recordHref={(recordId) => {
          const path = href(routes.forms.record(formId, recordId), 'organization')
          const back = acceptReturnTo(search.get('returnTo'), lockedOrg)
          if (!back) return path
          return `${path}${path.includes('?') ? '&' : '?'}returnTo=${encodeURIComponent(back)}`
        }}
        onDirty={setDirty}
      />
      <AlertDialog open={leave.nextUrl != null || (switched && dirty)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{leave.nextUrl != null ? t('forms.leave-title') : t('forms.org-title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('forms.fill-leave-body')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button type="button" variant="outline" onClick={() => {
              if (leave.nextUrl != null) leave.dismiss()
              else {
                setSearch((prev) => {
                  const next = new URLSearchParams(prev)
                  next.set('org', String(lockedOrg))
                  return next
                }, { replace: true })
              }
            }}>{t('forms.leave-stay')}</Button>
            <Button type="button" variant="outline" onClick={() => {
              const next = leave.nextUrl
              setDirty(false)
              if (next) {
                leave.dismiss()
                navigate(next)
              } else if (switched) setLockedOrg(urlOrg)
            }}>{t('forms.leave-discard')}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
