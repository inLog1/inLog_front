import type { MockState } from '../../../app/mocks/db/types'

/** The sample registry is a mock: identify administrators by their assigned role, not its display name. */
export function mayDeleteSample(state: MockState, userId: number | null, organizationId: number): boolean {
  if (userId == null || !state.users.some(user => user.id === userId && user.status !== 'blocked')) return false
  if (state.systemCapabilities.some(capability => capability.userId === userId && capability.code === 'corporate_superadmin')) return true
  return state.assignments.some(assignment => {
    if (assignment.userId !== userId || assignment.scope.type !== 'organization' || assignment.scope.organizationId !== organizationId) return false
    const role = state.roles.find(item => item.id === assignment.roleId)
    return role?.id === 'role-lab-admin' || (role?.origin?.template === 'organization-administrator'
      && role.ownerScope?.type === 'organization' && role.ownerScope.organizationId === organizationId)
  })
}
