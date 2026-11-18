import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { personnelError } from '../../../entities/personnel'
import type { DirectoryDefinition } from '../../../entities/personnel/model/types'
import { useUnsavedSource } from '../../../shared/session/unsaved-work'
import { Button } from '../../../shared/ui/button'
import { Input } from '../../../shared/ui/input'
import { Label } from '../../../shared/ui/label'
import { Switch } from '../../../shared/ui/switch'
import { Textarea } from '../../../shared/ui/textarea'
import type { DirectoryCatalogSection } from '../../../entities/personnel/model/types'
import { initialCatalogSection } from '../model/directory-metadata'
import { DirectorySectionField } from './directory-meta-fields'

export function DirectoryAttributeSettings({
  directory,
  canEdit,
  onSave,
}: {
  directory: DirectoryDefinition
  canEdit: boolean
  onSave: (patch: { title: string; description: string; archived: boolean; section: DirectoryCatalogSection }) => Promise<void>
}) {
  const { t } = useTranslation()
  const [title, setTitle] = useState(directory.title)
  const [description, setDescription] = useState(directory.description)
  const [section, setSection] = useState<DirectoryCatalogSection>(() => initialCatalogSection(directory))
  const [archived, setArchived] = useState(directory.archived)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const dirty = title !== directory.title
    || description !== directory.description
    || archived !== directory.archived
    || section !== initialCatalogSection(directory)
  useUnsavedSource(`attribute-settings:${directory.id}`, canEdit && dirty)

  const save = async () => {
    const trimmed = title.trim()
    if (!trimmed || trimmed.length > 200 || description.trim().length > 500) {
      setError(t('directories.errors.invalid_value'))
      return
    }
    setSaving(true)
    setError('')
    setTitle(trimmed)
    setDescription(description.trim())
    try {
      await onSave({ title: trimmed, description: description.trim(), archived, section })
    } catch (caught) {
      setError(t(`directories.errors.${personnelError(caught).code}`, { defaultValue: t('directories.errors.generic') }))
    } finally {
      setSaving(false)
    }
  }

  return (
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
          disabled={!canEdit || saving}
          onChange={(event) => setTitle(event.target.value)}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="directory-settings-description">{t('directories.catalog.settings-description')}</Label>
        <Textarea
          id="directory-settings-description"
          value={description}
          maxLength={500}
          disabled={!canEdit || saving}
          onChange={(event) => setDescription(event.target.value)}
        />
      </div>
      <DirectorySectionField
        id={`directory-settings-section-${directory.id}`}
        value={section}
        disabled={!canEdit || saving}
        onChange={setSection}
      />
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="directory-settings-archived">{t('directories.catalog.settings-archived')}</Label>
        <Switch
          id="directory-settings-archived"
          checked={archived}
          disabled={!canEdit || saving}
          onCheckedChange={setArchived}
        />
      </div>
      {!canEdit ? <p className="text-sm text-muted-foreground">{t('directories.catalog.settings-readonly')}</p> : null}
      {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
      {canEdit ? (
        <div>
          <Button type="submit" disabled={saving || !dirty || title.trim() === ''}>{t('directories.catalog.save-settings')}</Button>
        </div>
      ) : null}
    </form>
  )
}
