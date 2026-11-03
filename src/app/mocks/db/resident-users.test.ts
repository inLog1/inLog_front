import { describe, expect, it } from 'vitest'
import { loginWithPassword } from '../auth/flow'
import { PERSONAL_MOCK_NAMESPACE } from '../../../shared/config/mock-scenario'
import { PUBLIC_FIXTURE_PASSWORD } from './constants'
import { createEmptyInstallation } from './empty-installation'
import { configureInstallation } from '../installation/service'
import { migrateMockDocument } from './migrate'
import { createSeed } from './seed'
import { RESIDENT_USERS } from './resident-users'

const setup = {
  corporationName: 'Своя корпорация',
  givenName: 'Станислав',
  surname: 'Троцюк',
  email: 'owner@personal.test',
  salt: 'salt',
  hash: 'hash',
}

describe('resident users', () => {
  it('keeps ten accounts beside a manually registered owner and gives them no grants', () => {
    const ready = configureInstallation(createEmptyInstallation(PERSONAL_MOCK_NAMESPACE), setup)
    const emails = ready.users.map((user) => user.email)
    expect(emails).toEqual(['owner@personal.test', ...RESIDENT_USERS.map((user) => user.email)])
    expect(ready.systemCapabilities).toEqual([{ userId: 1, code: 'corporate_superadmin' }])
    expect(ready.localCredentials).toHaveLength(1)
    expect(ready.memberships).toEqual([])
    expect(ready.assignments).toEqual([])
    for (const resident of RESIDENT_USERS) {
      const user = ready.users.find((item) => item.email === resident.email)
      expect(user?.fixturePassword).toBe(false)
      expect(user?.legacyRole).toBe('member')
      expect(loginWithPassword(ready, resident.email, PUBLIC_FIXTURE_PASSWORD).status).toBe(401)
    }
  })

  it('restores missing residents when an older personal installation is opened', () => {
    const ready = configureInstallation(createEmptyInstallation(PERSONAL_MOCK_NAMESPACE), setup)
    const stored = { ...ready, users: ready.users.filter((user) => user.id === 1) }
    const migrated = migrateMockDocument(stored)
    expect(migrated?.changed).toBe(true)
    expect(migrated?.state.users.map((user) => user.email)).toEqual([
      'owner@personal.test',
      ...RESIDENT_USERS.map((user) => user.email),
    ])
    expect(migrated?.state.systemCapabilities).toEqual(ready.systemCapabilities)
    expect(migrated?.state.users.filter((user) => user.id !== 1).every((user) => user.fixturePassword === false)).toBe(true)
  })

  it('does not add residents to the demonstration namespace or an unfinished installation', () => {
    const seed = createSeed()
    const migrated = migrateMockDocument(seed)
    expect(migrated?.state.users).toHaveLength(seed.users.length)
    expect(migrated?.state.users.some((user) => user.email.startsWith('resident.'))).toBe(false)
    const empty = createEmptyInstallation('personal-memory')
    expect(migrateMockDocument(empty)?.state.users).toEqual([])
  })
})
