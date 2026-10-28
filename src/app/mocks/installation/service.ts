import { can } from '../../../entities/access/model/grants'
import type { MockOrganization, MockProject, MockState, MockUser } from '../db/types'
import { toSnapshot } from '../auth/flow'

export class InstallationSetupError extends Error {
  readonly code: 'already_configured' | 'invalid_setup'

  constructor(code: 'already_configured' | 'invalid_setup') {
    super(code)
    this.code = code
  }
}

export type SetupDraft = {
  corporationName: string
  givenName: string
  surname: string
  email: string
  salt: string
  hash: string
}

const SERVER_CORPORATION_ID = 1

export function installationNeedsOwner(state: MockState): boolean {
  return state.installationPhase === 'uninitialized'
    && state.users.length === 0
    && state.installationCorporationId == null
    && !state.systemCapabilities.some((item) => item.code === 'corporate_superadmin')
}

/** One write. A second call throws and must not be stored. */
export function configureInstallation(state: MockState, draft: SetupDraft): MockState {
  if (!installationNeedsOwner(state)) throw new InstallationSetupError('already_configured')
  const corporationName = draft.corporationName.trim()
  const givenName = draft.givenName.trim()
  const surname = draft.surname.trim()
  const email = draft.email.trim().toLowerCase()
  if (!corporationName || !givenName || !surname || !email.includes('@')) {
    throw new InstallationSetupError('invalid_setup')
  }
  if (!draft.salt || !draft.hash) throw new InstallationSetupError('invalid_setup')
  const owner: MockUser = {
    id: 1,
    email,
    name: givenName,
    patronymic: '',
    surname,
    position: '',
    legacyRole: 'member',
    status: 'active',
    fixturePassword: false,
  }
  return {
    ...state,
    installationPhase: 'ready',
    corporation: { id: SERVER_CORPORATION_ID, name: corporationName },
    installationCorporationId: SERVER_CORPORATION_ID,
    users: [owner],
    localCredentials: [{ userId: owner.id, salt: draft.salt, hash: draft.hash }],
    systemCapabilities: [{ userId: owner.id, code: 'corporate_superadmin' }],
  }
}

export function createOrganization(
  state: MockState,
  userId: number,
  input: { fullName: string; shortName: string; address: string; kind: string },
): { state: MockState; organization: MockOrganization } | { error: 'forbidden' | 'invalid_organization' } {
  const corporationId = state.installationCorporationId
  if (corporationId == null || state.corporation.id !== corporationId) return { error: 'forbidden' }
  const allowed = can(toSnapshot(state), userId, 'organizations', 'create', {
    type: 'corporation',
    corporationId,
  })
  if (!allowed) return { error: 'forbidden' }
  const fullName = input.fullName.trim()
  const shortName = input.shortName.trim()
  const address = input.address.trim()
  if (!fullName || !shortName || !address) return { error: 'invalid_organization' }
  if (input.kind !== 'laboratory' && input.kind !== 'customer') return { error: 'invalid_organization' }
  const id = state.organizations.reduce((max, item) => Math.max(max, item.id), 0) + 1
  const organization: MockOrganization = {
    id,
    corporationId,
    kind: input.kind,
    fullName,
    shortName,
    address,
  }
  return { state: { ...state, organizations: [...state.organizations, organization] }, organization }
}

export function createProject(
  state: MockState,
  userId: number,
  input: { organizationId: number; name: string; reservoir: string },
): { state: MockState; project: MockProject } | { error: 'forbidden' | 'invalid_project' } {
  const corporationId = state.installationCorporationId
  if (corporationId == null || state.corporation.id !== corporationId) return { error: 'forbidden' }
  const organization = state.organizations.find((item) => item.id === input.organizationId)
  if (!organization || organization.corporationId !== corporationId) return { error: 'invalid_project' }
  const allowed = can(toSnapshot(state), userId, 'projects', 'create', {
    type: 'organization',
    organizationId: organization.id,
    corporationId,
  })
  if (!allowed) return { error: 'forbidden' }
  const name = input.name.trim()
  const reservoir = input.reservoir.trim()
  if (!name || !reservoir) return { error: 'invalid_project' }
  const id = state.projects.reduce((max, item) => Math.max(max, item.id), 0) + 1
  const project: MockProject = {
    id,
    organizationId: organization.id,
    corporationId,
    name,
    reservoir,
  }
  return { state: { ...state, projects: [...state.projects, project] }, project }
}
