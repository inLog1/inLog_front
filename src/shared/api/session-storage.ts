import { getApiMode, type ApiMode } from '../config/runtime'

export const LIVE_ACCESS_KEY = 'token'
export const LIVE_REFRESH_KEY = 'refresh_token'
export const LIVE_SUBJECT_KEY = 'inlog:live:session:subject'
export const MOCK_ACCESS_KEY = 'inlog:mock:session:access'
export const MOCK_REFRESH_KEY = 'inlog:mock:session:refresh'
export const MOCK_SUBJECT_KEY = 'inlog:mock:session:subject'
export const SESSION_DRAFT_PREFIX = 'inlog:session-draft:'

export type KeyValueStorage = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
  key?(index: number): string | null
  length?: number
}

const memory = new Map<string, string>()

const memoryStorage: KeyValueStorage = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => {
    memory.set(key, value)
  },
  removeItem: (key) => {
    memory.delete(key)
  },
}

let backend: KeyValueStorage | null = null

function defaultBackend(): KeyValueStorage {
  try {
    if (typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function') {
      return localStorage
    }
  } catch {
    return memoryStorage
  }
  return memoryStorage
}

export function setSessionStorageBackend(storage: KeyValueStorage | null) {
  backend = storage
}

function storage(): KeyValueStorage {
  return backend ?? defaultBackend()
}

export function readJsonString(raw: string | null): string | null {
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    return typeof parsed === 'string' && parsed.length > 0 ? parsed : null
  } catch {
    return null
  }
}

export function readJsonNumber(raw: string | null): number | null {
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : null
  } catch {
    return null
  }
}

function keysFor(mode: ApiMode) {
  if (mode === 'mock') {
    return {
      access: MOCK_ACCESS_KEY,
      refresh: MOCK_REFRESH_KEY,
      subject: MOCK_SUBJECT_KEY,
    }
  }
  return {
    access: LIVE_ACCESS_KEY,
    refresh: LIVE_REFRESH_KEY,
    subject: LIVE_SUBJECT_KEY,
  }
}

export function readAccessToken(mode: ApiMode = getApiMode()): string | null {
  const keys = keysFor(mode)
  return readJsonString(storage().getItem(keys.access))
}

export function readRefreshToken(mode: ApiMode = getApiMode()): string | null {
  const keys = keysFor(mode)
  return readJsonString(storage().getItem(keys.refresh))
}

export function readSessionSubject(mode: ApiMode = getApiMode()): number | null {
  const keys = keysFor(mode)
  return readJsonNumber(storage().getItem(keys.subject))
}

export function writeSession(input: {
  accessToken: string
  refreshToken?: string | null
  subjectId?: number | null
}, mode: ApiMode = getApiMode()) {
  const keys = keysFor(mode)
  storage().setItem(keys.access, JSON.stringify(input.accessToken))
  if (input.refreshToken) {
    storage().setItem(keys.refresh, JSON.stringify(input.refreshToken))
  }
  if (typeof input.subjectId === 'number') {
    storage().setItem(keys.subject, JSON.stringify(input.subjectId))
  }
}

export function writeSessionSubject(subjectId: number, mode: ApiMode = getApiMode()) {
  const keys = keysFor(mode)
  storage().setItem(keys.subject, JSON.stringify(subjectId))
}

export function clearSession(mode: ApiMode = getApiMode()) {
  const keys = keysFor(mode)
  storage().removeItem(keys.access)
  storage().removeItem(keys.refresh)
  storage().removeItem(keys.subject)
}

export function clearSessionDrafts() {
  const current = storage()
  if (typeof current.length !== 'number' || typeof current.key !== 'function') {
    return
  }
  const keys: string[] = []
  for (let index = 0; index < current.length; index += 1) {
    const key = current.key(index)
    if (key?.startsWith(SESSION_DRAFT_PREFIX)) keys.push(key)
  }
  keys.forEach((key) => current.removeItem(key))
}
