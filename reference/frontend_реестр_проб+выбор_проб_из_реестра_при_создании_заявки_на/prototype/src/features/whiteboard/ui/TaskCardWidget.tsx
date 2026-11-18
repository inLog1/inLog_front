import type { ExcalidrawEmbeddableElement } from '@excalidraw/excalidraw/element/types'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '../../../shared/lib/utils'
import { Badge } from '../../../shared/ui/badge'
import { parseTaskCardData } from '../model/create-task-card'
import type { TaskCardData, TaskCardStatus } from '../model/types'

interface Props {
  element: ExcalidrawEmbeddableElement
  isEditing: boolean
  onUpdate: (cardId: string, data: Partial<TaskCardData>) => void
}

const statusVariant: Record<TaskCardStatus, 'secondary' | 'default' | 'outline'> = {
  todo: 'secondary',
  'in-progress': 'default',
  done: 'outline',
}

export const TaskCardWidget = ({ element, isEditing, onUpdate }: Props) => {
  const { t } = useTranslation()
  const cardData = parseTaskCardData(element.customData)

  const [title, setTitle] = useState(cardData?.title ?? '')
  const [description, setDescription] = useState(cardData?.description ?? '')

  useEffect(() => {
    if (cardData) {
      setTitle(cardData.title)
      setDescription(cardData.description ?? '')
    }
  }, [cardData?.cardId, cardData?.title, cardData?.description])

  const handleTitleBlur = useCallback(() => {
    if (!cardData || title === cardData.title) {
      return
    }
    onUpdate(cardData.cardId, { title: title.trim() || t('whiteboard.new-task') })
  }, [cardData, title, onUpdate, t])

  const handleDescriptionBlur = useCallback(() => {
    if (!cardData || description === (cardData.description ?? '')) {
      return
    }
    onUpdate(cardData.cardId, { description })
  }, [cardData, description, onUpdate])

  const cycleStatus = useCallback(() => {
    if (!cardData) {
      return
    }

    const order: TaskCardStatus[] = ['todo', 'in-progress', 'done']
    const currentIndex = order.indexOf(cardData.status)
    const nextStatus = order[(currentIndex + 1) % order.length]
    onUpdate(cardData.cardId, { status: nextStatus })
  }, [cardData, onUpdate])

  if (!cardData) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-lg border border-dashed bg-muted/50 p-2 text-xs text-muted-foreground">
        {t('whiteboard.invalid-card')}
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex h-full w-full flex-col rounded-lg border bg-card p-3 shadow-sm',
        isEditing && 'ring-2 ring-primary/30',
      )}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <input
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:text-muted-foreground"
          value={title}
          placeholder={t('whiteboard.task-title-placeholder')}
          onChange={(event) => setTitle(event.target.value)}
          onBlur={handleTitleBlur}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.currentTarget.blur()
            }
          }}
        />
        <button
          type="button"
          className="shrink-0"
          onClick={cycleStatus}
        >
          <Badge variant={statusVariant[cardData.status]} className="cursor-pointer text-[10px]">
            {t(`whiteboard.status.${cardData.status}`)}
          </Badge>
        </button>
      </div>

      <textarea
        className="min-h-0 flex-1 resize-none bg-transparent text-xs text-muted-foreground outline-none placeholder:text-muted-foreground/70"
        value={description}
        placeholder={t('whiteboard.task-description-placeholder')}
        onChange={(event) => setDescription(event.target.value)}
        onBlur={handleDescriptionBlur}
      />
    </div>
  )
}
