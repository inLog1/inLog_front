export type AccessBlockedGrant = {
  id: string
  resource: string
  action: string
  kind: 'operational' | 'delegation'
  reason: 'not_delegable' | 'not_offered' | 'not_applicable'
}

export type AccessFailure = {
  code: string
  assignmentCount?: number
  blocked?: AccessBlockedGrant[]
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
    blocked: readBlocked((data as { blocked?: unknown }).blocked),
  }
}

function readBlocked(value: unknown): AccessFailure['blocked'] {
  if (!Array.isArray(value)) return undefined
  const blocked: NonNullable<AccessFailure['blocked']> = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    if (typeof row.id !== 'string' || row.id.length === 0) continue
    if (row.kind !== 'operational' && row.kind !== 'delegation') continue
    if (row.reason !== 'not_delegable' && row.reason !== 'not_offered' && row.reason !== 'not_applicable') continue
    blocked.push({
      id: row.id,
      resource: typeof row.resource === 'string' ? row.resource : '',
      action: typeof row.action === 'string' ? row.action : '',
      kind: row.kind,
      reason: row.reason,
    })
  }
  return blocked
}

export function accessErrorKey(code: string): string {
  switch (code) {
    case 'forbidden':
    case 'self_elevation':
    case 'invalid_scope':
    case 'scope_expansion':
    case 'scope_locked':
    case 'not_found':
    case 'role_in_use':
    case 'stale_write':
    case 'mock_writer_held':
    case 'writer_lock_unavailable':
    case 'invalid_name':
    case 'invalid_description':
    case 'invalid_grants':
    case 'grants_not_delegable':
    case 'unacknowledged_omissions':
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
