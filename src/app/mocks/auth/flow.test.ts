import { describe, expect, it } from 'vitest'
import { createSeed } from '../db/seed'
import { PUBLIC_FIXTURE_PASSWORD } from '../db/constants'
import {
  accessFor,
  cancelMockSso,
  completeMockSso,
  ensureFormsSwitchAuthor,
  loginWithPassword,
  mutateAssignment,
  resolveIdentity,
  toSnapshot,
} from '../auth/flow'
import { migrateMockDocument } from '../db/migrate'
import { actionCovered, can, canDelegate, capabilityFromRoleDisplayName, hasCorporateSuperadmin, isDelegationSubset } from '../../../entities/access/model/grants'

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

  it('treats delegation as a separate authority and does not let manage imply read', () => {
    const state = createSeed()
    const snapshot = toSnapshot(state)
    const org = { type: 'organization' as const, organizationId: 101, corporationId: 1 }
    expect(can(snapshot, 3, 'members', 'read', org)).toBe(false)
    expect(canDelegate(snapshot, 3, 'members', 'read', org)).toBe(true)
    expect(actionCovered('manage', 'read')).toBe(false)
    expect(actionCovered('create', 'read')).toBe(false)
    expect(actionCovered('update', 'read')).toBe(false)
    expect(actionCovered('manage', 'delete')).toBe(false)
    expect(isDelegationSubset(
      [{ id: 'g-members-manage', resource: 'members', action: 'manage', scope: org }],
      state.delegations[0].grant,
      snapshot.projects,
      snapshot.organizations,
    )).toBe(false)
    expect(isDelegationSubset(
      [{ id: 'g-members-read', resource: 'members', action: 'read', scope: org }],
      state.delegations[0].grant,
      snapshot.projects,
      snapshot.organizations,
    )).toBe(true)
    expect(isDelegationSubset(
      [{ id: 'g-members-read', resource: 'members', action: 'read', scope: org }],
      {
        ...state.delegations[0].grant,
        scope: { type: 'organization', organizationId: 102, corporationId: 1 },
      },
      snapshot.projects,
      snapshot.organizations,
    )).toBe(false)
  })

  it('adds the two-laboratory author only on request and never through migration', () => {
    const seed = createSeed()
    expect(ensureFormsSwitchAuthor(seed)).toBe(seed)
    expect(seed.memberships.filter((item) => item.userId === 9).map((item) => item.organizationId).sort()).toEqual([101, 102])
    expect(seed.assignments.some((item) => item.userId === 9)).toBe(false)
    expect(can(toSnapshot(seed), 9, 'forms', 'update', { type: 'organization', organizationId: 101, corporationId: 1 })).toBe(false)
    const saved = {
      ...seed,
      users: seed.users.filter((user) => user.id !== 9),
      identities: seed.identities.filter((item) => item.userId !== 9),
      memberships: seed.memberships.filter((item) => item.userId !== 9),
    }
    const migrated = migrateMockDocument(saved)
    const stored = migrated?.state ?? saved
    expect(stored.users.some((user) => user.email === 'forms.switch@example.test')).toBe(false)
    expect(stored.forms).toEqual(saved.forms)
    expect(stored.assignments).toEqual(saved.assignments)
    const added = ensureFormsSwitchAuthor(saved)
    expect(added).not.toBe(saved)
    expect(added.forms).toEqual(saved.forms)
    expect(added.roles).toEqual(saved.roles)
    expect(added.assignments).toEqual(saved.assignments)
    expect(added.memberships.filter((item) => item.userId === 9).map((item) => item.organizationId).sort()).toEqual([101, 102])
    expect(ensureFormsSwitchAuthor(added)).toBe(added)
  })
})
