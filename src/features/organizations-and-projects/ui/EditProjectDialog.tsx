import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-hot-toast'
import { Loader2 } from 'lucide-react'
import { useReviseProjectMutation } from '../../../entities/project/model/projectSlice'
import type { DirectoryProject } from '../../../entities/organization/model/directory'
import { errorsHandler } from '../../../shared/lib/errors-handler'
import { useUnsavedSource } from '../../../shared/session/unsaved-work'
import { Button } from '../../../shared/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../shared/ui/dialog'
import { Input } from '../../../shared/ui/input'
import { Label } from '../../../shared/ui/label'

export function EditProjectDialog({
  project,
  open,
  onOpenChange,
  onSaved,
}: {
  project: DirectoryProject | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: () => void
}) {
  const { t } = useTranslation()
  const [reviseProject, { isLoading }] = useReviseProjectMutation()
  const [name, setName] = useState(project?.name ?? '')
  const [reservoir, setReservoir] = useState(project?.reservoir ?? '')
  const dirty = open && project != null && (name !== project.name || reservoir !== project.reservoir)
  useUnsavedSource('edit-project', dirty)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!project) return
    try {
      await reviseProject({
        id: project.id,
        name,
        reservoir,
        expectedRevision: project.revision,
      }).unwrap()
      toast.success(t('settings-page.project-saved'))
      onOpenChange(false)
      onSaved?.()
    } catch (error) {
      errorsHandler(error, t)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('settings-page.edit-project')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-project-name">{t('fields.project-name')}</Label>
            <Input id="edit-project-name" value={name} onChange={(event) => setName(event.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-reservoir">{t('fields.reservoir')}</Label>
            <Input id="edit-reservoir" value={reservoir} onChange={(event) => setReservoir(event.target.value)} required />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t('buttons.cancel')}</Button>
            <Button type="submit" disabled={isLoading || !project}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t('buttons.save')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
