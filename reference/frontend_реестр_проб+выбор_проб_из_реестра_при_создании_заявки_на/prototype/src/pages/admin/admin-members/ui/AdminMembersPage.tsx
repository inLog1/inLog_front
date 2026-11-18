import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useGetAdminMembersQuery } from '../../../../entities/platform-admin/model/platformAdminSlice'
import { ADMIN_PAGE_SIZE, formatAdminDateShort } from '../../../../features/platform-admin/lib/format'
import { AdminPagination } from '../../../../features/platform-admin/ui/AdminPagination'
import { AdminSearchBar } from '../../../../features/platform-admin/ui/AdminSearchBar'
import { AdminSectionShell } from '../../../../features/platform-admin/ui/AdminSectionShell'
import { AdminUserCell } from '../../../../features/platform-admin/ui/AdminUserCell'
import { Badge } from '../../../../shared/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../../shared/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../../shared/ui/table'

export function AdminMembersPage() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<'project' | 'organization'>('project')
  const [search, setSearch] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [offset, setOffset] = useState(0)

  const { data, isLoading, isFetching } = useGetAdminMembersQuery({
    limit: ADMIN_PAGE_SIZE,
    offset,
    search: appliedSearch || undefined,
    type: tab,
  })

  const members = data?.results ?? []

  const handleSearch = () => {
    setAppliedSearch(search.trim())
    setOffset(0)
  }

  const handleTabChange = (value: string) => {
    setTab(value as 'project' | 'organization')
    setOffset(0)
    setSearch('')
    setAppliedSearch('')
  }

  return (
    <AdminSectionShell
      title={t('admin-page.members')}
      description={t('admin-page.members-description')}
      isLoading={isLoading}
      isEmpty={!isLoading && members.length === 0}
      toolbar={
        <div className="space-y-3">
          <Tabs value={tab} onValueChange={handleTabChange}>
            <TabsList>
              <TabsTrigger value="project">{t('admin-page.members-tab.project')}</TabsTrigger>
              <TabsTrigger value="organization">
                {t('admin-page.members-tab.organization')}
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <AdminSearchBar
            value={search}
            onChange={setSearch}
            onSubmit={handleSearch}
            placeholder={t('admin-page.search-members')}
            actionLabel={t('admin-page.search')}
          />
        </div>
      }
      footer={
        data ? (
          <AdminPagination
            count={data.count}
            offset={offset}
            limit={ADMIN_PAGE_SIZE}
            onChange={setOffset}
            isLoading={isFetching}
          />
        ) : null
      }
    >
      <Tabs value={tab}>
        <TabsContent value="project" className="mt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('admin-page.members-table.user')}</TableHead>
                <TableHead>{t('admin-page.members-table.organization')}</TableHead>
                <TableHead>{t('admin-page.members-table.project')}</TableHead>
                <TableHead>{t('admin-page.members-table.role')}</TableHead>
                <TableHead>{t('admin-page.members-table.belonging')}</TableHead>
                <TableHead>{t('admin-page.members-table.joined')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => (
                <TableRow key={`project-${member.id}`}>
                  <TableCell className="min-w-[200px]">
                    <AdminUserCell user={member.user} />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span>{member.organization_name}</span>
                      <span className="text-xs text-muted-foreground">#{member.organization_id}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span>{member.project_name || '—'}</span>
                      {member.project_id && (
                        <span className="text-xs text-muted-foreground">#{member.project_id}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{member.role}</Badge>
                  </TableCell>
                  <TableCell>{member.belonging || '—'}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatAdminDateShort(member.created_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="organization" className="mt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('admin-page.members-table.user')}</TableHead>
                <TableHead>{t('admin-page.members-table.organization')}</TableHead>
                <TableHead>{t('admin-page.members-table.role')}</TableHead>
                <TableHead>{t('admin-page.members-table.joined')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => (
                <TableRow key={`org-${member.id}`}>
                  <TableCell className="min-w-[200px]">
                    <AdminUserCell user={member.user} />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span>{member.organization_name}</span>
                      <span className="text-xs text-muted-foreground">#{member.organization_id}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{member.role}</Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatAdminDateShort(member.created_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>
      </Tabs>
    </AdminSectionShell>
  )
}
