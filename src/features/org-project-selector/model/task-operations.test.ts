import { describe, expect, it } from 'vitest'
import type { EffectiveGrant } from '../../../entities/access/model/types'
import { mayChangeComment, visibleTaskOperations } from './useWorkspaceSection'

const project = (action: string, projectId = 1001): EffectiveGrant => ({
  id: action,
  resource: 'tasks',
  action,
  scope: { type: 'project', projectId, organizationId: 101, corporationId: 1 },
})

const target = { organizationId: 101, projectId: 1001 }

describe('visible task operations', () => {
  it('shows every write when the verified project grant allows it', () => {
    const grants = ['create', 'update', 'delete', 'assign'].map((action) => project(action))
    expect(visibleTaskOperations(grants, target, true)).toEqual({
      create: true,
      update: true,
      delete: true,
      assign: true,
    })
  })

  it('hides writes for a read-only grant and for another project', () => {
    const grants = [project('read')]
    expect(visibleTaskOperations(grants, target, true)).toEqual({
      create: false,
      update: false,
      delete: false,
      assign: false,
    })
    const foreign = ['create', 'update', 'delete', 'assign'].map((action) => project(action, 1003))
    expect(visibleTaskOperations(foreign, target, true).create).toBe(false)
  })

  it('does not open a form while grants are still unknown', () => {
    expect(visibleTaskOperations(undefined, target, true).update).toBe(false)
    expect(visibleTaskOperations([], null, true).create).toBe(false)
  })

  it('leaves live actions visible because the server, not a role name, decides', () => {
    expect(visibleTaskOperations(undefined, null, false)).toEqual({
      create: true,
      update: true,
      delete: true,
      assign: true,
    })
  })

  it('allows a comment change only for the author who can update', () => {
    expect(mayChangeComment(true, 3, 3)).toBe(true)
    expect(mayChangeComment(true, 3, 1)).toBe(false)
    expect(mayChangeComment(false, 3, 3)).toBe(false)
    expect(mayChangeComment(true, null, 3)).toBe(false)
  })
})
