'use client'

import { Plus } from 'lucide-react'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '../../../shared/lib/utils'
import { Button } from '../../../shared/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../shared/ui/dialog'
import { Input } from '../../../shared/ui/input'
import { Label } from '../../../shared/ui/label'
import SubTask from './SubTask'

interface SubTaskItem {
  id: string | number
  title: string
  slug?: string
  completed?: boolean
}

interface SubTasksProps {
  className?: string
  isTemplate?: boolean
  subtasks?: SubTaskItem[]
  onAddSubtask?: (title: string) => void
  addDisabledReason?: string
  onEditSubtask?: (slug: string, title: string, status?: 'completed' | 'incomplete') => void
  onDeleteSubtask?: (slug: string) => void
  onOpenSubtask?: (id: string | number) => void
  onCopySubtaskLink?: (id: string | number) => void
}

const SubTasks = ({
  className,
  isTemplate = false,
  subtasks = [],
  onAddSubtask,
  addDisabledReason,
  onEditSubtask,
  onDeleteSubtask,
  onOpenSubtask,
  onCopySubtaskLink,
}: SubTasksProps) => {
  const { t } = useTranslation()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('')
  if (!onAddSubtask && isDialogOpen) setIsDialogOpen(false)

  const handleAddSubtask = () => {
    if (!onAddSubtask) {
      setIsDialogOpen(false)
      return
    }
    if (newSubtaskTitle.trim()) {
      onAddSubtask(newSubtaskTitle.trim())
      setNewSubtaskTitle('')
      setIsDialogOpen(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleAddSubtask()
    }
  }

  return (
    <div className={cn('w-full space-y-4', className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          {isTemplate ? t('subtasks-entity.subtemplates') : t('subtasks-entity.subtasks')}
          {subtasks.length > 0 && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({subtasks.length})
            </span>
          )}
        </h3>
        <Button
          onClick={() => {
            if (onAddSubtask) setIsDialogOpen(true)
          }}
          size="sm"
          variant="outline"
          className="gap-2"
          disabled={!onAddSubtask}
          title={onAddSubtask ? undefined : addDisabledReason}
        >
          <Plus className="h-4 w-4" />
          {t('buttons.add')}
        </Button>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {isTemplate ? t('subtasks-entity.add-subtemplate') : t('subtasks-entity.add-subtask')}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="title" className="text-right">
                {t('fields.title')}
              </Label>
              <Input
                id="title"
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isTemplate ? t('fields.enter-subtemplate-name') : t('fields.enter-subtask-name')}
                className="col-span-3"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsDialogOpen(false)
                setNewSubtaskTitle('')
              }}
            >
              {t('buttons.cancel')}
            </Button>
            <Button onClick={handleAddSubtask}>
              {t('buttons.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="space-y-2">
        {subtasks.length > 0 ? (
          subtasks.map((subtask) => (
            <SubTask
              key={subtask.id}
              subtask={subtask}
              onEdit={onEditSubtask}
              onDelete={onDeleteSubtask}
              onOpen={onOpenSubtask}
              onCopyLink={onCopySubtaskLink}
            />
          ))
        ) : (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground border border-dashed rounded-lg">
            {isTemplate ? t('subtasks-entity.subtemplate-not-found') : t('subtasks-entity.subtask-not-found')}
          </div>
        )}
      </div>
    </div>
  )
}

export { SubTasks }
