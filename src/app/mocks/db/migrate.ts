import { MOCK_SCHEMA_VERSION } from './constants'
import type { MockState } from './types'
import type { AccessRole } from '../../../entities/access/model/types'

/**
 * Document versions this build can open.
 * IndexedDB's own version stays at MOCK_DB_VERSION and is not a document version.
 * Version 1 is the snapshot from before delegationGrantIds was stored.
 */
export function migrateMockDocument(record: MockState): { state: MockState; changed: boolean } | null {
  if (!Number.isInteger(record.schemaVersion) || record.schemaVersion < 1 || record.schemaVersion > MOCK_SCHEMA_VERSION) {
    return null
  }
  if (!Array.isArray(record.roles) || !Array.isArray(record.users)) return null

  let rolesChanged = false
  const roles = record.roles.map((role) => normalizeRole(role, () => {
    rolesChanged = true
  }))
  const recordRevision = typeof record.recordRevision === 'number' ? record.recordRevision : 0
  const revisionChanged = record.recordRevision !== recordRevision
  const versionChanged = record.schemaVersion !== MOCK_SCHEMA_VERSION
  if (!rolesChanged && !revisionChanged && !versionChanged) return { state: record, changed: false }
  return {
    changed: true,
    state: {
      ...record,
      schemaVersion: MOCK_SCHEMA_VERSION,
      recordRevision,
      roles,
    },
  }
}

function normalizeRole(role: AccessRole, onChange: () => void): AccessRole {
  if (role && Array.isArray(role.delegationGrantIds)) return role
  onChange()
  const next: AccessRole = { ...role, delegationGrantIds: [] }
  return next
}
