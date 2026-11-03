import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, MoreHorizontal, Pencil, Plus, Search, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useGetAccessUsersQuery } from '../../../entities/access'
import { Badge } from '../../../shared/ui/badge'
import { Button } from '../../../shared/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../shared/ui/dropdown-menu'
import { Input } from '../../../shared/ui/input'
import { PageState } from '../../../shared/ui/page'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../shared/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../shared/ui/table'
import { cn } from '../../../shared/lib/utils'
import { accessErrorKey, accessFailure } from '../model/errors'
import { usersRequestMatches } from '../model/users-context'

const PAGE_SIZE = 20

export function UserDirectory({
  userHref,
  area,
  roles,
}: {
  userHref: (userId: number) => string
  area: 'organization' | 'corporation'
  roles: readonly { id: string; displayName: string }[]
}) {
  const { t } = useTranslation()
  const searchRef = useRef<HTMLInputElement>(null)
  const [q, setQ] = useState('')
  const [organization, setOrganization] = useState<number | 'all'>('all')
  const [roleId, setRoleId] = useState('all')
  const [page, setPage] = useState(1)
  const requested = { organization, q: q.trim(), page, pageSize: PAGE_SIZE }
  const users = useGetAccessUsersQuery(requested)
  const pageData = users.currentData && usersRequestMatches(users.currentData.query, requested) ? users.currentData : null
  const failure = users.isError ? accessFailure(users.error) : null
  const knownRole = roleId === 'all' || roles.some((role) => role.id === roleId)

  useEffect(() => {
    if (knownRole) return
    setRoleId('all')
  }, [knownRole])

  const visible = (pageData?.users ?? []).filter((user) => (
    roleId === 'all' || user.assignments.some((assignment) => assignment.roleId === roleId)
  ))
  const heading = area === 'corporation' ? t('access.users-heading-corporation') : t('access.users-heading')
  const from = pageData && pageData.count > 0 ? (page - 1) * PAGE_SIZE + 1 : 0
  const to = pageData ? Math.min(page * PAGE_SIZE, pageData.count) : 0

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex min-w-0 flex-col gap-2 lg:flex-row lg:items-center">
        <Button type="button" className="shrink-0" onClick={() => searchRef.current?.focus()}>
          <Plus />
          {t('access.assign-title')}
        </Button>
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            ref={searchRef}
            value={q}
            className="pl-9"
            placeholder={t('access.users-search-placeholder')}
            aria-label={t('access.users-search')}
            onChange={(event) => {
              setQ(event.target.value)
              setPage(1)
            }}
          />
        </div>
        <Select
          value={String(organization)}
          onValueChange={(next) => {
            setOrganization(next === 'all' ? 'all' : Number(next))
            setPage(1)
          }}
        >
          <SelectTrigger className="w-full lg:w-48" aria-label={t('access.users-org')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('access.users-all-orgs')}</SelectItem>
            {(pageData?.organizations ?? []).map((item) => (
              <SelectItem key={item.id} value={String(item.id)}>{item.shortName}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={knownRole ? roleId : 'all'} onValueChange={setRoleId}>
          <SelectTrigger className="w-full lg:w-48" aria-label={t('access.role')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('access.users-all-roles')}</SelectItem>
            {roles.map((role) => (
              <SelectItem key={role.id} value={role.id}>{role.displayName}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {roleId !== 'all' && pageData && pageData.count > PAGE_SIZE ? (
        <p className="text-xs text-muted-foreground">{t('access.users-role-filter-page')}</p>
      ) : null}
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
        <section className="min-w-0 overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <Users className="size-4 text-muted-foreground" aria-hidden />
            <h2 className="text-base font-semibold">{heading}</h2>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">{t('access.users-column-user')}</TableHead>
                  <TableHead>{t('access.users-column-org')}</TableHead>
                  <TableHead>{t('access.users-column-roles')}</TableHead>
                  <TableHead>{t('access.users-column-status')}</TableHead>
                  <TableHead className="pr-4">{t('access.row-actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      {t('access.users-empty')}
                    </TableCell>
                  </TableRow>
                ) : visible.map((user) => {
                  const assigned = uniqueRoles(user.assignments)
                  const hasRoles = assigned.length > 0
                  return (
                    <TableRow key={user.id}>
                      <TableCell className="pl-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                            {initials(user.fullName)}
                          </span>
                          <span className="min-w-0">
                            <span className="flex min-w-0 flex-wrap items-center gap-2">
                              <span className="truncate font-medium">{user.fullName}</span>
                              {user.corporateSuperadmin ? <Badge variant="outline">{t('access.superadmin-badge')}</Badge> : null}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {user.organizations.length > 0
                          ? user.organizations.map((item) => item.shortName).join(', ')
                          : t('access.users-no-orgs')}
                      </TableCell>
                      <TableCell>
                        {hasRoles ? (
                          <div className="flex flex-wrap gap-1.5">
                            {assigned.map((assignment) => (
                              <span key={assignment.roleId} className="rounded-full bg-sky-500/10 px-2.5 py-0.5 text-xs font-medium text-sky-800 dark:text-sky-200">
                                {assignment.roleName}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">{t('access.users-unassigned')}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1.5 text-sm whitespace-nowrap">
                          <span className={cn('size-2 rounded-full', user.status === 'active' ? 'bg-emerald-500' : 'bg-muted-foreground/40')} aria-hidden />
                          {t(`access.users-status.${user.status}`)}
                        </span>
                      </TableCell>
                      <TableCell className="pr-4">
                        <div className="flex items-center gap-1.5">
                          <Button asChild variant="outline" size="sm">
                            <Link to={userHref(user.id)}>
                              {hasRoles ? <Pencil /> : <Plus />}
                              {hasRoles ? t('access.users-change-roles') : t('access.users-assign-short')}
                            </Link>
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button type="button" variant="outline" size="icon" className="size-8" aria-label={t('access.row-actions')}>
                                <MoreHorizontal />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link to={userHref(user.id)}>{t('access.users-configure')}</Link>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3">
            <p className="text-sm text-muted-foreground">
              {roleId === 'all'
                ? t('access.users-shown', { from, to, count: pageData.count })
                : t('access.users-shown-page', { count: visible.length })}
            </p>
            <div className="flex items-center gap-1">
              <Button type="button" variant="outline" size="icon" className="size-8" disabled={page <= 1} aria-label={t('access.users-prev')} onClick={() => setPage((current) => current - 1)}>
                <ChevronLeft />
              </Button>
              <span className="flex h-8 min-w-8 items-center justify-center rounded-md bg-primary px-2 text-sm font-medium text-primary-foreground">{page}</span>
              <Button type="button" variant="outline" size="icon" className="size-8" disabled={page * PAGE_SIZE >= pageData.count} aria-label={t('access.users-next')} onClick={() => setPage((current) => current + 1)}>
                <ChevronRight />
              </Button>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  )
}

function uniqueRoles(assignments: readonly { roleId: string; roleName: string }[]): { roleId: string; roleName: string }[] {
  const seen = new Set<string>()
  const roles: { roleId: string; roleName: string }[] = []
  for (const assignment of assignments) {
    if (seen.has(assignment.roleId)) continue
    seen.add(assignment.roleId)
    roles.push({ roleId: assignment.roleId, roleName: assignment.roleName })
  }
  return roles
}

function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  const letters = `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`
  return letters.toLocaleUpperCase('ru')
}
