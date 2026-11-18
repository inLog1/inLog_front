import { describe, expect, it } from 'vitest'
import type { EffectiveGrant } from '../../../entities/access/model/types'
import { visibleConstructorAccess } from './useWorkspaceSection'

const organization = { type: 'organization' as const, organizationId: 101, corporationId: 1 }

function grant(resource: string, action: string): EffectiveGrant {
  return { id: `${resource}.${action}`, resource, action, scope: organization }
}

describe('constructor access visibility', () => {
  it('does not infer record or report actions from schema update', () => {
    const schema = visibleConstructorAccess([grant('constructor.schema', 'update')], 101, true)
    expect(schema.schemaUpdate).toBe(true)
    expect(schema.schemaCreate).toBe(false)
    expect(schema.recordsUpdate).toBe(false)
    expect(schema.recordsRead).toBe(false)
    const records = visibleConstructorAccess([
      grant('constructor.records', 'read'),
      grant('constructor.records', 'update'),
    ], 101, true)
    expect(records.recordsUpdate).toBe(true)
    expect(records.schemaUpdate).toBe(false)
    expect(visibleConstructorAccess([], 101, false).schemaCreate).toBe(true)
    expect(visibleConstructorAccess(undefined, 101, true).recordsCreate).toBe(false)
  })
})
