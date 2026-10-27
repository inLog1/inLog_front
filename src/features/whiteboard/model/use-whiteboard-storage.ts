import { serializeAsJSON } from '@excalidraw/excalidraw'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import { useCallback, useEffect, useRef } from 'react'
import { useSelector } from 'react-redux'
import { selectSession } from '../../../entities/session'
import { getApiMode, type ApiMode } from '../../../shared/config/runtime'
import { readSessionSubject } from '../../../shared/api/session-storage'
import { WHITEBOARD_SAVE_DEBOUNCE_MS } from '../lib/constants'
import type { WhiteboardScene } from './types'
import { readStoredScene, whiteboardContextKey, whiteboardRecordKey } from './whiteboard-key'

const getStorageKey = (
  storageKey: string,
  mode: ApiMode = getApiMode(),
  subjectId: number | null = readSessionSubject(mode),
) => whiteboardRecordKey(storageKey, mode, subjectId)

export const loadWhiteboardScene = (
  storageKey: string,
  mode: ApiMode = getApiMode(),
  subjectId: number | null = readSessionSubject(mode),
): WhiteboardScene | null => {
  try {
    const scene = readStoredScene(localStorage, storageKey, mode, subjectId)
    if (!scene?.elements) return null
    return {
      elements: scene.elements as WhiteboardScene['elements'],
      appState: (scene.appState ?? {}) as WhiteboardScene['appState'],
      files: (scene.files ?? {}) as WhiteboardScene['files'],
    }
  } catch {
    return null
  }
}

export const saveWhiteboardScene = (
  storageKey: string,
  api: ExcalidrawImperativeAPI,
  mode: ApiMode = getApiMode(),
  subjectId: number | null = readSessionSubject(mode),
) => {
  const elements = api.getSceneElements()
  const appState = api.getAppState()
  const files = api.getFiles()

  const serialized = serializeAsJSON(elements, appState, files, 'local')
  const key = getStorageKey(storageKey, mode, subjectId)
  if (!key) return
  localStorage.setItem(key, serialized)
}

export const useWhiteboardStorage = (storageKey: string) => {
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const subjectId = useSelector(selectSession).subjectId
  const mode = getApiMode()
  const contextKey = whiteboardContextKey(storageKey, mode, subjectId)
  const contextRef = useRef(contextKey)

  const initialData = loadWhiteboardScene(storageKey, mode, subjectId)

  const scheduleSave = useCallback(() => {
    if (!apiRef.current) {
      return
    }

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    const subjectAtSchedule = subjectId
    const modeAtSchedule = mode
    saveTimeoutRef.current = setTimeout(() => {
      if (getApiMode() !== modeAtSchedule || readSessionSubject(modeAtSchedule) !== subjectAtSchedule) return
      if (!apiRef.current) return
      saveWhiteboardScene(storageKey, apiRef.current, modeAtSchedule, subjectAtSchedule)
    }, WHITEBOARD_SAVE_DEBOUNCE_MS)
  }, [mode, storageKey, subjectId])

  useEffect(() => {
    if (contextRef.current === contextKey) return
    contextRef.current = contextKey
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = null
    }
    apiRef.current = null
  }, [contextKey])

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  const setApi = useCallback((api: ExcalidrawImperativeAPI) => {
    apiRef.current = api
  }, [])

  return {
    initialData,
    setApi,
    scheduleSave,
    contextKey,
  }
}
