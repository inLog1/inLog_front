import '@excalidraw/excalidraw/index.css'

import {
  Excalidraw,
  MainMenu,
  THEME,
} from '@excalidraw/excalidraw'
import type { ExcalidrawEmbeddableElement } from '@excalidraw/excalidraw/element/types'
import type {
  AppState,
  ExcalidrawImperativeAPI,
} from '@excalidraw/excalidraw/types'
import { LayoutGridIcon } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useCallback, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '../../../shared/lib/utils'
import { TASK_CARD_LINK } from '../lib/constants'
import { createTaskCardElements } from '../model/create-task-card'
import type { TaskCardData, WhiteboardScene } from '../model/types'
import { TaskCardWidget } from './TaskCardWidget'

interface Props {
  initialData: WhiteboardScene | null
  onApiReady: (api: ExcalidrawImperativeAPI) => void
  onChange: () => void
  className?: string
  height?: number | string
}

export const WhiteboardCanvas = ({
  initialData,
  onApiReady,
  onChange,
  className,
  height = 500,
}: Props) => {
  const { t } = useTranslation()
  const { resolvedTheme } = useTheme()
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null)

  const excalidrawTheme = resolvedTheme === 'dark' ? THEME.DARK : THEME.LIGHT

  const handleApiReady = useCallback(
    (api: ExcalidrawImperativeAPI) => {
      apiRef.current = api
      onApiReady(api)
    },
    [onApiReady],
  )

  const handleChange = useCallback(
    () => {
      onChange()
    },
    [onChange],
  )

  const updateTaskCard = useCallback((cardId: string, data: Partial<TaskCardData>) => {
    const api = apiRef.current
    if (!api) {
      return
    }

    const elements = api.getSceneElements()
    const updatedElements = elements.map((element) => {
      if (element.type !== 'embeddable' || element.link !== TASK_CARD_LINK) {
        return element
      }

      const customData = element.customData as TaskCardData | undefined
      if (customData?.cardId !== cardId) {
        return element
      }

      return {
        ...element,
        customData: { ...customData, ...data },
      }
    })

    api.updateScene({ elements: updatedElements })
    onChange()
  }, [onChange])

  const insertTaskCard = useCallback(() => {
    const api = apiRef.current
    if (!api) {
      return
    }

    const appState = api.getAppState()
    const centerX = -appState.scrollX + appState.width / 2 / appState.zoom.value - 140
    const centerY = -appState.scrollY + appState.height / 2 / appState.zoom.value - 70

    const newElements = createTaskCardElements(centerX, centerY, {
      cardId: crypto.randomUUID(),
      title: t('whiteboard.new-task'),
      description: '',
      status: 'todo',
    })

    api.updateScene({
      elements: [...api.getSceneElements(), ...newElements],
    })
    onChange()
  }, [onChange, t])

  const renderEmbeddable = useCallback(
    (element: ExcalidrawEmbeddableElement, appState: AppState) => {
      if (element.link !== TASK_CARD_LINK) {
        return null
      }

      const isEditing = appState.editingGroupId === element.id
        || appState.selectedElementIds[element.id]

      return (
        <TaskCardWidget
          element={element}
          isEditing={Boolean(isEditing)}
          onUpdate={updateTaskCard}
        />
      )
    },
    [updateTaskCard],
  )

  const validateEmbeddable = useCallback((link: string) => {
    return link.startsWith('inlog://')
  }, [])

  const excalidrawInitialData = useMemo(() => {
    if (!initialData) {
      return null
    }

    return {
      elements: initialData.elements,
      appState: initialData.appState,
      files: initialData.files,
    }
  }, [initialData])

  return (
    <div
      className={cn('whiteboard-container overflow-hidden rounded-lg border', className)}
      style={{ height: typeof height === 'number' ? `${height}px` : height }}
    >
      <Excalidraw
        excalidrawAPI={handleApiReady}
        initialData={excalidrawInitialData}
        onChange={handleChange}
        theme={excalidrawTheme}
        validateEmbeddable={validateEmbeddable}
        renderEmbeddable={renderEmbeddable}
        UIOptions={{
          canvasActions: {
            loadScene: false,
            saveToActiveFile: false,
            export: false,
          },
        }}
      >
        <MainMenu>
          <MainMenu.DefaultItems.LoadScene />
          <MainMenu.DefaultItems.SaveAsImage />
          <MainMenu.DefaultItems.Export />
          <MainMenu.DefaultItems.ClearCanvas />
          <MainMenu.Separator />
          <MainMenu.Item onSelect={insertTaskCard}>
            <LayoutGridIcon className="mr-2 h-4 w-4" />
            {t('whiteboard.add-task-card')}
          </MainMenu.Item>
        </MainMenu>
      </Excalidraw>
    </div>
  )
}
