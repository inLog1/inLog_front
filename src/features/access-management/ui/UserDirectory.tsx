import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useGetAccessUsersQuery } from '../../../entities/access'
import { Badge } from '../../../shared/ui/badge'
import { Button } from '../../../shared/ui/button'
import { Input } from '../../../shared/ui/input'
import { PageState } from '../../../shared/ui/page'
import { accessErrorKey, accessFailure } from '../model/errors'
import { usersRequestMatches } from '../model/users-context'
import { scopeLabel } from './scope-label'

const PAGE_SIZE = 20

export function UserDirectory({ userHref }: { userHref: (userId: number) => string }) {
  const { t } = useTranslation()
  const [q, setQ] = useState('')
  const [organization, setOrganization] = useState<number | 'all'>('all')
  const [page, setPage] = useState(1)
  const requested = { organization, q: q.trim(), page, pageSize: PAGE_SIZE }
  const users = useGetAccessUsersQuery(requested)
  const pageData = users.currentData && usersRequestMatches(users.currentData.query, requested) ? users.currentData : null
  const failure = users.isError ? accessFailure(users.error) : null

  return (
    <div className="mt-4 flex min-w-0 flex-col gap-3">
      <p className="text-sm text-muted-foreground">{t('access.users-lead')}</p>
      <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_14rem]">
        <label className="grid min-w-0 gap-1 text-sm">
          {t('access.users-search')}
          <Input
            value={q}
            onChange={(event) => {
              setQ(event.target.value)
              setPage(1)
            }}
          />
        </label>
        <label className="grid min-w-0 gap-1 text-sm">
          {t('access.users-org')}
          <select
            className="h-9 rounded-md border border-border bg-background px-2"
            value={String(organization)}
            onChange={(event) => {
              const next = event.target.value
              setOrganization(next === 'all' ? 'all' : Number(next))
              setPage(1)
            }}
          >
            <option value="all">{t('access.users-all-orgs')}</option>
            {(pageData?.organizations ?? []).map((item) => (
              <option key={item.id} value={item.id}>{item.shortName}</option>
            ))}
          </select>
        </label>
      </div>
      {failure?.code === 'forbidden' ? (
        <PageState kind="error" title={t('access.users-denied-title')} description={t('access.users-denied')} />
      ) : null}
      {failure && failure.code !== 'forbidden' ? (
        <PageState kind="error" description={t(accessErrorKey(failure.code))} />
      ) : null}
      {!pageData && !failure ? <PageState kind="loading" description={t('access.loading')} /> : null}
      {pageData && pageData.count === 0 ? (
        <PageState kind="empty" title={t('access.users-empty-title')} description={t('access.users-empty')} />
      ) : null}
      {pageData && pageData.count > 0 ? (
        <>
          <p className="text-sm text-muted-foreground">{t('access.users-count', { count: pageData.count })}</p>
          <ul className="flex flex-col gap-2">
            {pageData.users.map((user) => (
              <li key={user.id} className="rounded-lg border border-border bg-card p-3">
                <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <p className="truncate font-medium">{user.fullName}</p>
                      {user.corporateSuperadmin ? <Badge variant="outline">{t('access.superadmin-badge')}</Badge> : null}
                    </div>
                    <p className="truncate text-sm text-muted-foreground">{user.email}</p>
                    <p className="text-sm">{t(`access.users-status.${user.status}`)}</p>
                    <p className="text-sm">
                      {user.organizations.length > 0
                        ? user.organizations.map((item) => item.shortName).join(', ')
                        : t('access.users-no-orgs')}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {pageData.coverage === 'granted' ? t('access.users-area-caption') : t('access.users-roles')}
                    </p>
                    {user.assignments.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        {pageData.coverage === 'granted' ? t('access.users-none-here') : t('access.users-none')}
                      </p>
                    ) : (
                      <ul className="mt-1 flex flex-col gap-1 text-sm">
                        {user.assignments.map((assignment) => (
                          <li key={assignment.id}>
                            {assignment.roleName}
                            {' · '}
                            {scopeLabel(assignment.scope, pageData.organizations, pageData.projects, t)}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
                    <Link to={userHref(user.id)}>{t('access.users-configure')}</Link>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
              {t('access.users-prev')}
            </Button>
            <span className="text-sm text-muted-foreground">{t('access.users-page', { page, pages: Math.max(1, Math.ceil(pageData.count / PAGE_SIZE)) })}</span>
            <Button type="button" variant="outline" disabled={page * PAGE_SIZE >= pageData.count} onClick={() => setPage((current) => current + 1)}>
              {t('access.users-next')}
            </Button>
          </div>
        </>
      ) : null}
    </div>
  )
}
