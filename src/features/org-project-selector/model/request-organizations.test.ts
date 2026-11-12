import { describe, expect, it } from 'vitest'
import type { EffectiveGrant } from '../../../entities/access/model/types'
import { organizationIdsForAction, organizationOptionLabel } from './request-organizations'

const corporation = { type: 'corporation' as const, corporationId: 1 }
const organization = (organizationId: number) => ({ type: 'organization' as const, organizationId, corporationId: 1 })
const project = { type: 'project' as const, projectId: 1001, organizationId: 101, corporationId: 1 }

function grant(action: string, scope: EffectiveGrant['scope'], resource = 'requests'): EffectiveGrant {
  return { id: `${resource}.${action}.${scope.type}`, resource, action, scope }
}

describe('request organizations', () => {
  it('keeps organizations the role can read and ignores a project grant', () => {
    const grants = [
      grant('read', organization(201)),
      grant('read', organization(102)),
      grant('create', organization(101)),
      grant('read', project),
      grant('read', organization(404), 'tasks'),
    ]
    expect(organizationIdsForAction([101, 102, 201], grants, 'requests', 'read')).toEqual([102, 201])
  })

  it('opens every listed organization from a corporation grant', () => {
    expect(organizationIdsForAction([101, 201], [grant('read', corporation)], 'requests', 'read')).toEqual([101, 201])
  })

  it('uses the short name in the switcher', () => {
    expect(organizationOptionLabel({ id: 1, shortName: ' Тест ', fullName: 'Полное' })).toBe('Тест')
    expect(organizationOptionLabel({ id: 1, fullName: 'Полное' })).toBe('Полное')
    expect(organizationOptionLabel({ id: 7 })).toBe('7')
  })
})
