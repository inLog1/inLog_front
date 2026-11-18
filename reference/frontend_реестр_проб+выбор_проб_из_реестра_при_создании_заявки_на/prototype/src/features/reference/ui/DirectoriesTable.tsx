import { BookOpen, ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { DirectoryDefinition, DirectoryPermissions } from '../../../entities/personnel/model/types'
import type { DirectoryView } from '../../../entities/personnel/model/personnelApi'
import { Button } from '../../../shared/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../shared/ui/dropdown-menu'
import { Input } from '../../../shared/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../shared/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../shared/ui/table'
import {
  DIRECTORY_PAGE_SIZES,
  type DirectorySortKey,
  type SortDirection,
  pageCount,
} from '../model/directory-list'
import { canDeleteDirectoryDefinition } from '../model/directory-metadata'
import { directorySections, primarySection, type DirectorySectionId } from '../model/directory-sections'

export function DirectoriesTable({
  items,
  total,
  sectionId,
  query,
  sortKey,
  sortDirection,
  page,
  pageSize,
  permissions,
  onQueryChange,
  onSortChange,
  onPageChange,
  onPageSizeChange,
  onOpen,
  onEditStructure,
  onDelete,
}: {
  items: DirectoryView[]
  total: number
  sectionId: DirectorySectionId
  query: string
  sortKey: DirectorySortKey
  sortDirection: SortDirection
  page: number
  pageSize: number
  permissions: DirectoryPermissions
  onQueryChange: (value: string) => void
  onSortChange: (key: DirectorySortKey) => void
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  onOpen: (directoryId: string) => void
  onEditStructure: (directoryId: string) => void
  onDelete: (directory: DirectoryDefinition) => void
}) {
  const { t } = useTranslation()
  const pages = pageCount(total, pageSize)
  const sectionTitle = t(`directories.sections.${sectionId}`)
  const sortLabel = (key: DirectorySortKey) => {
    if (sortKey !== key) return ''
    return sortDirection === 'asc' ? ' ↑' : ' ↓'
  }

  return (
    <div className="min-w-0 flex-1 rounded-xl border border-border bg-card">
      <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-base font-semibold">{t('directories.list-title', { section: sectionTitle, count: total })}</h2>
        <Input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={t('directories.search')}
          aria-label={t('directories.search')}
          className="sm:max-w-xs"
        />
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <button type="button" className="font-medium" onClick={() => onSortChange('title')}>
                  {t('directories.column-name')}{sortLabel('title')}
                </button>
              </TableHead>
              <TableHead className="hidden md:table-cell">
                <button type="button" className="font-medium" onClick={() => onSortChange('section')}>
                  {t('directories.column-section')}{sortLabel('section')}
                </button>
              </TableHead>
              <TableHead className="hidden sm:table-cell">
                <button type="button" className="font-medium" onClick={() => onSortChange('status')}>
                  {t('directories.column-status')}{sortLabel('status')}
                </button>
              </TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                  {t('directories.empty-list')}
                </TableCell>
              </TableRow>
            ) : items.map((item) => {
              const sections = directorySections(item)
              const rowPermissions = item.permissions ?? permissions
              const extraSections = sections.length - 1
              return (
                <TableRow key={item.id}>
                  <TableCell>
                    <button
                      type="button"
                      className="inline-flex max-w-full items-center gap-2 text-left font-medium text-primary hover:underline"
                      onClick={() => onOpen(item.id)}
                    >
                      <BookOpen className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="truncate">{item.title}</span>
                    </button>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <span>{t(`directories.sections.${primarySection(item)}`)}</span>
                    {extraSections > 0 ? (
                      <span className="ml-1 text-xs text-muted-foreground">{t('directories.more-sections', { count: extraSections })}</span>
                    ) : null}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <span className="inline-flex items-center gap-1.5 text-sm">
                      <span
                        className={`h-2 w-2 rounded-full ${item.archived ? 'bg-muted-foreground' : 'bg-emerald-500'}`}
                        aria-hidden
                      />
                      {item.archived ? t('directories.archived') : t('directories.definition-active')}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label={t('directories.actions.menu')}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onOpen(item.id)}>{t('directories.actions.open')}</DropdownMenuItem>
                        {rowPermissions.structure ? (
                          <DropdownMenuItem onClick={() => onEditStructure(item.id)}>{t('directories.edit')}</DropdownMenuItem>
                        ) : null}
                        {rowPermissions.delete && canDeleteDirectoryDefinition(item) ? (
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => onDelete(item)}
                          >
                            {t('directories.delete')}
                          </DropdownMenuItem>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span id="directories-page-size-label">{t('directories.page-size')}</span>
          <Select value={String(pageSize)} onValueChange={(value) => onPageSizeChange(Number(value))}>
            <SelectTrigger className="h-8 w-[4.5rem]" aria-labelledby="directories-page-size-label">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DIRECTORY_PAGE_SIZES.map((size) => (
                <SelectItem key={size} value={String(size)}>{size}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm tabular-nums text-muted-foreground">{page} / {pages}</span>
          <Button type="button" variant="outline" size="sm" disabled={page >= pages} onClick={() => onPageChange(page + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
