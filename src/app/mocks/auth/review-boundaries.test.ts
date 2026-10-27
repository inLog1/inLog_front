import { describe, expect, it } from 'vitest'
import { createSeed } from '../db/seed'
import { can, scopeCovers } from '../../../entities/access/model/grants'
import { loginWithPassword, mutateAssignment, readTestResource, toSnapshot } from './flow'
import { PUBLIC_FIXTURE_PASSWORD } from '../db/constants'

describe('independent review: agreed access boundaries', () => {
  it('delegation permission is not an operational permission', () => {
    const snapshot = toSnapshot(createSeed())
    expect(can(snapshot, 3, 'members', 'read', {
      type: 'organization', organizationId: 101, corporationId: 1,
    })).toBe(false)
  })

  it('rejects a forged project/organization pair against the project registry', () => {
    const snapshot = toSnapshot(createSeed())
    expect(scopeCovers(
      { type: 'organization', organizationId: 101, corporationId: 1 },
      { type: 'project', projectId: 1002, organizationId: 101, corporationId: 1 },
      snapshot.projects,
    )).toBe(false)
  })

  it('does not let an org admin assign a stronger role without delegation authority', () => {
    const login = loginWithPassword(createSeed(), 'admin.a@example.test', PUBLIC_FIXTURE_PASSWORD)
    const token = login.state.sessions[0].accessToken
    expect(mutateAssignment(login.state, token, 'asg-admin', 'role-owner').status).toBe(403)
  })

  it('blocks private resource access after an already signed-in account is blocked', () => {
    const login = loginWithPassword(createSeed(), 'admin.a@example.test', PUBLIC_FIXTURE_PASSWORD)
    const token = login.state.sessions[0].accessToken
    const blocked = { ...login.state, users: login.state.users.map(user =>
      user.id === 2 ? { ...user, status: 'blocked' as const } : user) }
    expect(readTestResource(blocked, token, 101).status).toBe(403)
  })
})
