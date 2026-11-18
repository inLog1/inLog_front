/** Same limit as task attachments in the mock store. */
export const REQUEST_BASIS_MAX_BYTES = 2 * 1024 * 1024

export const REQUEST_BASIS_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const

export type RequestBasisMime = (typeof REQUEST_BASIS_MIME_TYPES)[number]

export type RequestBasisDocument = {
  id: string
  filename: string
  mimeType: string
  size: number
  /** Stable API path. Never a blob: URL. */
  url: string
}

export function requestBasisMimeAllowed(mimeType: string): boolean {
  const normalized = mimeType.trim().toLowerCase()
  if (!normalized) return false
  return (REQUEST_BASIS_MIME_TYPES as readonly string[]).includes(normalized)
}

export function requestBasisFileAllowed(file: Pick<File, 'type' | 'size'>): 'ok' | 'invalid_type' | 'too_large' | 'empty' {
  if (file.size <= 0) return 'empty'
  if (file.size > REQUEST_BASIS_MAX_BYTES) return 'too_large'
  if (!requestBasisMimeAllowed(file.type)) return 'invalid_type'
  return 'ok'
}
