'use client'

import { formatDistance } from 'date-fns'
import { enUS, ru } from 'date-fns/locale'
import {
  Edit,
  MoreHorizontal,
  Pin,
  Trash2
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
import { Avatar, AvatarFallback, AvatarImage } from '../../../shared/ui/avatar'
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
import { Textarea } from '../../../shared/ui/textarea'

interface CommentItem {
  id: string | number
  text: string
  author: {
    id: string | number
    name: string
    avatar?: string
    email?: string
  }
  createdAt: string | Date
  updatedAt?: string | Date
  attachments?: Array<{
    id: string | number
    url: string
    name: string
    size?: number
  }>
  replies?: CommentItem[]
  isPinned?: boolean
  isEdited?: boolean
}

interface TaskCommentProps {
  comment: CommentItem
  currentUser?: {
    id: string | number
    name: string
    avatar?: string
  }
  onEdit?: (commentId: string | number, text: string) => void
  onDelete?: (commentId: string | number) => void
  className?: string
  isReply?: boolean
}

const TaskComment = ({
  comment,
  currentUser,
  onEdit,
  onDelete,
  className,
  isReply = false,
}: TaskCommentProps) => {
  const { t, i18n } = useTranslation()
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editText, setEditText] = useState(comment.text)

  const isAuthor = currentUser != null && Number(currentUser.id) === Number(comment.author.id)
  const canEdit = isAuthor && Boolean(onEdit)
  const canDelete = isAuthor && Boolean(onDelete)
  if (!canEdit && isEditDialogOpen) setIsEditDialogOpen(false)
  if (!canDelete && isDeleteDialogOpen) setIsDeleteDialogOpen(false)
  const dateLocale = i18n.language === 'ru' ? ru : enUS

  const handleDelete = () => {
    if (!isAuthor || !onDelete) {
      setIsDeleteDialogOpen(false)
      return
    }
    onDelete(comment.id)
    setIsDeleteDialogOpen(false)
  }

  const handleEdit = () => {
    if (!isAuthor || !onEdit) {
      setIsEditDialogOpen(false)
      return
    }
    if (editText.trim()) {
      onEdit(comment.id, editText.trim())
      setIsEditDialogOpen(false)
    }
  }

  const formatDate = (date: string | Date) => {
    return formatDistance(new Date(date), new Date(), {
      addSuffix: true,
      locale: dateLocale,
    })
  }

  return (
    <>
      <div
        id={`comment-${comment.id}`}
        className={cn(
          'group relative flex gap-3 p-3 rounded-lg transition-colors',
          comment.isPinned && 'bg-muted/50 border border-primary/20',
          isReply ? 'ml-8' : 'border bg-card',
          className
        )}
      >
        {/* Аватар автора */}
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarImage src={comment.author.avatar} />
          <AvatarFallback>
            {comment.author.name.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">
              {comment.author.name}
            </span>
            {isAuthor && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                {t('comments-entity.you')}
              </span>
            )}
            <span className="text-xs text-muted-foreground">
              {formatDate(comment.createdAt)}
            </span>
            {comment.isEdited && (
              <span className="text-xs text-muted-foreground">
                ({t('comments-entity.edited')})
              </span>
            )}
            {comment.isPinned && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-primary/10 text-primary flex items-center gap-1">
                <Pin className="h-3 w-3" />
                {t('comments-entity.pinned')}
              </span>
            )}
          </div>

          <div className="mt-1 text-sm whitespace-pre-wrap break-words">
            {comment.text}
          </div>

          {/* Вложения (если есть) */}
          {comment.attachments && comment.attachments.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {comment.attachments.map((attachment) => (
                <a
                  key={attachment.id}
                  href={attachment.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-muted hover:bg-muted/80 transition-colors"
                >
                  {attachment.name}
                  {attachment.size && (
                    <span className="text-muted-foreground">
                      ({(attachment.size / 1024).toFixed(1)} KB)
                    </span>
                  )}
                </a>
              ))}
            </div>
          )}

          {/* Кнопки действий под комментарием */}
          <div className="mt-2 flex items-center gap-2 opacity-100 transition-opacity">
          </div>

          {/* Ответы на комментарий */}
          {/* {comment.replies && comment.replies.length > 0 && (
            <div className="mt-3">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs mb-2"
                onClick={() => setShowReplies(!showReplies)}
              >
                {showReplies ? t('buttons.hide-replies') : t('buttons.show-replies')}
                ({comment.replies.length})
              </Button>
              
              {showReplies && (
                <div className="space-y-3">
                  {comment.replies.map((reply) => (
                    <TaskComment
                      key={reply.id}
                      comment={reply}
                      currentUser={currentUser}
                      onEdit={onEdit}
                      onDelete={onDelete}
                      onReply={onReply}
                      onCopyLink={onCopyLink}
                      isReply={true}
                    />
                  ))}
                </div>
              )}
            </div>
          )} */}
        </div>

        {/* Меню с тремя точками */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 opacity-100 transition-opacity"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {/* {onReply && (
              <DropdownMenuItem onClick={() => onReply(comment.id)}>
                <Reply className="mr-2 h-4 w-4" />
                <span>{t('buttons.reply')}</span>
              </DropdownMenuItem>
            )} */}
            
            {/* <DropdownMenuItem onClick={handleCopyLink}>
              <Copy className="mr-2 h-4 w-4" />
              <span>{t('buttons.copy-link')}</span>
            </DropdownMenuItem> */}

            {/* {onPin && (
              <DropdownMenuItem onClick={() => onPin(comment.id)}>
                {comment.isPinned ? (
                  <>
                    <PinOff className="mr-2 h-4 w-4" />
                    <span>{t('buttons.unpin')}</span>
                  </>
                ) : (
                  <>
                    <Pin className="mr-2 h-4 w-4" />
                    <span>{t('buttons.pin')}</span>
                  </>
                )}
              </DropdownMenuItem>
            )} */}

            {/* Действия доступные только автору */}
            {isAuthor && onEdit && (
              <DropdownMenuItem onClick={() => setIsEditDialogOpen(true)}>
                <Edit className="mr-2 h-4 w-4" />
                <span>{t('buttons.edit')}</span>
              </DropdownMenuItem>
            )}
            {isAuthor && onDelete && (
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

      {/* Диалог редактирования */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle>{t('comments-entity.edit-comment')}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="min-h-[120px]"
              autoFocus
            />
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

      {/* Диалог подтверждения удаления */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('comments-entity.delete-comment-title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('comments-entity.delete-comment-confirmation')}
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

export default TaskComment