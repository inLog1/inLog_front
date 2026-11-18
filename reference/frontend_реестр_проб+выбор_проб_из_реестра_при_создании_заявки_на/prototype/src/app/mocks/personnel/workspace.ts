import { buildStarter } from '../../../entities/personnel/model/template'
import type { MockState } from '../db/types'

function withArrays(state: MockState): MockState {
  if (
    Array.isArray(state.departments)
    && Array.isArray(state.workplaces)
    && Array.isArray(state.directoryDefinitions)
    && Array.isArray(state.directoryEntries)
    && Array.isArray(state.personnelConfigs)
    && Array.isArray(state.employees)
    && Array.isArray(state.organizationWorkspaces)
  ) return state
  return {
    ...state,
    departments: state.departments ?? [],
    workplaces: state.workplaces ?? [],
    directoryDefinitions: state.directoryDefinitions ?? [],
    directoryEntries: state.directoryEntries ?? [],
    personnelConfigs: state.personnelConfigs ?? [],
    employees: state.employees ?? [],
    organizationWorkspaces: state.organizationWorkspaces ?? [],
  }
}

/**
 * Applies the starter once. A workspace row blocks a second copy, including after
 * the user has removed or edited the generated records.
 */
export function ensureOrganizationWorkspace(state: MockState, organizationId: number): MockState | null {
  const organization = state.organizations.find((item) => item.id === organizationId)
  if (!organization) return null
  const ready = withArrays(state)
  if (ready.organizationWorkspaces.some((item) => item.organizationId === organizationId)) {
    return ready === state ? state : ready
  }
  const starter = buildStarter(organizationId)
  return {
    ...ready,
    organizationWorkspaces: [...ready.organizationWorkspaces, starter.workspace],
    directoryDefinitions: [...ready.directoryDefinitions, ...starter.directories],
    directoryEntries: [...ready.directoryEntries, ...starter.entries],
    personnelConfigs: [...ready.personnelConfigs, starter.config],
  }
}

export function ensureOrganizationWorkspaces(state: MockState): MockState {
  let next = withArrays(state)
  for (const organization of next.organizations) {
    const ensured = ensureOrganizationWorkspace(next, organization.id)
    if (ensured) next = ensured
  }
  return next
}
