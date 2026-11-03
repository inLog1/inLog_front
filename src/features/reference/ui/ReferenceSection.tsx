import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import {
  personnelError,
  useGetDirectoriesQuery,
  useGetDirectoryQuery,
  useInitializePersonnelWorkspaceMutation,
} from '../../../entities/personnel'
import { Button } from '../../../shared/ui/button'
import { PageState } from '../../../shared/ui/page'
import { TabButton } from '../../../shared/ui/tab-button'
import type { DirectoryPermissions } from '../../../entities/personnel/model/types'
import { canAddAttribute } from '../model/attribute-catalog'
import { sortDirectories } from '../model/directory-list'
import { AttributeCatalogTab } from './AttributeCatalogTab'
import { DirectoriesWorkspace } from './DirectoriesWorkspace'
import { DirectoryEditorPanel } from './DirectoryEditorPanel'
import { CreateDirectoryDialog, StructureDialog } from './directory-dialogs'

export function ReferenceSection({ organizationId, scopeLabel }: { organizationId: number; scopeLabel?: string }) {
  const { t } = useTranslation()
  const [search, setSearch] = useSearchParams()
  const list = useGetDirectoriesQuery({ organizationId })
  const [initialize, initializeState] = useInitializePersonnelWorkspaceMutation()
  const [structureDirectoryId, setStructureDirectoryId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  const tab = search.get('tab') === 'attributes' ? 'attributes' : 'directories'
  const openDirectoryId = search.get('directory')
  const directories = list.data?.directories ?? []
  const structureDirectory = structureDirectoryId
    ? directories.find((item) => item.id === structureDirectoryId) ?? null
    : null

  const detail = useGetDirectoryQuery(
    { organizationId, directoryId: openDirectoryId ?? '' },
    { skip: openDirectoryId == null },
  )

  const setTab = (value: string) => {
    setSearch((prev) => {
      const next = new URLSearchParams(prev)
      if (value === 'directories') next.delete('tab')
      else next.set('tab', value)
      next.delete('directory')
      return next
    }, { replace: true })
  }

  const openDirectory = (directoryId: string) => {
    setSearch((prev) => {
      const next = new URLSearchParams(prev)
      next.set('directory', directoryId)
      if (tab === 'attributes') next.set('tab', 'attributes')
      return next
    }, { replace: true })
  }

  const closeDirectory = () => {
    setSearch((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('directory')
      return next
    }, { replace: true })
  }

  const permissions: DirectoryPermissions = list.data?.permissions ?? {
    read: false,
    create: false,
    update: false,
    archive: false,
    delete: false,
    structure: false,
    schemaRead: false,
    schemaCreate: false,
    schemaUpdate: false,
    schemaDelete: false,
  }
  const catalogDirectories = useMemo(
    () => sortDirectories(directories, 'title', 'asc'),
    [directories],
  )
  const catalogId = search.get('catalog')
  const catalogDirectory = catalogDirectories.find((item) => item.id === catalogId) ?? catalogDirectories[0] ?? null
  const catalogCanAdd = catalogDirectory != null && canAddAttribute(catalogDirectory, catalogDirectory.permissions ?? permissions)
  const openAddAttribute = useRef<(() => void) | null>(null)
  const bindAddAttribute = useCallback((open: (() => void) | null) => {
    openAddAttribute.current = open
  }, [])

  useEffect(() => {
    if (openDirectoryId == null) return
    if (directories.some((item) => item.id === openDirectoryId)) return
    closeDirectory()
  }, [directories, openDirectoryId])

  if (list.isLoading) return <PageState kind="loading" description={t('directories.loading')} />
  if (list.isError) {
    return (
      <PageState
        kind="error"
        description={t(`directories.errors.${personnelError(list.error).code}`, { defaultValue: t('directories.errors.generic') })}
        action={<Button type="button" variant="outline" onClick={() => void list.refetch()}>{t('workspace.retry')}</Button>}
      />
    )
  }
  if (list.data && !list.data.initialized) {
    return (
      <section className="space-y-4">
        <PageState
          kind="empty"
          description={t('directories.missing')}
          action={list.data.canInitialize ? (
            <Button type="button" disabled={initializeState.isLoading} onClick={() => void initialize({ organizationId })}>
              {t('directories.prepare')}
            </Button>
          ) : undefined}
        />
      </section>
    )
  }

  return (
    <section className="space-y-4">
      {openDirectoryId == null ? (
        <div className="min-w-0 space-y-4">
          <div className="flex flex-col gap-3 border-b border-border sm:flex-row sm:items-end sm:justify-between">
            <div className="flex gap-4" role="tablist" aria-label={t('nav.reference')}>
              <TabButton active={tab === 'directories'} onClick={() => setTab('directories')}>
                {t('directories.tabs.directories')}
              </TabButton>
              <TabButton active={tab === 'attributes'} onClick={() => setTab('attributes')}>
                {t('directories.tabs.attributes')}
              </TabButton>
            </div>
            {tab === 'directories' && permissions.structure ? (
              <div className="pb-2">
                <Button type="button" className="shrink-0" onClick={() => setCreateOpen(true)}>
                  <Plus className="h-4 w-4" />
                  {t('directories.create')}
                </Button>
              </div>
            ) : null}
            {tab === 'attributes' && catalogCanAdd ? (
              <div className="pb-2">
                <Button
                  type="button"
                  className="shrink-0"
                  onClick={() => openAddAttribute.current?.()}
                >
                  <Plus className="h-4 w-4" />
                  {t('directories.catalog.add')}
                </Button>
              </div>
            ) : null}
          </div>
          {tab === 'directories' ? (
            <DirectoriesWorkspace
              organizationId={organizationId}
              directories={directories}
              permissions={permissions}
              onOpen={openDirectory}
              onEditStructure={(directoryId) => setStructureDirectoryId(directoryId)}
              onDeleted={(directoryId) => {
                if (openDirectoryId === directoryId) closeDirectory()
                if (structureDirectoryId === directoryId) setStructureDirectoryId(null)
              }}
            />
          ) : (
            <AttributeCatalogTab
              organizationId={organizationId}
              directories={directories}
              permissions={permissions}
              scopeLabel={scopeLabel}
              bindAddAttribute={bindAddAttribute}
            />
          )}
        </div>
      ) : null}

      {openDirectoryId != null ? (
        detail.isLoading ? (
          <PageState kind="loading" description={t('directories.loading')} />
        ) : detail.data ? (
          <DirectoryEditorPanel
            organizationId={organizationId}
            directory={detail.data.directory}
            records={detail.data.records}
            permissions={detail.data.permissions}
          />
        ) : detail.isError ? (
          <PageState
            kind="error"
            description={t(`directories.errors.${personnelError(detail.error).code}`, { defaultValue: t('directories.errors.generic') })}
            action={<Button type="button" variant="outline" onClick={closeDirectory}>{t('directories.back')}</Button>}
          />
        ) : null
      ) : null}

      {structureDirectory ? (
        <StructureDialog
          open
          organizationId={organizationId}
          directory={structureDirectory}
          onClose={() => setStructureDirectoryId(null)}
        />
      ) : null}

      <CreateDirectoryDialog
        organizationId={organizationId}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={openDirectory}
      />
    </section>
  )
}
