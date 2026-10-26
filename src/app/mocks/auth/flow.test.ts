import { describe, expect, it } from 'vitest'
import { createSeed } from '../db/seed'
import { PUBLIC_FIXTURE_PASSWORD } from '../db/constants'
import {
  accessFor,
  cancelMockSso,
  completeMockSso,
  loginWithPassword,
  mutateAssignment,
  resolveIdentity,
  toSnapshot,
} from '../auth/flow'
import { capabilityFromRoleDisplayName, hasCorporateSuperadmin, isDelegationSubset } from '../../../entities/access/model/grants'

describe('mock auth flow', () => {
  it('rejects a wrong password without creating a session', () => {
    const state = createSeed()
    const result = loginWithPassword(state, 'owner@example.test', 'wrong-password')
    expect(result.status).toBe(401)
    expect(result.state.sessions).toHaveLength(0)
    expect(JSON.stringify(result.state)).not.toContain(PUBLIC_FIXTURE_PASSWORD)
  })

  it('signs in the owner and keeps the fixture password out of the database', () => {
    const result = loginWithPassword(createSeed(), 'owner@example.test', PUBLIC_FIXTURE_PASSWORD)
    expect(result.status).toBe(200)
    expect(result.state.sessions).toHaveLength(1)
    expect(JSON.stringify(result.state)).not.toContain(PUBLIC_FIXTURE_PASSWORD)
  })

  it('completes mock SSO by provider subject and does not merge a shadow email', () => {
    const state = createSeed()
    const owner = completeMockSso(state, 'mock-corporate', 'sub-owner')
    expect(owner.status).toBe(200)
    expect(owner.state.sessions[0]?.userId).toBe(1)

    const shadow = resolveIdentity(state, 'mock-corporate', 'sub-owner-shadow')
    expect(shadow?.email).toBe('owner@example.test')
    expect(shadow?.userId).toBeNull()
    const rejected = completeMockSso(state, 'mock-corporate', 'sub-owner-shadow')
    expect(rejected.status).toBe(422)
    expect(rejected.state.sessions).toHaveLength(0)
  })

  it('does not create a session when SSO is cancelled', () => {
    const result = cancelMockSso(createSeed())
    expect(result.status).toBe(400)
    expect(result.state.sessions).toHaveLength(0)
  })

  it('reports pending access separately from a blocked account', () => {
    const state = createSeed()
    const pending = state.users.find((user) => user.email === 'pending@example.test')
    expect(pending).toBeTruthy()
    if (!pending) return
    expect(accessFor(state, pending).accessState).toBe('pending')

    const blocked = loginWithPassword({
      ...state,
      users: state.users.map((user) => user.id === 1 ? { ...user, status: 'blocked' } : user),
    }, 'owner@example.test', PUBLIC_FIXTURE_PASSWORD)
    expect(blocked.status).toBe(403)
    expect(blocked.state.sessions).toHaveLength(0)
  })

  it('does not grant corporate superadmin from a role display name', () => {
    const state = createSeed()
    expect(capabilityFromRoleDisplayName('corporate_superadmin')).toEqual([])
    const session = loginWithPassword(state, 'admin.a@example.test', PUBLIC_FIXTURE_PASSWORD)
    const token = session.state.sessions[0]?.accessToken ?? ''
    const outsideLab = mutateAssignment(session.state, token, 'asg-employee-b', 'role-decoy')
    expect(outsideLab.status).toBe(403)
    const renamed = mutateAssignment(session.state, token, 'asg-employee-a', 'role-decoy')
    expect(renamed.status).toBe(200)
    expect(hasCorporateSuperadmin(toSnapshot(renamed.state), 3)).toBe(false)
    expect(hasCorporateSuperadmin(toSnapshot(renamed.state), 2)).toBe(false)
    expect(hasCorporateSuperadmin(toSnapshot(state), 1)).toBe(true)
  })

  it('accepts a delegation only inside the parent scope', () => {
    const state = createSeed()
    const snapshot = toSnapshot(state)
    const parent = snapshot.assignments
      .filter((item) => item.userId === 2)
      .flatMap((assignment) => {
        const role = state.roles.find((item) => item.id === assignment.roleId)
        return (role?.grantIds ?? []).flatMap((grantId) => {
          const grant = state.grants.find((item) => item.id === grantId)
          return grant ? [{ ...grant, scope: assignment.scope }] : []
        })
      })
    expect(isDelegationSubset(parent, state.delegations[0].grant, snapshot.projects)).toBe(true)
    expect(isDelegationSubset(parent, {
      ...state.delegations[0].grant,
      scope: { type: 'organization', organizationId: 102, corporationId: 1 },
    }, snapshot.projects)).toBe(false)
  })
})
