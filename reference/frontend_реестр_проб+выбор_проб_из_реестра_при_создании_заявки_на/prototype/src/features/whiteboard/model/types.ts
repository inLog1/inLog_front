import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import type { AppState, BinaryFiles } from '@excalidraw/excalidraw/types'

export type TaskCardStatus = 'todo' | 'in-progress' | 'done'

export interface TaskCardData {
  cardId: string
  title: string
  description?: string
  status: TaskCardStatus
}

export interface WhiteboardScene {
  elements: readonly ExcalidrawElement[]
  appState: Partial<AppState>
  files: BinaryFiles
}

export interface WhiteboardProps {
  storageKey: string
  height?: number | string
  className?: string
}
