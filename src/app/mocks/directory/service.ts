import { MOCK_PROVIDER_ID } from '../db/constants'
import type { DirectoryEmployee, MockState, MockUser } from '../db/types'

export type DirectoryDraft = {
  id: string
  givenName: string
  surname: string
  patronymic?: string
  email: string
  organizationId: number
  providerId?: string
  externalSubject: string
}

export type DirectoryWrite =
  | { ok: true; state: MockState }
  | { ok: false; code: 'invalid_employee' | 'unknown_organization' }

export function saveDirectoryEmployee(state: MockState, draft: DirectoryDraft): DirectoryWrite {
  const id = draft.id.trim()
  const givenName = draft.givenName.trim()
  const surname = draft.surname.trim()
  const email = draft.email.trim().toLowerCase()
  const externalSubject = draft.externalSubject.trim()
  const providerId = draft.providerId?.trim() || MOCK_PROVIDER_ID
  if (!id || !givenName || !surname || !email.includes('@') || !externalSubject || !providerId) {
    return { ok: false, code: 'invalid_employee' }
  }
  if (!organizationAllowed(state, draft.organizationId)) return { ok: false, code: 'unknown_organization' }
  const rows = state.directoryEmployees ?? []
  const current = rows.find((item) => item.id === id)
  const next: DirectoryEmployee = {
    id,
    givenName,
    surname,
    patronymic: draft.patronymic?.trim() ?? '',
    email,
    organizationId: draft.organizationId,
    providerId,
    externalSubject,
    linkedUserId: current?.linkedUserId ?? null,
  }
  return {
    ok: true,
    state: {
      ...state,
      directoryEmployees: current
        ? rows.map((item) => item.id === id ? next : item)
        : [...rows, next],
    },
  }
}

export type SyncReport = {
  created: string[]
  updated: string[]
  skipped: Array<{ id: string; reason: 'unknown_organization' | 'identity_taken' }>
}

/** Adds or updates profiles. It does not assign roles and does not delete anyone. */
export function syncDirectory(state: MockState): { state: MockState; report: SyncReport } {
  let next = state
  const report: SyncReport = { created: [], updated: [], skipped: [] }
  for (const row of state.directoryEmployees ?? []) {
    if (!organizationAllowed(next, row.organizationId)) {
      report.skipped.push({ id: row.id, reason: 'unknown_organization' })
      continue
    }
    const identity = next.identities.find((item) =>
      item.providerId === row.providerId && item.externalSubject === row.externalSubject,
    )
    const linked = row.linkedUserId == null
      ? undefined
      : next.users.find((user) => user.id === row.linkedUserId)
    if (!linked) {
      if (identity?.userId != null) {
        report.skipped.push({ id: row.id, reason: 'identity_taken' })
        continue
      }
      const userId = nextUserId(next)
      const user = profileFrom(row, userId)
      const identities = identity
        ? next.identities.map((item) => item.id === identity.id
          ? { ...item, email: row.email, userId }
          : item)
        : [...next.identities, {
          id: `idn-${row.id}`,
          providerId: row.providerId,
          externalSubject: row.externalSubject,
          email: row.email,
          userId,
        }]
      next = {
        ...next,
        users: [...next.users, user],
        identities,
        memberships: [...next.memberships, membership(next, userId, row.organizationId)],
        directoryEmployees: (next.directoryEmployees ?? []).map((item) =>
          item.id === row.id ? { ...item, linkedUserId: userId } : item,
        ),
      }
      report.created.push(row.id)
      continue
    }
    next = {
      ...next,
      users: next.users.map((user) => user.id === linked.id ? applyProfile(user, row) : user),
      identities: retargetIdentity(next, row, linked.id, identity),
      memberships: hasMembership(next, linked.id, row.organizationId)
        ? next.memberships
        : [...next.memberships, membership(next, linked.id, row.organizationId)],
    }
    report.updated.push(row.id)
  }
  return { state: next, report }
}

function organizationAllowed(state: MockState, organizationId: number): boolean {
  const corporationId = state.installationCorporationId
  if (corporationId == null) return false
  return state.organizations.some((item) => item.id === organizationId && item.corporationId === corporationId)
}

function nextUserId(state: MockState): number {
  return state.users.reduce((max, user) => Math.max(max, user.id), 0) + 1
}

function profileFrom(row: DirectoryEmployee, userId: number): MockUser {
  return {
    id: userId,
    email: row.email,
    name: row.givenName,
    patronymic: row.patronymic,
    surname: row.surname,
    position: '',
    legacyRole: 'member',
    status: 'active',
    fixturePassword: false,
  }
}

function applyProfile(user: MockUser, row: DirectoryEmployee): MockUser {
  return {
    ...user,
    email: row.email,
    name: row.givenName,
    patronymic: row.patronymic,
    surname: row.surname,
  }
}

function hasMembership(state: MockState, userId: number, organizationId: number): boolean {
  return state.memberships.some((item) => item.userId === userId && item.organizationId === organizationId)
}

function membership(state: MockState, userId: number, organizationId: number) {
  const organization = state.organizations.find((item) => item.id === organizationId)
  return {
    id: `mem-${userId}-${organizationId}`,
    userId,
    organizationId,
    kind: organization?.kind ?? 'laboratory' as const,
  }
}

function retargetIdentity(
  state: MockState,
  row: DirectoryEmployee,
  userId: number,
  identity: MockState['identities'][number] | undefined,
) {
  if (identity && identity.userId != null && identity.userId !== userId) return state.identities
  if (!identity) {
    return [...state.identities, {
      id: `idn-${row.id}`,
      providerId: row.providerId,
      externalSubject: row.externalSubject,
      email: row.email,
      userId,
    }]
  }
  return state.identities.map((item) => item.id === identity.id
    ? { ...item, email: row.email, userId }
    : item)
}
