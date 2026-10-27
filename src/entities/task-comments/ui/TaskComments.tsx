'use client'

import { Plus } from 'lucide-react'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '../../../shared/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '../../../shared/ui/avatar'
import { Button } from '../../../shared/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../shared/ui/dialog'
import { Label } from '../../../shared/ui/label'
import { Textarea } from '../../../shared/ui/textarea'
import TaskComment from './TaskComment'
import type { Comment } from '../../task/model/types'

interface Props {
  className?: string
  comments?: Comment[]
  currentUser?: {
    id: string | number
    name: string
    avatar?: string
  }
  onAddComment?: (text: string) => void
  addDisabledReason?: string
  onEditComment?: (commentId: string | number, text: string) => void
  onDeleteComment?: (commentId: string | number) => void
}

const TaskComments = ({
  className,
  comments = [],
  currentUser,
  onAddComment,
  addDisabledReason,
  onEditComment,
  onDeleteComment,
}: Props) => {
  const { t } = useTranslation()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [newCommentText, setNewCommentText] = useState('')
  const [replyToId, setReplyToId] = useState<string | number | null>(null)
  const [replyText, setReplyText] = useState('')
  if (!onAddComment && isDialogOpen) setIsDialogOpen(false)

  const handleAddComment = () => {
    if (!onAddComment) {
      setIsDialogOpen(false)
      return
    }
    if (newCommentText.trim()) {
      onAddComment(newCommentText.trim())
      setNewCommentText('')
      setIsDialogOpen(false)
    }
  }


  const handleKeyDown = (e: React.KeyboardEvent, type: 'add' | 'reply') => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (type === 'add') {
        handleAddComment()
      }
    }
  }

  return (
    <div className={cn('w-full space-y-4', className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          {t('comments-entity.comments')}
          {comments.length > 0 && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({comments.length})
            </span>
          )}
        </h3>
        <Button
          onClick={() => {
            if (onAddComment) setIsDialogOpen(true)
          }}
          size="sm"
          variant="outline"
          className="gap-2"
          disabled={!onAddComment}
          title={onAddComment ? undefined : addDisabledReason}
        >
          <Plus className="h-4 w-4" />
          {t('buttons.add-comment')}
        </Button>
      </div>

      {/* Диалог добавления комментария */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle>
              {t('comments-entity.add-comment')}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="flex gap-4">
              {/* Аватар текущего пользователя */}
              {currentUser && (
                <Avatar className="h-8 w-8">
                  <AvatarImage src={currentUser.avatar} />
                  <AvatarFallback>
                    {currentUser.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              )}
              <div className="flex-1 space-y-2">
                <Label htmlFor="comment" className="sr-only">
                  {t('fields.comment')}
                </Label>
                <Textarea
                  id="comment"
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, 'add')}
                  placeholder={t('fields.enter-comment')}
                  className="min-h-[100px]"
                  autoFocus
                />
                <div className="text-xs text-muted-foreground">
                  {t('comments-entity.shift-enter-for-new-line')}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsDialogOpen(false)
                setNewCommentText('')
              }}
            >
              {t('buttons.cancel')}
            </Button>
            <Button onClick={handleAddComment}>
              {t('buttons.post-comment')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Список комментариев */}
      <div className="space-y-4">
        {comments.length > 0 ? (
          comments.map((comment) => (
            <TaskComment
              key={comment.id}
              comment={{
                id: comment.id,
                text: comment.text,
                author: {
                  id: comment.user?.id ?? 0,
                  name: comment.user?.full_name || comment.user?.email || t('fields.not-specified'),
                  avatar: comment.user?.avatar?.small,
                },
                createdAt: comment.created_at,
              }}
              currentUser={currentUser}
              onEdit={onEditComment}
              onDelete={onDeleteComment}
            />
          ))
        ) : (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground border border-dashed rounded-lg">
            {t('comments-entity.no-comments')}
          </div>
        )}
      </div>

      {/* Форма ответа (если активен reply) */}
      {replyToId && (
        <div className="mt-4 p-4 border rounded-lg bg-muted/30">
          <div className="flex gap-4">
            {currentUser && (
              <Avatar className="h-8 w-8">
                <AvatarImage src={currentUser.avatar} />
                <AvatarFallback>
                  {currentUser.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            )}
            <div className="flex-1">
              <Textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, 'reply')}
                placeholder={t('fields.write-reply')}
                className="min-h-[80px]"
                autoFocus
              />
              <div className="flex justify-end gap-2 mt-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setReplyToId(null)
                    setReplyText('')
                  }}
                >
                  {t('buttons.cancel')}
                </Button>
                {/* <Button
                  size="sm"
                  onClick={() => replyToId && handleReply(replyToId)}
                >
                  <Send className="h-3 w-3 mr-2" />
                  {t('buttons.reply')}
                </Button> */}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default TaskComments;