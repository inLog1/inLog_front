import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { personnelError } from '../../../entities/personnel'
import type { DirectoryCatalogSection, DirectoryDefinition } from '../../../entities/personnel/model/types'
import { useUnsavedSource } from '../../../shared/session/unsaved-work'
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
import { Input } from '../../../shared/ui/input'
import { Label } from '../../../shared/ui/label'
import { Switch } from '../../../shared/ui/switch'
import { Textarea } from '../../../shared/ui/textarea'
import { initialCatalogSections } from '../model/directory-metadata'
import { sameSectionSet } from '../model/directory-sections'
import { DirectorySectionsField } from './directory-meta-fields'

export function DirectoryAttributeSettings({
  directory,
  canEdit,
  canDelete,
  onSave,
  onDelete,
}: {
  directory: DirectoryDefinition
  canEdit: boolean
  canDelete: boolean
  onSave: (patch: { title: string; description: string; archived: boolean; sections: DirectoryCatalogSection[] }) => Promise<void>
  onDelete: () => Promise<void>
}) {
  const { t } = useTranslation()
  const [title, setTitle] = useState(directory.title)
  const [description, setDescription] = useState(directory.description)
  const [sections, setSections] = useState<DirectoryCatalogSection[]>(() => initialCatalogSections(directory))
  const [archived, setArchived] = useState(directory.archived)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const busy = saving || deleting
  const dirty = title !== directory.title
    || description !== directory.description
    || archived !== directory.archived
    || !sameSectionSet(sections, initialCatalogSections(directory))
  useUnsavedSource(`attribute-settings:${directory.id}`, canEdit && dirty)

  const save = async () => {
    const trimmed = title.trim()
    if (!trimmed || trimmed.length > 200 || description.trim().length > 500) {
      setError(t('directories.errors.invalid_value'))
      return
    }
    if (sections.length === 0) {
      setError(t('directories.definition-sections-required'))
      return
    }
    setSaving(true)
    setError('')
    setTitle(trimmed)
    setDescription(description.trim())
    try {
      await onSave({ title: trimmed, description: description.trim(), archived, sections })
    } catch (caught) {
      setError(t(`directories.errors.${personnelError(caught).code}`, { defaultValue: t('directories.errors.generic') }))
    } finally {
      setSaving(false)
    }
  }

  const removeGroup = async () => {
    setDeleting(true)
    setDeleteError('')
    try {
      await onDelete()
    } catch (caught) {
      setDeleteError(t(`directories.errors.${personnelError(caught).code}`, { defaultValue: t('directories.errors.generic') }))
      setDeleting(false)
    }
  }

  return (
    <>
    <form
      className="grid max-w-xl gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        if (canEdit) void save()
      }}
    >
      <div className="grid gap-1.5">
        <Label htmlFor="directory-settings-title">{t('directories.catalog.settings-title')}</Label>
        <Input
          id="directory-settings-title"
          value={title}
          maxLength={200}
          disabled={!canEdit || busy}
          onChange={(event) => setTitle(event.target.value)}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="directory-settings-description">{t('directories.catalog.settings-description')}</Label>
        <Textarea
          id="directory-settings-description"
          value={description}
          maxLength={500}
          disabled={!canEdit || busy}
          onChange={(event) => setDescription(event.target.value)}
        />
      </div>
      <DirectorySectionsField
        id={`directory-settings-section-${directory.id}`}
        value={sections}
        disabled={!canEdit || busy}
        onChange={setSections}
        required
      />
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="directory-settings-archived">{t('directories.catalog.settings-archived')}</Label>
        <Switch
          id="directory-settings-archived"
          checked={archived}
          disabled={!canEdit || busy}
          onCheckedChange={setArchived}
        />
      </div>
      {!canEdit ? <p className="text-sm text-muted-foreground">{t('directories.catalog.settings-readonly')}</p> : null}
      {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
      {canEdit || canDelete ? (
        <div className="flex flex-wrap items-center gap-2">
          {canEdit ? (
            <Button type="submit" disabled={busy || !dirty || title.trim() === ''}>{t('directories.catalog.save-settings')}</Button>
          ) : null}
          {canDelete ? (
            <Button
              type="button"
              variant="destructive"
              disabled={busy}
              onClick={() => {
                setDeleteError('')
                setConfirmDelete(true)
              }}
            >
              {t('directories.catalog.delete-group')}
            </Button>
          ) : null}
        </div>
      ) : null}
    </form>
    <AlertDialog open={confirmDelete} onOpenChange={(open) => { if (!deleting) setConfirmDelete(open) }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('directories.catalog.delete-group-title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('directories.catalog.delete-group-body', { title: directory.title })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {deleteError ? <p className="text-sm text-destructive" role="alert">{deleteError}</p> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>{t('directories.cancel')}</AlertDialogCancel>
          <Button type="button" variant="destructive" disabled={deleting} onClick={() => void removeGroup()}>
            {t('directories.catalog.delete-group')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  )
}
