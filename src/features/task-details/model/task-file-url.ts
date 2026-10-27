import { useEffect, useState } from 'react'
import { readAccessToken } from '../../../shared/api/session-storage'
import type { UserFile } from '../../../entities/user/model/types'

export type DisplayFile = {
  id: number
  file: string
  filename: string
  size?: number
  created_at: string
  mime_type: string
}

function isStoredContentPath(value: string): boolean {
  return value.startsWith('/mock-api/') && value.endsWith('/content/')
}

export function revokeObjectUrls(urls: readonly string[]) {
  for (const url of urls) {
    if (url.startsWith('blob:')) URL.revokeObjectURL(url)
  }
}

/**
 * Mock file bytes stay in IndexedDB. The page creates an object URL while the
 * file is on screen and revokes it when the list changes. A blob: URL is not stored.
 */
export function useTaskFileUrls(files: UserFile[] | undefined): DisplayFile[] {
  const [urls, setUrls] = useState<Record<number, string>>({})

  useEffect(() => {
    const created: string[] = []
    let cancelled = false
    const token = readAccessToken()
    const list = files ?? []
    void Promise.all(list.map(async (file) => {
      const raw = file.file ?? ''
      if (!isStoredContentPath(raw)) return [file.id, raw] as const
      const response = await fetch(raw, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      if (!response.ok) return [file.id, ''] as const
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      created.push(url)
      return [file.id, url] as const
    })).then((pairs) => {
      if (cancelled) {
        revokeObjectUrls(created)
        return
      }
      setUrls(Object.fromEntries(pairs))
    })
    return () => {
      cancelled = true
      revokeObjectUrls(created)
    }
  }, [files])

  return (files ?? []).map((file) => {
    const raw = file.file ?? ''
    return {
      id: file.id,
      file: urls[file.id] ?? (isStoredContentPath(raw) ? '' : raw),
      filename: file.filename ?? file.name ?? '',
      size: file.size,
      created_at: file.created_at ?? '',
      mime_type: file.mime_type ?? '',
    }
  })
}
