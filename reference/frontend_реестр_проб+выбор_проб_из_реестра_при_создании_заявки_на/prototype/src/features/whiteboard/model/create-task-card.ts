import { convertToExcalidrawElements } from '@excalidraw/excalidraw'
import type { ExcalidrawElementSkeleton } from '@excalidraw/excalidraw/data/transform'
import { TASK_CARD_DEFAULT_HEIGHT, TASK_CARD_DEFAULT_WIDTH, TASK_CARD_LINK } from '../lib/constants'
import type { TaskCardData } from './types'

export const createTaskCardData = (overrides?: Partial<TaskCardData>): TaskCardData => ({
  cardId: crypto.randomUUID(),
  title: overrides?.title ?? 'New task',
  description: overrides?.description ?? '',
  status: overrides?.status ?? 'todo',
})

export const createTaskCardElements = (
  x: number,
  y: number,
  cardData: TaskCardData = createTaskCardData(),
) => {
  return convertToExcalidrawElements(
    [
      {
        type: 'embeddable',
        x,
        y,
        width: TASK_CARD_DEFAULT_WIDTH,
        height: TASK_CARD_DEFAULT_HEIGHT,
        link: TASK_CARD_LINK,
        customData: cardData,
      } as unknown as ExcalidrawElementSkeleton,
    ],
    { regenerateIds: true },
  )
}

export const parseTaskCardData = (customData: unknown): TaskCardData | null => {
  if (!customData || typeof customData !== 'object') {
    return null
  }

  const data = customData as Partial<TaskCardData>

  if (!data.cardId || typeof data.title !== 'string') {
    return null
  }

  return {
    cardId: data.cardId,
    title: data.title,
    description: data.description ?? '',
    status: data.status ?? 'todo',
  }
}
