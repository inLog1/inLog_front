import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { personnelError, useDeleteDirectoryDefinitionMutation } from '../../../entities/personnel'
import type { DirectoryDefinition, DirectoryPermissions } from '../../../entities/personnel/model/types'
import type { DirectoryView } from '../../../entities/personnel/model/personnelApi'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../shared/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../shared/ui/select'
import {
  DIRECTORY_SECTION_IDS,
  type DirectorySectionId,
} from '../model/directory-sections'
import {
  filterDirectoryList,
  paginateDirectories,
  sortDirectories,
  type DirectorySortKey,
  type SortDirection,
} from '../model/directory-list'
import { DirectoryCategorySidebar } from './DirectoryCategorySidebar'
import { DirectoriesTable } from './DirectoriesTable'

export function DirectoriesWorkspace({
  organizationId,
  directories,
  permissions,
  onOpen,
  onEditStructure,
  onDeleted,
}: {
  organizationId: number
  directories: DirectoryView[]
  permissions: DirectoryPermissions
  onOpen: (directoryId: string) => void
  onEditStructure: (directoryId: string) => void
  onDeleted?: (directoryId: string) => void
}) {
  const { t } = useTranslation()
  const [pendingDelete, setPendingDelete] = useState<DirectoryDefinition | null>(null)
  const [deleteError, setDeleteError] = useState('')
  const [removeDefinition, deleteState] = useDeleteDirectoryDefinitionMutation()
  const [sectionId, setSectionId] = useState<DirectorySectionId>('all')
  const [sectionQuery, setSectionQuery] = useState('')
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<DirectorySortKey>('title')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  useEffect(() => {
    setPage(1)
  }, [sectionId, query, pageSize])

  const filtered = useMemo(
    () => sortDirectories(filterDirectoryList(directories, sectionId, query), sortKey, sortDirection),
    [directories, query, sectionId, sortDirection, sortKey],
  )
  const pageItems = paginateDirectories(filtered, page, pageSize)

  const onSortChange = (key: DirectorySortKey) => {
    if (sortKey === key) setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDirection('asc')
    }
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return
    setDeleteError('')
    try {
      await removeDefinition({
        organizationId,
        directoryId: pendingDelete.id,
        expectedRevision: pendingDelete.revision,
      }).unwrap()
      toast.success(t('directories.delete-definition-done'))
      onDeleted?.(pendingDelete.id)
      setPendingDelete(null)
    } catch (caught) {
      setDeleteError(t(`directories.errors.${personnelError(caught).code}`, { defaultValue: t('directories.errors.generic') }))
    }
  }

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <div className="lg:hidden">
        <label className="grid gap-1 text-sm">
          {t('directories.sections-nav')}
          <Select value={sectionId} onValueChange={(value) => setSectionId(value as DirectorySectionId)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DIRECTORY_SECTION_IDS.map((id) => (
                <SelectItem key={id} value={id}>{t(`directories.sections.${id}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      </div>
      <div className="hidden lg:block">
        <DirectoryCategorySidebar
          directories={directories}
          sectionId={sectionId}
          sectionQuery={sectionQuery}
          onSectionChange={setSectionId}
          onSectionQueryChange={setSectionQuery}
        />
      </div>
      <DirectoriesTable
        items={pageItems}
        total={filtered.length}
        sectionId={sectionId}
        query={query}
        sortKey={sortKey}
        sortDirection={sortDirection}
        page={page}
        pageSize={pageSize}
        permissions={permissions}
        onQueryChange={setQuery}
        onSortChange={onSortChange}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        onOpen={onOpen}
        onEditStructure={onEditStructure}
        onDelete={(directory) => {
          setDeleteError('')
          setPendingDelete(directory)
        }}
      />
      <AlertDialog open={pendingDelete != null} onOpenChange={(open) => { if (!open) { setPendingDelete(null); setDeleteError('') } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('directories.delete-definition-title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('directories.delete-definition-body', { title: pendingDelete?.title ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError ? <p className="text-sm text-destructive" role="alert">{deleteError}</p> : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteState.isLoading}>{t('directories.cancel')}</AlertDialogCancel>
            <AlertDialogAction disabled={deleteState.isLoading} onClick={(event) => { event.preventDefault(); void confirmDelete() }}>
              {t('directories.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
