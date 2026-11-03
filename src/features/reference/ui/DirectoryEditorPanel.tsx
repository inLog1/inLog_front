import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useSearchParams } from 'react-router-dom'
import {
  personnelError,
  useArchiveDirectoryRecordMutation,
  useDeleteDirectoryRecordMutation,
} from '../../../entities/personnel'
import type { DirectoryDefinition, DirectoryPermissions } from '../../../entities/personnel/model/types'
import type { DirectoryRecord } from '../../../entities/personnel/model/personnelApi'
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
import { Button } from '../../../shared/ui/button'
import { Input } from '../../../shared/ui/input'
import { referenceModuleHref } from '../model/reference-navigation'
import { PageHeader, PageHeading, PageState } from '../../../shared/ui/page'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../shared/ui/table'
import { RecordDialog, StructureDialog } from './directory-dialogs'

export function DirectoryEditorPanel({
  organizationId,
  directory,
  records,
  permissions,
}: {
  organizationId: number
  directory: DirectoryDefinition
  records: DirectoryRecord[]
  permissions: DirectoryPermissions
}) {
  const { t } = useTranslation()
  const location = useLocation()
  const [search] = useSearchParams()
  const listHref = useMemo(
    () => referenceModuleHref(location.pathname, search, 'without-directory'),
    [location.pathname, search],
  )
  const [recordQuery, setRecordQuery] = useState('')
  const [editing, setEditing] = useState<DirectoryRecord | 'new' | null>(null)
  const [pendingDelete, setPendingDelete] = useState<DirectoryRecord | null>(null)
  const [structure, setStructure] = useState(false)
  const [error, setError] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [archiveRecord] = useArchiveDirectoryRecordMutation()
  const [removeRecord, removeState] = useDeleteDirectoryRecordMutation()
  const needle = recordQuery.trim().toLowerCase()
  const shown = records.filter((record) => !needle || record.label.toLowerCase().includes(needle))

  const run = async (action: Promise<unknown>) => {
    setError('')
    try {
      await action
    } catch (caught) {
      setError(t(`directories.errors.${personnelError(caught).code}`, { defaultValue: t('directories.errors.generic') }))
    }
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return
    setDeleteError('')
    try {
      await removeRecord({
        organizationId,
        directoryId: directory.id,
        recordId: pendingDelete.id,
        expectedRevision: pendingDelete.revision,
      }).unwrap()
      setPendingDelete(null)
    } catch (caught) {
      setDeleteError(t(`directories.errors.${personnelError(caught).code}`, { defaultValue: t('directories.errors.generic') }))
    }
  }

  return (
    <div className="min-w-0 space-y-3">
      <PageHeading>{directory.title}</PageHeading>
      <PageHeader
        breadcrumbs={[
          { label: t('nav.reference'), to: listHref },
          { label: directory.title },
        ]}
        title={directory.title}
        description={directory.source.type === 'registry'
          ? [t('directories.system-note'), directory.description].filter(Boolean).join(' ')
          : directory.description || undefined}
        actions={(
          <>
            {permissions.structure ? <Button type="button" variant="outline" onClick={() => setStructure(true)}>{t('directories.edit-definition')}</Button> : null}
            {permissions.create && !directory.archived ? <Button type="button" onClick={() => setEditing('new')}>{t('directories.add-record')}</Button> : null}
          </>
        )}
      />
      {directory.source.type === 'registry' ? (
        <p className="text-sm font-medium text-foreground">{t('directories.system-badge')}</p>
      ) : null}
      {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
      <div className="min-w-0 rounded-xl border border-border bg-card">
        <div className="border-b border-border p-4">
          <Input
            value={recordQuery}
            onChange={(event) => setRecordQuery(event.target.value)}
            placeholder={t('directories.search-records')}
            aria-label={t('directories.search-records')}
            className="sm:max-w-xs"
          />
        </div>
        {shown.length === 0 ? (
          <div className="p-4">
            <PageState kind="empty" description={t('directories.empty-records')} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('directories.column-value')}</TableHead>
                  <TableHead>{t('directories.column-state')}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>
                      {record.label}
                      {record.code ? <span className="ml-2 text-muted-foreground">{record.code}</span> : null}
                    </TableCell>
                    <TableCell>{record.archived ? t('directories.archived') : t('directories.active')}</TableCell>
                    <TableCell className="space-x-2 text-right">
                      {permissions.update ? <Button type="button" variant="outline" size="sm" onClick={() => setEditing(record)}>{t('directories.edit')}</Button> : null}
                      {permissions.archive ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void run(archiveRecord({
                            directoryId: directory.id,
                            recordId: record.id,
                            body: { organizationId, expectedRevision: record.revision, archived: !record.archived },
                          }).unwrap())}
                        >
                          {record.archived ? t('directories.restore') : t('directories.archive')}
                        </Button>
                      ) : null}
                      {permissions.delete ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setDeleteError('')
                            setPendingDelete(record)
                          }}
                        >
                          {t('directories.delete')}
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
      <RecordDialog
        open={editing != null}
        organizationId={organizationId}
        directory={directory}
        records={records}
        record={editing != null && editing !== 'new' ? editing : null}
        onClose={() => setEditing(null)}
      />
      <AlertDialog open={pendingDelete != null} onOpenChange={(open) => { if (!open) { setPendingDelete(null); setDeleteError('') } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('directories.delete-record-title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('directories.delete-record-body', { name: pendingDelete?.label ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError ? <p className="text-sm text-destructive" role="alert">{deleteError}</p> : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeState.isLoading}>{t('directories.cancel')}</AlertDialogCancel>
            <AlertDialogAction disabled={removeState.isLoading} onClick={(event) => { event.preventDefault(); void confirmDelete() }}>
              {t('directories.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <StructureDialog
        open={structure}
        organizationId={organizationId}
        directory={directory}
        onClose={() => setStructure(false)}
      />
    </div>
  )
}
