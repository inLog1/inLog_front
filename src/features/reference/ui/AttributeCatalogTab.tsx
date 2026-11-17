import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ChevronLeft, ChevronRight, GripVertical, MoreHorizontal, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  personnelError,
  useDeleteDirectoryDefinitionMutation,
  useGetDirectoryQuery,
  useUpdateDirectoryDefinitionMutation,
} from '../../../entities/personnel'
import type { DirectoryDefinition, DirectoryField, DirectoryPermissions } from '../../../entities/personnel/model/types'
import type { DirectoryView } from '../../../entities/personnel/model/personnelApi'
import { cn } from '../../../shared/lib/utils'
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
import { TabButton } from '../../../shared/ui/tab-button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../shared/ui/table'
import {
  attributeDeleteBlock,
  attributePlacements,
  canAddAttribute,
  canDeleteAttribute,
  canDeleteAttributeGroup,
  canEditDirectoryStructure,
  canReorderAttributes,
  CATALOG_ALL_ID,
  fieldWrite,
  filterAllCatalogFields,
  filterCatalogDirectories,
  filterCatalogFields,
  flattenCatalogFields,
  isCatalogAllView,
  isProtectedCatalogField,
  isUserCatalogField,
  moveField,
  omitField,
  type CatalogFieldRow,
  type FieldWrite,
} from '../model/attribute-catalog'
import { DIRECTORY_PAGE_SIZES, pageCount, paginateDirectories, sortDirectories } from '../model/directory-list'
import { AttributeConstraintCell } from './AttributeConstraintCell'
import { AttributeEditorDialog } from './AttributeEditorDialog'
import { DirectoryAttributeSettings } from './DirectoryAttributeSettings'
import { MembershipChoices } from './membership-choices'

type PendingAttributeDelete = {
  fieldId: string
  bundleId?: string
  label: string
  removeDirectoryIds: string[]
}

function sameFieldIds(left: DirectoryField[], right: DirectoryField[]): boolean {
  if (left.length !== right.length) return false
  const ids = new Set(right.map((field) => field.id))
  return left.every((field) => ids.has(field.id))
}

export function AttributeCatalogTab({
  organizationId,
  directories,
  permissions,
  bindAddAttribute,
}: {
  organizationId: number
  directories: DirectoryView[]
  permissions: DirectoryPermissions
  bindAddAttribute?: (open: (() => void) | null) => void
}) {
  const { t } = useTranslation()
  const [search, setSearch] = useSearchParams()
  const [directoryQuery, setDirectoryQuery] = useState('')
  const [attributeQuery, setAttributeQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<number>(DIRECTORY_PAGE_SIZES[0])
  const [panel, setPanel] = useState<'attributes' | 'settings'>('attributes')
  const [editor, setEditor] = useState<null | { mode: 'create' } | { mode: 'edit'; fieldId: string }>(null)
  const [pendingDelete, setPendingDelete] = useState<PendingAttributeDelete | null>(null)
  const [actionError, setActionError] = useState('')
  const [draftOrder, setDraftOrder] = useState<DirectoryField[] | null>(null)
  const [focusDirectoryId, setFocusDirectoryId] = useState<string | null>(null)
  const [updateDefinition, updateState] = useUpdateDirectoryDefinitionMutation()
  const [removeDefinition] = useDeleteDirectoryDefinitionMutation()
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const sorted = useMemo(() => sortDirectories(directories, 'title', 'asc'), [directories])
  const visibleDirectories = useMemo(
    () => filterCatalogDirectories(sorted, directoryQuery),
    [directoryQuery, sorted],
  )
  const requestedCatalog = search.get('catalog')
  const isAllCatalog = isCatalogAllView(requestedCatalog, sorted)
  const selected = isAllCatalog
    ? null
    : sorted.find((item) => item.id === requestedCatalog) ?? sorted[0] ?? null
  const activeDetailId = isAllCatalog ? focusDirectoryId : selected?.id ?? null
  const detail = useGetDirectoryQuery(
    { organizationId, directoryId: activeDetailId ?? '' },
    { skip: activeDetailId == null },
  )
  const directory = !isAllCatalog && selected
    ? detail.currentData?.directory.id === selected.id ? detail.currentData.directory : selected
    : null
  const mutationDirectory = isAllCatalog
    ? (detail.currentData?.directory.id === focusDirectoryId
      ? detail.currentData.directory
      : sorted.find((item) => item.id === focusDirectoryId) ?? null)
    : directory
  const usageTarget = mutationDirectory ?? directory
  const usageKnown = detail.currentData?.directory.id === usageTarget?.id
  const records = usageKnown ? detail.currentData?.records ?? [] : []
  const usedFieldIds = usageKnown ? detail.currentData?.usedFieldIds ?? [] : []
  const usageRecords = records.length > 0 || usedFieldIds.length === 0
    ? records
    : usedFieldIds.map((id) => ({ values: { [id]: '1' } }))
  const activePermissions = (directory ?? mutationDirectory)?.permissions ?? permissions

  const canEdit = directory ? canEditDirectoryStructure(activePermissions) : false
  const canDelete = directory ? canDeleteAttribute(directory, activePermissions) : false
  const canDeleteGroup = directory ? canDeleteAttributeGroup(directory, activePermissions) : false
  const reorder = Boolean(directory)
    && !isAllCatalog
    && canReorderAttributes(activePermissions)
    && attributeQuery.trim() === ''
    && !updateState.isLoading
  const allAttributesCount = useMemo(
    () => sorted.reduce((total, item) => total + item.fields.length, 0),
    [sorted],
  )
  const allFieldRows = useMemo(() => flattenCatalogFields(sorted), [sorted])
  const visibleAllFields = useMemo(
    () => filterAllCatalogFields(allFieldRows, attributeQuery),
    [allFieldRows, attributeQuery],
  )
  const shownFields = draftOrder && directory && sameFieldIds(draftOrder, directory.fields)
    ? draftOrder
    : directory?.fields ?? []
  const visibleFields = filterCatalogFields(shownFields, attributeQuery)
  const listedCount = isAllCatalog ? visibleAllFields.length : visibleFields.length
  const pages = pageCount(listedCount, pageSize)
  const currentPage = Math.min(page, pages)
  const pagedAllFields = paginateDirectories(visibleAllFields, currentPage, pageSize)
  const pagedFields = paginateDirectories(visibleFields, currentPage, pageSize)
  const addableDirectories = useMemo(
    () => sorted.filter((item) => canAddAttribute(item, item.permissions ?? permissions)),
    [permissions, sorted],
  )
  const editingField = editor?.mode === 'edit'
    ? mutationDirectory?.fields.find((field) => field.id === editor.fieldId) ?? null
    : null

  const openCreateAttribute = useCallback(() => {
    if (addableDirectories.length === 0) return
    if (isAllCatalog && addableDirectories.length === 1) {
      setFocusDirectoryId(addableDirectories[0].id)
    }
    if (directory && canAddAttribute(directory, directory.permissions ?? permissions)) {
      setEditor({ mode: 'create' })
      return
    }
    if (isAllCatalog) {
      setEditor({ mode: 'create' })
    }
  }, [addableDirectories, directory, isAllCatalog, permissions])

  useEffect(() => {
    if (!bindAddAttribute) return
    bindAddAttribute(openCreateAttribute)
    return () => bindAddAttribute(null)
  }, [bindAddAttribute, openCreateAttribute])

  const errorText = (caught: unknown) => t(
    `directories.errors.${personnelError(caught).code}`,
    { defaultValue: t('directories.errors.generic') },
  )

  const submit = async (
    current: DirectoryDefinition,
    fields: FieldWrite[],
    message: string,
    patch?: { title: string; description: string; archived: boolean; sections?: string[] },
    announce = true,
  ) => {
    try {
      await updateDefinition({
        directoryId: current.id,
        body: {
          organizationId,
          expectedRevision: current.revision,
          title: patch?.title ?? current.title,
          description: patch?.description ?? current.description,
          archived: patch?.archived ?? current.archived,
          fields,
          ...(patch?.sections ? { sections: patch.sections } : {}),
        },
      }).unwrap()
      if (announce && message) toast.success(message)
    } catch (caught) {
      void detail.refetch()
      throw caught
    }
  }

  const onDragEnd = (event: DragEndEvent) => {
    if (!directory || !reorder) return
    const overId = event.over ? String(event.over.id) : ''
    if (!overId || event.active.id === overId) return
    const next = moveField(shownFields, String(event.active.id), overId)
    if (next === shownFields) return
    setDraftOrder(next)
    void submit(directory, next.map(fieldWrite), t('directories.catalog.reordered'))
      .then(() => setDraftOrder(null))
      .catch((caught: unknown) => {
        setDraftOrder(null)
        setActionError(errorText(caught))
      })
  }

  const deletePlacements = useMemo(() => {
    if (!pendingDelete) return []
    return attributePlacements(sorted, { id: pendingDelete.fieldId, bundleId: pendingDelete.bundleId })
  }, [pendingDelete, sorted])

  const blockForPlacement = (place: (typeof deletePlacements)[number]) => {
    if (isProtectedCatalogField(place.directory, place.field)) return 'registry' as const
    if (place.directory.id !== (usageTarget?.id ?? null)) return null
    return attributeDeleteBlock(place.directory, place.field, usageRecords, usageKnown)
  }
  const selectedDirectoryIds = (pendingDelete?.removeDirectoryIds ?? []).filter((id) => {
    const place = deletePlacements.find((item) => item.directory.id === id)
    if (!place) return false
    const block = blockForPlacement(place)
    return block == null || block === 'loading'
  })

  const openAttributeDelete = (originDirectoryId: string, field: DirectoryField) => {
    setActionError('')
    setFocusDirectoryId(originDirectoryId)
    setPendingDelete({
      fieldId: field.id,
      bundleId: field.bundleId,
      label: field.label,
      removeDirectoryIds: attributePlacements(sorted, field).map((place) => place.directory.id),
    })
  }

  const confirmAttributeDelete = async (everywhere: boolean) => {
    if (!pendingDelete) return
    const chosen = everywhere
      ? deletePlacements
      : deletePlacements.filter((place) => selectedDirectoryIds.includes(place.directory.id))
    const removable = chosen.filter((place) => blockForPlacement(place) == null)
    if (removable.length === 0) {
      setActionError(t('directories.catalog.delete-none'))
      return
    }
    const failures: string[] = []
    const succeeded: string[] = []
    for (const place of removable) {
      const fields = omitField(place.directory.fields, place.field.id)
      if (!fields) continue
      try {
        await submit(place.directory, fields, '', undefined, false)
        succeeded.push(place.directory.id)
      } catch (caught) {
        failures.push(t('directories.catalog.delete-blocked-line', {
          group: place.directory.title,
          reason: errorText(caught),
        }))
      }
    }
    if (failures.length > 0) {
      setActionError(failures.join(' '))
      setPendingDelete((current) => current ? {
        ...current,
        removeDirectoryIds: current.removeDirectoryIds.filter((id) => !succeeded.includes(id)),
      } : current)
      if (succeeded.length > 0) toast.success(t('directories.catalog.deleted-partial'))
      return
    }
    if (succeeded.length === 0) {
      setActionError(t('directories.catalog.delete-none'))
      return
    }
    const blockedLeft = deletePlacements.some((place) => blockForPlacement(place) != null)
    const removedAllSelected = everywhere || succeeded.length === deletePlacements.length
    toast.success(blockedLeft || !removedAllSelected
      ? t('directories.catalog.deleted-partial')
      : t('directories.catalog.deleted'))
    if (blockedLeft && everywhere) {
      const lines = deletePlacements
        .filter((place) => blockForPlacement(place) != null)
        .map((place) => t('directories.catalog.delete-blocked-line', {
          group: place.directory.title,
          reason: t(`directories.catalog.delete-${blockForPlacement(place)}`),
        }))
      setActionError(lines.join(' '))
      return
    }
    setPendingDelete(null)
  }

  const selectDirectory = (directoryId: string) => {
    const currentId = isAllCatalog ? CATALOG_ALL_ID : directory?.id
    if (directoryId !== currentId) {
      setAttributeQuery('')
      setPage(1)
      setPanel('attributes')
      setEditor(null)
      setPendingDelete(null)
      setActionError('')
      setDraftOrder(null)
      setFocusDirectoryId(null)
    }
    setSearch((prev) => {
      const next = new URLSearchParams(prev)
      next.set('catalog', directoryId)
      return next
    }, { replace: true })
  }

  const focusDirectoryForField = (directoryId: string) => {
    setFocusDirectoryId(directoryId)
  }

  return (
    <div className="min-w-0 space-y-4">
      {sorted.length === 0 ? (
        <PageState kind="empty" description={t('directories.catalog.empty-directories')} />
      ) : (
        <div className="flex min-w-0 flex-col gap-4 md:flex-row md:items-start">
          <aside className="hidden shrink-0 rounded-xl border border-border bg-card p-3 md:block md:w-[240px] lg:w-[320px]">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">{t('directories.catalog.directories')}</h3>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground">{sorted.length}</span>
            </div>
            <div className="relative mb-3">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                value={directoryQuery}
                onChange={(event) => setDirectoryQuery(event.target.value)}
                placeholder={t('directories.catalog.search-directory')}
                aria-label={t('directories.catalog.search-directory')}
                className="pl-8"
              />
            </div>
            <div className="max-h-[calc(100vh-18rem)] space-y-1 overflow-y-auto pr-1">
              <button
                type="button"
                onClick={() => selectDirectory(CATALOG_ALL_ID)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm',
                  isAllCatalog ? 'bg-primary/10 font-medium' : 'hover:bg-muted/60',
                )}
                aria-current={isAllCatalog ? 'true' : undefined}
              >
                <span className="min-w-0 flex-1 truncate">{t('directories.catalog.all-attributes')}</span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{allAttributesCount}</span>
              </button>
              {visibleDirectories.length === 0 ? (
                <p className="px-2 py-6 text-sm text-muted-foreground">{t('directories.catalog.empty-search')}</p>
              ) : visibleDirectories.map((item) => {
                const active = !isAllCatalog && item.id === directory?.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectDirectory(item.id)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm',
                      active ? 'bg-primary/10 font-medium' : 'hover:bg-muted/60',
                    )}
                    aria-current={active ? 'true' : undefined}
                  >
                    <span className="min-w-0 flex-1 truncate">{item.title}</span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{item.fields.length}</span>
                  </button>
                )
              })}
            </div>
          </aside>

          <section className="min-w-0 flex-1 rounded-xl border border-border bg-card p-4">
            <div className="mb-4 md:hidden">
              <LabelledSelect
                label={t('directories.catalog.directories')}
                value={isAllCatalog ? CATALOG_ALL_ID : directory?.id ?? CATALOG_ALL_ID}
                onChange={selectDirectory}
                options={[
                  { value: CATALOG_ALL_ID, label: t('directories.catalog.all-attributes') },
                  ...sorted.map((item) => ({ value: item.id, label: item.title })),
                ]}
              />
            </div>
            {!isAllCatalog && directory ? (
              <div className="flex gap-4 border-b border-border" role="tablist" aria-label={directory.title}>
                <TabButton active={panel === 'attributes'} onClick={() => setPanel('attributes')}>
                  {t('directories.catalog.tabs.attributes', { count: directory.fields.length })}
                </TabButton>
                <TabButton active={panel === 'settings'} onClick={() => setPanel('settings')}>
                  {t('directories.catalog.tabs.settings')}
                </TabButton>
              </div>
            ) : null}

            {panel === 'settings' && directory && !isAllCatalog ? (
              <div className="pt-4">
                <DirectoryAttributeSettings
                  key={directory.id}
                  directory={directory}
                  canEdit={canEdit}
                  canDelete={canDeleteGroup}
                  onSave={async (patch) => {
                    await submit(directory, directory.fields.map(fieldWrite), t('directories.catalog.settings-saved'), patch)
                  }}
                  onDelete={async () => {
                    await removeDefinition({
                      organizationId,
                      directoryId: directory.id,
                      expectedRevision: directory.revision,
                    }).unwrap()
                    toast.success(t('directories.catalog.delete-group-done'))
                    selectDirectory(CATALOG_ALL_ID)
                  }}
                />
              </div>
            ) : (
              <div className={cn('space-y-3', !isAllCatalog && directory ? 'pt-4' : undefined)}>
                <div className="relative min-w-0">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                  <Input
                    value={attributeQuery}
                    onChange={(event) => {
                      setAttributeQuery(event.target.value)
                      setPage(1)
                    }}
                    placeholder={t('directories.catalog.search-attribute')}
                    aria-label={t('directories.catalog.search-attribute')}
                    className="pl-8"
                  />
                </div>
                {actionError ? <p className="text-sm text-destructive" role="alert">{actionError}</p> : null}
                {isAllCatalog ? (
                  visibleAllFields.length === 0 ? (
                    <PageState
                      kind="empty"
                      description={attributeQuery.trim()
                        ? t('directories.catalog.empty-attribute-search')
                        : t('directories.catalog.empty-attributes')}
                    />
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t('directories.catalog.columns.group')}</TableHead>
                          <TableHead>{t('directories.catalog.columns.name')}</TableHead>
                          <TableHead>{t('directories.catalog.columns.type')}</TableHead>
                          <TableHead>{t('directories.catalog.columns.constraints')}</TableHead>
                          <TableHead>{t('directories.catalog.columns.required')}</TableHead>
                          <TableHead>{t('directories.catalog.columns.status')}</TableHead>
                          <TableHead className="w-12"><span className="sr-only">{t('directories.catalog.columns.actions')}</span></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pagedAllFields.map((row) => {
                          const rowDirectory = sorted.find((item) => item.id === row.directoryId)
                          if (!rowDirectory) return null
                          const rowPermissions = rowDirectory.permissions ?? permissions
                          const rowCanEdit = canEditDirectoryStructure(rowPermissions)
                          const rowCanDelete = canDeleteAttribute(rowDirectory, rowPermissions)
                          const rowUsageKnown = focusDirectoryId === row.directoryId && usageKnown
                          const rowBlock = attributeDeleteBlock(rowDirectory, row.field, usageRecords, rowUsageKnown)
                          const linked = attributePlacements(sorted, row.field)
                          const canOpenDelete = rowBlock == null || linked.some((place) =>
                            place.directory.id !== row.directoryId && !isProtectedCatalogField(place.directory, place.field),
                          )
                          return (
                            <AllAttributeRow
                              key={`${row.directoryId}:${row.field.id}`}
                              row={row}
                              protectedField={isProtectedCatalogField(rowDirectory, row.field)}
                              userField={isUserCatalogField(row.field)}
                              canEdit={rowCanEdit}
                              canDelete={rowCanDelete}
                              deleteBlock={canOpenDelete ? null : rowBlock}
                              onEdit={() => {
                                focusDirectoryForField(row.directoryId)
                                setEditor({ mode: 'edit', fieldId: row.field.id })
                              }}
                              onDelete={() => openAttributeDelete(row.directoryId, row.field)}
                            />
                          )
                        })}
                      </TableBody>
                    </Table>
                  )
                ) : visibleFields.length === 0 ? (
                  <PageState
                    kind="empty"
                    description={attributeQuery.trim()
                      ? t('directories.catalog.empty-attribute-search')
                      : t('directories.catalog.empty-attributes')}
                  />
                ) : (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    modifiers={[restrictToVerticalAxis]}
                    onDragEnd={onDragEnd}
                  >
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-px px-1">
                            <span className="sr-only">{t('directories.catalog.reorder-handle')}</span>
                          </TableHead>
                          <TableHead>{t('directories.catalog.columns.name')}</TableHead>
                          <TableHead>{t('directories.catalog.columns.type')}</TableHead>
                          <TableHead>{t('directories.catalog.columns.constraints')}</TableHead>
                          <TableHead>{t('directories.catalog.columns.required')}</TableHead>
                          <TableHead>{t('directories.catalog.columns.status')}</TableHead>
                          <TableHead className="w-12"><span className="sr-only">{t('directories.catalog.columns.actions')}</span></TableHead>
                        </TableRow>
                      </TableHeader>
                      <SortableContext items={pagedFields.map((field) => field.id)} strategy={verticalListSortingStrategy}>
                        <TableBody>
                          {pagedFields.map((field) => {
                            const fieldBlock = attributeDeleteBlock(directory!, field, usageRecords, usageKnown)
                            const linked = attributePlacements(sorted, field)
                            const canOpenDelete = fieldBlock == null || linked.some((place) =>
                              place.directory.id !== directory!.id && !isProtectedCatalogField(place.directory, place.field),
                            )
                            return (
                              <AttributeRow
                                key={field.id}
                                field={field}
                                protectedField={isProtectedCatalogField(directory!, field)}
                                userField={isUserCatalogField(field)}
                                reorder={reorder}
                                canEdit={canEdit}
                                canDelete={canDelete}
                                deleteBlock={canOpenDelete ? null : fieldBlock}
                                onEdit={() => setEditor({ mode: 'edit', fieldId: field.id })}
                                onDelete={() => openAttributeDelete(directory!.id, field)}
                              />
                            )
                          })}
                        </TableBody>
                      </SortableContext>
                    </Table>
                  </DndContext>
                )}
                {listedCount > 0 ? (
                  <AttributeCatalogPager
                    page={currentPage}
                    pages={pages}
                    pageSize={pageSize}
                    onPageChange={setPage}
                    onPageSizeChange={(size) => {
                      setPageSize(size)
                      setPage(1)
                    }}
                  />
                ) : null}
              </div>
            )}
          </section>
        </div>
      )}

      {editor && (editor.mode === 'create' || (mutationDirectory && editingField)) ? (
        <AttributeEditorDialog
          key={editor.mode === 'create' ? 'create' : editor.fieldId}
          organizationId={organizationId}
          directories={addableDirectories}
          directory={editor.mode === 'edit' ? mutationDirectory : null}
          field={editor.mode === 'edit' ? editingField : null}
          initialDirectoryId={mutationDirectory?.id ?? directory?.id ?? addableDirectories[0]?.id ?? ''}
          onClose={() => setEditor(null)}
          onSubmit={async (target, fields, announce = true) => {
            if (editor.mode === 'create' && target.id !== focusDirectoryId) {
              setFocusDirectoryId(target.id)
            }
            await submit(
              target,
              fields,
              editor.mode === 'create' ? t('directories.catalog.created') : t('directories.catalog.saved'),
              undefined,
              announce,
            )
          }}
        />
      ) : null}

      <AlertDialog open={pendingDelete != null} onOpenChange={(open) => { if (!open) { setPendingDelete(null); setActionError('') } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('directories.catalog.delete-title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('directories.catalog.delete-places', { name: pendingDelete?.label ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deletePlacements.length > 0 ? (
            <>
              <p id="attribute-delete-groups" className="sr-only">{t('directories.catalog.field-group')}</p>
              <MembershipChoices
                labelledBy="attribute-delete-groups"
                value={selectedDirectoryIds}
                onChange={(removeDirectoryIds) => setPendingDelete((current) => current ? { ...current, removeDirectoryIds } : current)}
                options={deletePlacements.map((place) => {
                  const block = blockForPlacement(place)
                  return {
                    value: place.directory.id,
                    label: place.directory.title,
                    disabled: block != null && block !== 'loading',
                    hint: block ? t(`directories.catalog.delete-${block}`) : undefined,
                  }
                })}
              />
            </>
          ) : null}
          {actionError ? <p className="text-sm text-destructive" role="alert">{actionError}</p> : null}
          <AlertDialogFooter>
            <AlertDialogCancel>{t('directories.cancel')}</AlertDialogCancel>
            {selectedDirectoryIds.length > 0
              && selectedDirectoryIds.length < deletePlacements.filter((place) => blockForPlacement(place) == null).length ? (
              <Button
                type="button"
                variant="outline"
                disabled={updateState.isLoading || deletePlacements.some((place) => blockForPlacement(place) === 'loading')}
                onClick={() => void confirmAttributeDelete(false)}
              >
                {t('directories.catalog.delete-selected')}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="destructive"
              disabled={
                updateState.isLoading
                || deletePlacements.some((place) => blockForPlacement(place) === 'loading')
                || deletePlacements.every((place) => blockForPlacement(place) != null)
              }
              onClick={() => void confirmAttributeDelete(true)}
            >
              {t('directories.catalog.delete-everywhere')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function LabelledSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
}) {
  return (
    <label className="grid gap-1 text-sm">
      {label}
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  )
}

function AllAttributeRow({
  row,
  protectedField,
  userField,
  canEdit,
  canDelete,
  deleteBlock,
  onEdit,
  onDelete,
}: {
  row: CatalogFieldRow
  protectedField: boolean
  userField: boolean
  canEdit: boolean
  canDelete: boolean
  deleteBlock: ReturnType<typeof attributeDeleteBlock>
  onEdit: () => void
  onDelete: () => void
}) {
  const { t } = useTranslation()
  const { field } = row
  return (
    <TableRow>
      <TableCell className="text-muted-foreground">{row.directoryTitle}</TableCell>
      <TableCell className="font-medium">{field.label}</TableCell>
      <TableCell>{t(`directories.catalog.types.${field.type}`, { defaultValue: field.type })}</TableCell>
      <TableCell><AttributeConstraintCell field={field} /></TableCell>
      <TableCell>
        <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs">
          {field.required ? t('directories.value-yes') : t('directories.value-no')}
        </span>
      </TableCell>
      <TableCell>
        <span className="flex flex-wrap items-center gap-1">
          <span className={cn(
            'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
            field.archived ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary',
          )}>
            {field.archived ? t('directories.catalog.state-archived') : t('directories.catalog.state-active')}
          </span>
          {protectedField ? (
            <span className="inline-flex rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
              {t('directories.catalog.system')}
            </span>
          ) : null}
          {userField ? (
            <span className="inline-flex rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
              {t('directories.catalog.custom')}
            </span>
          ) : null}
        </span>
      </TableCell>
      <TableCell className="text-right">
        {canEdit || canDelete ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="icon" aria-label={t('directories.actions.menu')}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canEdit ? <DropdownMenuItem onSelect={onEdit}>{t('directories.catalog.edit')}</DropdownMenuItem> : null}
              {canDelete ? (
                <DropdownMenuItem
                  disabled={deleteBlock != null}
                  className="text-destructive focus:text-destructive"
                  title={deleteBlock ? t(`directories.catalog.delete-${deleteBlock}`) : undefined}
                  onSelect={onDelete}
                >
                  {t('directories.catalog.delete')}
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </TableCell>
    </TableRow>
  )
}

function AttributeCatalogPager({
  page,
  pages,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: {
  page: number
  pages: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-3 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span id="attribute-catalog-page-size-label">{t('directories.page-size')}</span>
        <Select value={String(pageSize)} onValueChange={(value) => onPageSizeChange(Number(value))}>
          <SelectTrigger className="h-8 w-[4.5rem]" aria-labelledby="attribute-catalog-page-size-label">
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
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page <= 1}
          aria-label={t('buttons.previous')}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm tabular-nums text-muted-foreground">{page} / {pages}</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page >= pages}
          aria-label={t('buttons.next')}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

function AttributeRow({
  field,
  protectedField,
  userField,
  reorder,
  canEdit,
  canDelete,
  deleteBlock,
  onEdit,
  onDelete,
}: {
  field: DirectoryField
  protectedField: boolean
  userField: boolean
  reorder: boolean
  canEdit: boolean
  canDelete: boolean
  deleteBlock: ReturnType<typeof attributeDeleteBlock>
  onEdit: () => void
  onDelete: () => void
}) {
  const { t } = useTranslation()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field.id,
    disabled: !reorder,
  })
  return (
    <TableRow
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? 'bg-muted/40' : undefined}
      data-state={isDragging ? 'selected' : undefined}
    >
      <TableCell className="w-px px-1">
        <button
          type="button"
          className={cn(
            'inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground',
            reorder ? 'cursor-grab hover:bg-muted active:cursor-grabbing' : 'cursor-default opacity-40',
          )}
          aria-label={t('directories.catalog.reorder-handle')}
          disabled={!reorder}
          {...(reorder ? attributes : {})}
          {...(reorder ? listeners : {})}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </TableCell>
      <TableCell className="font-medium">{field.label}</TableCell>
      <TableCell>{t(`directories.catalog.types.${field.type}`, { defaultValue: field.type })}</TableCell>
      <TableCell><AttributeConstraintCell field={field} /></TableCell>
      <TableCell>
        <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs">
          {field.required ? t('directories.value-yes') : t('directories.value-no')}
        </span>
      </TableCell>
      <TableCell>
        <span className="flex flex-wrap items-center gap-1">
          <span className={cn(
            'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
            field.archived ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary',
          )}>
            {field.archived ? t('directories.catalog.state-archived') : t('directories.catalog.state-active')}
          </span>
          {protectedField ? (
            <span className="inline-flex rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
              {t('directories.catalog.system')}
            </span>
          ) : null}
          {userField ? (
            <span className="inline-flex rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
              {t('directories.catalog.custom')}
            </span>
          ) : null}
        </span>
      </TableCell>
      <TableCell className="text-right">
        {canEdit || canDelete ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="icon" aria-label={t('directories.actions.menu')}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canEdit ? <DropdownMenuItem onSelect={onEdit}>{t('directories.catalog.edit')}</DropdownMenuItem> : null}
              {canDelete ? (
                <DropdownMenuItem
                  disabled={deleteBlock != null}
                  className="text-destructive focus:text-destructive"
                  title={deleteBlock ? t(`directories.catalog.delete-${deleteBlock}`) : undefined}
                  onSelect={onDelete}
                >
                  {t('directories.catalog.delete')}
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </TableCell>
    </TableRow>
  )
}
