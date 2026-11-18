import { describe, expect, it } from 'vitest'
import { MOCK_DATA_NAMESPACE } from '../../../shared/config/runtime'
import {
  listLegacyWhiteboardKeys,
  readStoredScene,
  whiteboardContextKey,
  whiteboardRecordKey,
} from './whiteboard-key'

describe('whiteboard keys', () => {
  it('keeps mock and live scenes apart and does not read a legacy key', () => {
    const storage = new Map<string, string>()
    storage.set('inlog-whiteboard:task-1', '{"elements":["legacy-anon"]}')
    storage.set('inlog-whiteboard:task-1:u3', '{"elements":["legacy-user"]}')
    const mockKey = whiteboardRecordKey('task-1', 'mock', 3)
    const liveKey = whiteboardRecordKey('task-1', 'live', 3)
    expect(mockKey).toContain(`:mock:${encodeURIComponent(MOCK_DATA_NAMESPACE)}:`)
    expect(mockKey).toContain(':u3')
    expect(liveKey).not.toBe(mockKey)
    storage.set(mockKey ?? '', '{"elements":["mock-scene"]}')

    const reader = { getItem: (key: string) => storage.get(key) ?? null }
    expect(readStoredScene(reader, 'task-1', 'mock', 3)?.elements).toEqual(['mock-scene'])
    expect(readStoredScene(reader, 'task-1', 'live', 3)).toBeNull()
    expect(readStoredScene(reader, 'task-1', 'mock', null)).toBeNull()
    expect(storage.get('inlog-whiteboard:task-1')).toContain('legacy-anon')
    expect(storage.get('inlog-whiteboard:task-1:u3')).toContain('legacy-user')
    expect(listLegacyWhiteboardKeys([...storage.keys()])).toEqual([
      'inlog-whiteboard:task-1',
      'inlog-whiteboard:task-1:u3',
    ])
    expect(whiteboardContextKey('task-1', 'mock', 3)).not.toBe(whiteboardContextKey('task-1', 'mock', 4))
    expect(whiteboardContextKey('task-1', 'mock', 3)).not.toBe(whiteboardContextKey('task-1', 'live', 3))
  })
})
