import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { personnelError, useDeleteDirectoryDefinitionMutation, useUpdateDirectoryDefinitionMutation } from '../../../entities/personnel'
import type { DirectoryCatalogSection, DirectoryPermissions } from '../../../entities/personnel/model/types'
import type { DirectoryView } from '../../../entities/personnel/model/personnelApi'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../shared/ui/alert-dialog'
import { Button } from '../../../shared/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../shared/ui/select'
import { fieldWrite } from '../model/attribute-catalog'
import { canDeleteDirectoryDefinition } from '../model/directory-metadata'
import {
  DIRECTORY_SECTION_IDS,
  directoryCatalogSections,
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
import { MembershipChoices } from './membership-choices'

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
  const [pendingDelete, setPendingDelete] = useState<DirectoryView | null>(null)
  const [removeSectionIds, setRemoveSectionIds] = useState<DirectoryCatalogSection[]>([])
  const [deleteError, setDeleteError] = useState('')
  const [removeDefinition, deleteState] = useDeleteDirectoryDefinitionMutation()
  const [updateDefinition, updateState] = useUpdateDirectoryDefinitionMutation()
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

  const membership = pendingDelete ? directoryCatalogSections(pendingDelete) : []
  const keptSections = membership.filter((section) => !removeSectionIds.includes(section))
  const canFullDelete = pendingDelete
    ? canDeleteDirectoryDefinition(pendingDelete) && (pendingDelete.permissions?.delete ?? permissions.delete)
    : false
  const canTrim = Boolean(pendingDelete && (pendingDelete.permissions?.structure ?? permissions.structure))
  const partialReady = canTrim && removeSectionIds.length > 0 && keptSections.length > 0
  const busy = deleteState.isLoading || updateState.isLoading

  const closeDelete = () => {
    setPendingDelete(null)
    setRemoveSectionIds([])
    setDeleteError('')
  }

  const confirmFullDelete = async () => {
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
      closeDelete()
    } catch (caught) {
      setDeleteError(t(`directories.errors.${personnelError(caught).code}`, { defaultValue: t('directories.errors.generic') }))
    }
  }

  const confirmTrim = async () => {
    if (!pendingDelete || !partialReady) return
    setDeleteError('')
    try {
      await updateDefinition({
        directoryId: pendingDelete.id,
        body: {
          organizationId,
          expectedRevision: pendingDelete.revision,
          title: pendingDelete.title,
          description: pendingDelete.description,
          archived: pendingDelete.archived,
          fields: pendingDelete.fields.map(fieldWrite),
          sections: keptSections,
        },
      }).unwrap()
      toast.success(t('directories.delete-definition-trimmed'))
      closeDelete()
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
          setRemoveSectionIds(directoryCatalogSections(directory))
        }}
      />
      <AlertDialog open={pendingDelete != null} onOpenChange={(open) => { if (!open) closeDelete() }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('directories.delete-definition-title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('directories.delete-definition-places', { title: pendingDelete?.title ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {membership.length > 0 ? (
            <>
              <p id="directory-delete-sections" className="sr-only">{t('directories.definition-section')}</p>
              <MembershipChoices
                labelledBy="directory-delete-sections"
                disabled={!canTrim}
                value={removeSectionIds}
                onChange={(next) => setRemoveSectionIds(next.filter((section): section is DirectoryCatalogSection => membership.includes(section as DirectoryCatalogSection)))}
                options={membership.map((section) => ({
                  value: section,
                  label: t(`directories.sections.${section}`),
                }))}
              />
            </>
          ) : null}
          {!canFullDelete ? <p className="text-sm text-muted-foreground">{t('directories.delete-definition-system')}</p> : null}
          {deleteError ? <p className="text-sm text-destructive" role="alert">{deleteError}</p> : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{t('directories.cancel')}</AlertDialogCancel>
            {partialReady ? (
              <Button type="button" variant="outline" disabled={busy} onClick={() => void confirmTrim()}>
                {t('directories.delete-definition-selected')}
              </Button>
            ) : null}
            {canFullDelete ? (
              <Button type="button" variant="destructive" disabled={busy} onClick={() => void confirmFullDelete()}>
                {t('directories.delete-definition-everywhere')}
              </Button>
            ) : null}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
