import {
  getApiMode,
  LIVE_DATA_NAMESPACE,
  MOCK_DATA_NAMESPACE,
  type ApiMode,
} from '../../../shared/config/runtime'
import { WHITEBOARD_STORAGE_PREFIX } from '../lib/constants'

const CURRENT_PREFIX = `${WHITEBOARD_STORAGE_PREFIX}v2:`

/**
 * Current scenes are stored at
 * inlog-whiteboard:v2:${mode}:${encodeURIComponent(namespace)}:${encodeURIComponent(storageKey)}:u${subjectId}.
 * Older keys, with or without a subject suffix, stay on disk.
 * They are not read, deleted, or copied onto the current user.
 * Recovery is a future explicit action: list the legacy keys and attach one only after the person chooses it.
 */
export function whiteboardNamespace(mode: ApiMode): string {
  return mode === 'mock' ? MOCK_DATA_NAMESPACE : LIVE_DATA_NAMESPACE
}

export function whiteboardRecordKey(
  storageKey: string,
  mode: ApiMode = getApiMode(),
  subjectId: number | null,
): string | null {
  if (subjectId == null) return null
  return `${CURRENT_PREFIX}${mode}:${encodeURIComponent(whiteboardNamespace(mode))}:${encodeURIComponent(storageKey)}:u${subjectId}`
}

export function whiteboardContextKey(storageKey: string, mode: ApiMode, subjectId: number | null): string {
  return `${mode}:${subjectId ?? 'none'}:${storageKey}`
}

export function listLegacyWhiteboardKeys(keys: readonly string[]): string[] {
  return keys.filter((key) => key.startsWith(WHITEBOARD_STORAGE_PREFIX) && !key.startsWith(CURRENT_PREFIX))
}

export function readStoredScene(
  storage: { getItem(key: string): string | null },
  storageKey: string,
  mode: ApiMode,
  subjectId: number | null,
): { elements: unknown; appState: unknown; files: unknown } | null {
  const key = whiteboardRecordKey(storageKey, mode, subjectId)
  if (!key) return null
  const raw = storage.getItem(key)
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || !('elements' in parsed)) return null
    const record = parsed as { elements: unknown; appState?: unknown; files?: unknown }
    return {
      elements: record.elements,
      appState: record.appState ?? {},
      files: record.files ?? {},
    }
  } catch {
    return null
  }
}
