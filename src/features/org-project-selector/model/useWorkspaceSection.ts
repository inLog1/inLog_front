import { useSelector } from 'react-redux'
import { useGetSessionAccessQuery } from '../../../entities/access'
import { grantAllows } from '../../../entities/access/model/grants'
import type { EffectiveGrant } from '../../../entities/access/model/types'
import { selectSession } from '../../../entities/session'
import { useEnsureOrgProjectParams, type OrgProjectSelectorType } from './useEnsureOrgProjectParams'
import type { WorkspaceReason, WorkspaceStatus } from './workspace-context'

export type SectionPermission = {
    resource: string
    action: string
}

export type WorkspaceSection =
    | {
        kind: 'pending'
        status: Exclude<WorkspaceStatus, 'ready'>
        reason: WorkspaceReason | null
        refetch: () => void
    }
    | {
        kind: 'ready'
        organizationId: number
        projectId: number | null
        refetch: () => void
    }

const mockMode = import.meta.env.VITE_API_MODE === 'mock'

export function useVerifiedOrganizationId(): number | null {
    const workspace = useEnsureOrgProjectParams('organization')
    return workspace.status === 'ready' ? workspace.currentOrgId : null
}

export type TaskOperation = 'create' | 'update' | 'delete' | 'assign'

export type TaskOperations = Record<TaskOperation, boolean>

/**
 * Client visibility for task actions. Live mode does not invent grants:
 * the same session-access query used by the workspace section is skipped,
 * and the server remains the authority. Mock mode uses operational grants
 * on the verified project. A role display name is not an input.
 */
export function visibleTaskOperations(
  grants: readonly EffectiveGrant[] | undefined,
  target: { organizationId: number; projectId: number } | null,
  enforce: boolean,
): TaskOperations {
  if (!enforce) return { create: true, update: true, delete: true, assign: true }
  const allow = (action: TaskOperation) =>
    target != null && grants != null && grantAllows(grants, 'tasks', action, target)
  return {
    create: allow('create'),
    update: allow('update'),
    delete: allow('delete'),
    assign: allow('assign'),
  }
}

/** Comment edit and delete follow the mock rule: tasks.update and the author. */
export function mayChangeComment(
  canUpdate: boolean,
  authorId: number | null | undefined,
  actorId: number | null | undefined,
): boolean {
  return canUpdate && authorId != null && actorId != null && authorId === actorId
}

export function useTaskOperations(organizationId: number | null, projectId: number | null) {
  const session = useSelector(selectSession)
  const access = useGetSessionAccessQuery(undefined, {
    skip: !mockMode || organizationId == null || projectId == null,
  })
  const target = organizationId != null && projectId != null ? { organizationId, projectId } : null
  const grants = !mockMode || access.data?.accessState !== 'ready' ? undefined : access.data.effectiveGrants
  return {
    ...visibleTaskOperations(grants, target, mockMode),
    actorId: session.subjectId,
    settled: !mockMode || access.isError || (access.isSuccess && access.data?.accessState === 'ready'),
  }
}

export type ConstructorAccess = {
    schemaCreate: boolean
    schemaUpdate: boolean
    schemaDelete: boolean
    recordsRead: boolean
    recordsCreate: boolean
    recordsUpdate: boolean
    recordsDelete: boolean
}

const closedConstructorAccess: ConstructorAccess = {
    schemaCreate: false,
    schemaUpdate: false,
    schemaDelete: false,
    recordsRead: false,
    recordsCreate: false,
    recordsUpdate: false,
    recordsDelete: false,
}

const openConstructorAccess: ConstructorAccess = {
    schemaCreate: true,
    schemaUpdate: true,
    schemaDelete: true,
    recordsRead: true,
    recordsCreate: true,
    recordsUpdate: true,
    recordsDelete: true,
}

/**
 * Mock visibility for the existing constructor. create and delete are separate
 * from update. Live mode does not invent grants: the server remains the authority.
 */
export function visibleConstructorAccess(
    grants: readonly EffectiveGrant[] | undefined,
    organizationId: number | null,
    enforce: boolean,
): ConstructorAccess {
    if (!enforce) return openConstructorAccess
    const allow = (resource: string, action: string) =>
        organizationId != null && grants != null && grantAllows(grants, resource, action, { organizationId, projectId: null })
    return {
        schemaCreate: allow('constructor.schema', 'create'),
        schemaUpdate: allow('constructor.schema', 'update'),
        schemaDelete: allow('constructor.schema', 'delete'),
        recordsRead: allow('constructor.records', 'read'),
        recordsCreate: allow('constructor.records', 'create'),
        recordsUpdate: allow('constructor.records', 'update'),
        recordsDelete: allow('constructor.records', 'delete'),
    }
}

export function useConstructorAccess(organizationId: number | null): ConstructorAccess {
    const access = useGetSessionAccessQuery(undefined, { skip: !mockMode || organizationId == null })
    if (!mockMode) return openConstructorAccess
    if (organizationId == null || access.isLoading || access.isUninitialized || !access.data || access.data.accessState !== 'ready') {
        return closedConstructorAccess
    }
    return visibleConstructorAccess(access.data.effectiveGrants, organizationId, true)
}

export function useOrganizationAccessReady(organizationId: number | null): boolean {
    const access = useGetSessionAccessQuery(undefined, { skip: !mockMode || organizationId == null })
    if (!mockMode) return organizationId != null
    if (organizationId == null) return false
    return !access.isLoading && !access.isUninitialized && access.data?.accessState === 'ready'
}

export function useHasOrganizationGrant(resource: string, action: string, organizationId: number | null): boolean {
    const access = useGetSessionAccessQuery(undefined, { skip: !mockMode || organizationId == null })
    if (!mockMode) return organizationId != null
    if (organizationId == null || access.isLoading || access.isUninitialized || !access.data) return false
    if (access.data.accessState !== 'ready') return false
    return grantAllows(access.data.effectiveGrants, resource, action, { organizationId, projectId: null })
}

export function useWorkspaceSection(
    scope: 'organization' | 'project',
    permission?: SectionPermission,
): WorkspaceSection {
    const type: OrgProjectSelectorType = scope === 'organization' ? 'organization' : 'project'
    const workspace = useEnsureOrgProjectParams(type)
    const access = useGetSessionAccessQuery(undefined, { skip: !mockMode || workspace.status !== 'ready' })

    if (workspace.status !== 'ready' || workspace.currentOrgId == null) {
        return {
            kind: 'pending',
            status: workspace.status === 'ready' ? 'loading' : workspace.status,
            reason: workspace.reason,
            refetch: workspace.refetch,
        }
    }
    if (scope === 'project' && workspace.currentProjectId == null) {
        return {
            kind: 'pending',
            status: 'loading',
            reason: null,
            refetch: workspace.refetch,
        }
    }

    if (!permission || !mockMode) {
        return {
            kind: 'ready',
            organizationId: workspace.currentOrgId,
            projectId: workspace.currentProjectId,
            refetch: workspace.refetch,
        }
    }
    if (access.isLoading || access.isUninitialized) {
        return { kind: 'pending', status: 'loading', reason: null, refetch: workspace.refetch }
    }
    if (access.isError || !access.data) {
        return { kind: 'pending', status: 'error', reason: 'access-error', refetch: () => { void access.refetch(); workspace.refetch() } }
    }
    if (access.data.accessState !== 'ready') {
        return { kind: 'pending', status: 'forbidden', reason: 'missing-permission', refetch: workspace.refetch }
    }
    const allowed = grantAllows(
        access.data.effectiveGrants,
        permission.resource,
        permission.action,
        { organizationId: workspace.currentOrgId, projectId: workspace.currentProjectId },
    )
    if (!allowed) {
        return { kind: 'pending', status: 'forbidden', reason: 'missing-permission', refetch: workspace.refetch }
    }
    return {
        kind: 'ready',
        organizationId: workspace.currentOrgId,
        projectId: workspace.currentProjectId,
        refetch: workspace.refetch,
    }
}
