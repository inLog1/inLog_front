'use client'

import {
    Copy,
    ExternalLink,
    MoreHorizontal,
    Pencil,
    Trash2,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '../../../shared/lib/utils'
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
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '../../../shared/ui/dialog'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '../../../shared/ui/dropdown-menu'
import { Input } from '../../../shared/ui/input'
import { Label } from '../../../shared/ui/label'
import { toast } from 'sonner'

interface SubTaskProps {
  subtask: {
    id: string | number
    title: string
    slug?: string
    completed?: boolean
  }
  onEdit?: (slug: string, title: string, status?: 'completed' | 'incomplete') => void
  onDelete?: (slug: string) => void
  onOpen?: (id: string | number) => void
  onCopyLink?: (id: string | number) => void
}

export const SubTask = ({
  subtask,
  onEdit,
  onDelete,
  onOpen,
  onCopyLink,
}: SubTaskProps) => {
  const { t } = useTranslation()
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editTitle, setEditTitle] = useState(subtask.title)
  if (!onEdit && isEditDialogOpen) setIsEditDialogOpen(false)
  if (!onDelete && isDeleteDialogOpen) setIsDeleteDialogOpen(false)

  const handleEdit = () => {
    if (!onEdit) {
      setIsEditDialogOpen(false)
      return
    }
    if (editTitle.trim()) {
      onEdit(subtask.slug || '', editTitle.trim())
      setIsEditDialogOpen(false)
    }
  }

  const handleDelete = () => {
    if (!onDelete) {
      setIsDeleteDialogOpen(false)
      return
    }
    onDelete(subtask.slug || '')
    setIsDeleteDialogOpen(false)
  }

  const getSubtaskLink = () => {
    const currentUrl = new URL(window.location.href)
    const orgParam = currentUrl.searchParams.get('org')
    const projectParam = currentUrl.searchParams.get('project')
    const taskPath = `/scheduler/tasks/`
    const link = new URL(window.location.origin)
    link.pathname = taskPath
    if (orgParam) link.searchParams.set('org', orgParam)
    if (projectParam) link.searchParams.set('project', projectParam)
    if (subtask.slug) link.searchParams.set('task', subtask.slug)
    return link.toString()
  }

const handleCopyLink = () => {
  const link = getSubtaskLink()
  navigator.clipboard.writeText(link.toString())
  onCopyLink?.(subtask.id)
  toast.success(t('notice-list.link-copied-successfully'))
}

  const handleOpenInNewTab = () => {
    const url = getSubtaskLink()
    window.open(url, '_blank')
    onOpen?.(subtask.id)
  }

  // const handleToggleComplete = () => {
  //   // onToggleComplete?.(subtask.slug || '', !subtask.completed)
  //   onEdit?.(subtask.slug || '', subtask.title, !subtask.completed ? 'completed' : 'incomplete')
  // }

  return (
    <>
      <div className={cn(
        "flex items-center justify-between p-3 rounded-lg border border-border bg-card hover:bg-accent/5 transition-colors group",
        subtask.completed && "opacity-70"
      )}>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* <Checkbox
            checked={subtask.completed}
            onCheckedChange={handleToggleComplete}
            className="data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground cursor-pointer"
          /> */}
          
          <span className={cn(
            "text-sm",
            subtask.completed && "line-through text-muted-foreground"
          )}>
            {subtask.title}
          </span>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 transition-opacity"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={handleOpenInNewTab}>
              <ExternalLink className="mr-2 h-4 w-4" />
              <span>{t('buttons.open-in-new-tab')}</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleCopyLink}>
              <Copy className="mr-2 h-4 w-4" />
              <span>{t('buttons.copy-link')}</span>
            </DropdownMenuItem>
            {onEdit && (
              <DropdownMenuItem onClick={() => setIsEditDialogOpen(true)}>
                <Pencil className="mr-2 h-4 w-4" />
                <span>{t('buttons.edit')}</span>
              </DropdownMenuItem>
            )}
            {onDelete && (
              <DropdownMenuItem
                onClick={() => setIsDeleteDialogOpen(true)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                <span>{t('buttons.delete')}</span>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{t('subtasks-entity.edit-subtask')}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-title" className="text-right">
                {t('fields.title')}
              </Label>
              <Input
                id="edit-title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="col-span-3"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
            >
              {t('buttons.cancel')}
            </Button>
            <Button onClick={handleEdit}>
              {t('buttons.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('subtasks-entity.delete-subtask-title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('subtasks-entity.delete-subtask-confirmation')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('buttons.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('buttons.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export default SubTask