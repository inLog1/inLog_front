import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import {
  useCreateAccessAssignmentMutation,
  useGetAccessUserQuery,
  useRevokeAccessAssignmentMutation,
  type AccessUserRoleChoice,
} from '../../../entities/access'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../shared/ui/alert-dialog'
import { Badge } from '../../../shared/ui/badge'
import { Button } from '../../../shared/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../shared/ui/dialog'
import { PageHeader, PageState, WorkPage } from '../../../shared/ui/page'
import { routes } from '../../../shared/lib/routes'
import { accessErrorKey, accessFailure } from '../model/errors'
import { sameScopeKey, scopeKey } from '../model/users-context'
import { permissionSummary } from './permission-summary'
import { scopeLabel } from './scope-label'

export function UserAccess({ userId, backHref }: { userId: number; backHref: string }) {
  const { t } = useTranslation()
  const detail = useGetAccessUserQuery(userId)
  const view = detail.currentData && detail.currentData.user.id === userId ? detail.currentData : undefined
  const [createAssignment, createState] = useCreateAccessAssignmentMutation()
  const [revokeAssignment, revokeState] = useRevokeAccessAssignmentMutation()
  const [assignOpen, setAssignOpen] = useState(false)
  const [selectedScope, setSelectedScope] = useState('')
  const [roleId, setRoleId] = useState('')
  const [revokeId, setRevokeId] = useState<string | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const failureCode = detail.isError ? accessFailure(detail.error).code : null
  const scopes = view?.roleChoices[0]?.scopes.map((item) => item.scope) ?? []
  const selected = scopes.find((item) => scopeKey(item) === selectedScope) ?? null
  const activeRoles = view && selected
    ? view.roleChoices.filter((choice) => choice.scopes.some((item) => sameScopeKey(item.scope, selectedScope) && item.assignable))
    : []
  const blockedRoles = view && selected
    ? view.roleChoices.flatMap((choice) => {
      const item = choice.scopes.find((scope) => sameScopeKey(scope.scope, selectedScope) && !scope.assignable && scope.reason)
      return item?.reason ? [{ choice, reason: item.reason }] : []
    })
    : []
  const chosen = activeRoles.find((choice) => choice.id === roleId) ?? null

  const assign = async () => {
    if (!view || !selected || !roleId) return
    setFailure(null)
    setNotice(null)
    try {
      const result = await createAssignment({
        userId: view.user.id,
        roleId,
        scope: selected,
        expectedAccessVersion: view.accessVersion,
      }).unwrap()
      setNotice(result.idempotent ? t('access.assignment-exists') : t('access.assignment-saved'))
      setAssignOpen(false)
      setRoleId('')
    } catch (error) {
      const parsed = accessFailure(error)
      setFailure(t(accessErrorKey(parsed.code)))
      if (parsed.code === 'stale_write') void detail.refetch()
    }
  }

  const copyLogin = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${routes.login()}`)
      setNotice(t('access.login-shared'))
      setFailure(null)
    } catch {
      setFailure(t('access.copy-failed'))
    }
  }

  const revoke = async () => {
    if (!view || !revokeId) return
    setFailure(null)
    setNotice(null)
    try {
      await revokeAssignment({ assignmentId: revokeId, expectedAccessVersion: view.accessVersion }).unwrap()
      setNotice(t('access.assignment-revoked'))
      setRevokeId(null)
    } catch (error) {
      const parsed = accessFailure(error)
      setFailure(t(accessErrorKey(parsed.code)))
      if (parsed.code === 'stale_write') void detail.refetch()
    }
  }

  return (
    <WorkPage>
      <PageHeader
        title={view?.user.fullName ?? t('access.user-title')}
        description={t('access.user-lead')}
        actions={(
          <Button asChild variant="outline">
            <Link to={backHref}>{t('access.back')}</Link>
          </Button>
        )}
      />
      {failureCode === 'forbidden' ? <PageState kind="error" title={t('access.users-denied-title')} description={t('access.users-denied')} /> : null}
      {failureCode === 'not_found' ? <PageState kind="empty" title={t('access.user-missing-title')} description={t('access.errors.not-found')} /> : null}
      {failureCode && failureCode !== 'forbidden' && failureCode !== 'not_found' ? (
        <PageState kind="error" description={t(accessErrorKey(failureCode))} />
      ) : null}
      {!view && !failureCode ? <PageState kind="loading" description={t('access.loading')} /> : null}
      {view ? (
        <div className="flex min-w-0 flex-col gap-4">
          <section className="rounded-lg border border-border bg-card p-4">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold">{view.user.fullName}</h2>
              {view.user.corporateSuperadmin ? <Badge variant="outline">{t('access.superadmin-badge')}</Badge> : null}
            </div>
            <p className="text-sm text-muted-foreground">{view.user.email}</p>
            <p className="text-sm">{t(`access.users-status.${view.user.status}`)}</p>
            <p className="mt-2 text-sm">
              {view.user.organizations.length > 0
                ? view.user.organizations.map((item) => item.shortName).join(', ')
                : t('access.users-no-orgs')}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">{t('access.membership-note')}</p>
          </section>
          <section className="flex min-w-0 flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold">
                {view.coverage === 'granted' ? t('access.users-area-caption') : t('access.users-roles')}
              </h2>
              {view.canAssign ? (
                <Button type="button" onClick={() => {
                  const first = scopes[0]
                  setSelectedScope(first ? scopeKey(first) : '')
                  setRoleId('')
                  setFailure(null)
                  setAssignOpen(true)
                }}
                >
                  {t('access.assign-title')}
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">{t('access.assign-denied')}</p>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{t('access.revoke-note')}</p>
            {view.user.assignments.length === 0 ? (
              <div className="flex flex-col gap-2">
                <Badge variant="secondary" className="w-fit">{t('access.no-access-badge')}</Badge>
                <p className="text-sm text-muted-foreground">
                  {view.coverage === 'granted' ? t('access.users-none-here') : t('access.users-none')}
                </p>
              </div>
            ) : (
              <ul className="flex flex-col gap-2">
                {view.user.assignments.map((assignment) => (
                  <li key={assignment.id} className="flex min-w-0 flex-col gap-2 rounded-lg border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 text-sm">
                      <p className="font-medium">{assignment.roleName}</p>
                      <p>{scopeLabel(assignment.scope, view.organizations, view.projects, t)}</p>
                    </div>
                    {assignment.canRevoke ? (
                      <Button type="button" variant="outline" onClick={() => { setFailure(null); setRevokeId(assignment.id) }}>
                        {t('access.revoke-one')}
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">{t('access.revoke-denied')}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {view.user.assignments.length > 0 ? (
              <div className="flex flex-col gap-2">
                <Button type="button" variant="outline" className="w-fit" onClick={() => void copyLogin()}>
                  {t('access.copy-login')}
                </Button>
                <p className="text-sm text-muted-foreground">{t('access.login-shared')}</p>
              </div>
            ) : null}
            {notice ? <p className="text-sm" role="status">{notice}</p> : null}
            {failure ? <p className="text-sm text-destructive" role="alert">{failure}</p> : null}
          </section>
        </div>
      ) : null}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('access.assign-title')}</DialogTitle>
            <DialogDescription>{t('access.assign-steps')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <label className="grid gap-1 text-sm">
              {t('access.assignment-scope')}
              <select
                className="h-9 rounded-md border border-border bg-background px-2"
                value={selectedScope}
                onChange={(event) => {
                  setSelectedScope(event.target.value)
                  setRoleId('')
                }}
              >
                {scopes.map((scope) => (
                  <option key={scopeKey(scope)} value={scopeKey(scope)}>
                    {view ? scopeLabel(scope, view.organizations, view.projects, t) : scopeKey(scope)}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              {t('access.role')}
              <select
                className="h-9 rounded-md border border-border bg-background px-2"
                value={roleId}
                onChange={(event) => setRoleId(event.target.value)}
              >
                <option value="">{t('access.choose')}</option>
                {activeRoles.map((choice) => (
                  <option key={choice.id} value={choice.id}>{choice.displayName}</option>
                ))}
              </select>
            </label>
            {chosen ? <RolePreview choice={chosen} /> : null}
            {blockedRoles.length > 0 ? (
              <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
                {blockedRoles.map((item) => (
                  <li key={item.choice.id}>
                    {item.choice.displayName}
                    {' — '}
                    {t(`access.assign-reason.${item.reason.replaceAll('_', '-')}`)}
                  </li>
                ))}
              </ul>
            ) : null}
            {failure ? <p className="text-sm text-destructive" role="alert">{failure}</p> : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAssignOpen(false)}>{t('access.cancel')}</Button>
            <Button type="button" disabled={!chosen || createState.isLoading} onClick={() => void assign()}>
              {t('access.assign-confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={revokeId != null} onOpenChange={(open) => { if (!open) setRevokeId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('access.revoke-one')}</AlertDialogTitle>
            <AlertDialogDescription>{t('access.revoke-note')}</AlertDialogDescription>
          </AlertDialogHeader>
          {failure ? <p className="text-sm text-destructive" role="alert">{failure}</p> : null}
          <AlertDialogFooter>
            <AlertDialogCancel>{t('access.cancel')}</AlertDialogCancel>
            <Button type="button" disabled={revokeState.isLoading} onClick={() => void revoke()}>
              {t('access.revoke-confirm')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </WorkPage>
  )
}

function RolePreview({ choice }: { choice: AccessUserRoleChoice }) {
  const { t } = useTranslation()
  return (
    <div className="rounded-md border border-border p-3 text-sm">
      <p>{t('access.role-summary')}: {permissionSummary(choice.operational) || t('access.no-permissions')}</p>
      <p className="text-muted-foreground">
        {choice.hasDelegation ? t('access.assign-delegation-yes') : t('access.assign-delegation-no')}
      </p>
    </div>
  )
}
