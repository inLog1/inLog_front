export type AccessFailure = {
  code: string
  assignmentCount?: number
}

export function accessFailure(error: unknown): AccessFailure {
  if (!error || typeof error !== 'object') return { code: 'server' }
  if ('status' in error && (error as { status?: unknown }).status === 'FETCH_ERROR') return { code: 'network' }
  const data = 'data' in error ? (error as { data?: unknown }).data : undefined
  if (!data || typeof data !== 'object' || !('code' in data)) return { code: 'server' }
  const code = (data as { code?: unknown }).code
  const assignmentCount = (data as { assignmentCount?: unknown }).assignmentCount
  if (typeof code !== 'string') return { code: 'server' }
  return {
    code,
    assignmentCount: typeof assignmentCount === 'number' ? assignmentCount : undefined,
  }
}

export function accessErrorKey(code: string): string {
  switch (code) {
    case 'forbidden':
    case 'self_elevation':
    case 'invalid_scope':
    case 'scope_expansion':
    case 'not_found':
    case 'role_in_use':
    case 'stale_write':
    case 'mock_writer_held':
    case 'writer_lock_unavailable':
    case 'invalid_name':
    case 'invalid_description':
    case 'invalid_grants':
    case 'invalid_user':
    case 'invalid_role':
    case 'invalid_version':
    case 'invalid_organization':
    case 'invalid_page':
    case 'invalid_query':
    case 'network':
    case 'server':
      return `access.errors.${code.replaceAll('_', '-')}`
    default:
      return 'access.errors.server'
  }
}
