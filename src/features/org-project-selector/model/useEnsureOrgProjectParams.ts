import { useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

import { useGetOrganizationByIdQuery, useGetOrganizationsQuery } from '../../../entities/organization/model/organizationSlice'
import { useGetProjectByIdQuery, useGetProjectsQuery } from '../../../entities/project/model/projectSlice'
import type { Organization } from '../../../entities/organization/model/types'
import type { Project } from '../../../entities/project/model/types'
import {
    applyAutoSelection,
    projectsOfOrganization,
    resolveOrganization,
    resolveProject,
    selectOrganizationParams,
    selectProjectParams,
    workspaceHref,
    type CatalogLoad,
    type IdProbe,
    type WorkspaceLinkScope,
    type WorkspaceReason,
    type WorkspaceStatus,
} from './workspace-context'

export type OrgProjectSelectorType = 'all' | 'organization' | 'project'

function httpStatus(error: unknown): number | null {
    if (!error || typeof error !== 'object' || !('status' in error)) return null
    const status = (error as { status: unknown }).status
    return typeof status === 'number' ? status : null
}

function catalogLoad<T>(query: { isLoading: boolean; isError: boolean }, items: T[]): CatalogLoad<T> {
    if (query.isLoading) return { status: 'loading', items: [] }
    if (query.isError) return { status: 'error', items: [] }
    return { status: 'ready', items }
}

function organizationProbe(enabled: boolean, query: {
    isUninitialized: boolean
    isLoading: boolean
    isError: boolean
    error?: unknown
    currentData?: Organization
}): IdProbe {
    if (!enabled) return { status: 'idle' }
    if (query.isUninitialized || query.isLoading) return { status: 'loading' }
    if (query.isError) {
        const status = httpStatus(query.error)
        if (status === 404) return { status: 'not-found' }
        if (status === 403) return { status: 'forbidden' }
        return { status: 'error' }
    }
    if (query.currentData && typeof query.currentData.id === 'number') {
        return { status: 'ready', organizationId: query.currentData.id }
    }
    return { status: 'loading' }
}

function projectProbe(enabled: boolean, query: {
    isUninitialized: boolean
    isLoading: boolean
    isError: boolean
    error?: unknown
    currentData?: Project
}): IdProbe {
    if (!enabled) return { status: 'idle' }
    if (query.isUninitialized || query.isLoading) return { status: 'loading' }
    if (query.isError) {
        const status = httpStatus(query.error)
        if (status === 404) return { status: 'not-found' }
        if (status === 403) return { status: 'forbidden' }
        return { status: 'error' }
    }
    const organizationId = query.currentData?.organization
    if (query.currentData && typeof query.currentData.id === 'number') {
        return {
            status: 'ready',
            organizationId: typeof organizationId === 'number' ? organizationId : null,
        }
    }
    return { status: 'loading' }
}

export function useEnsureOrgProjectParams(type: OrgProjectSelectorType = 'all', options?: { persist?: boolean }) {
    const persist = options?.persist !== false
    const [searchParams, setSearchParams] = useSearchParams()
    const scope = type === 'organization' ? 'organization' : 'project'
    const organizationsQuery = useGetOrganizationsQuery()
    const organizationItems = useMemo(
        () => (organizationsQuery.data ?? []).filter((item) => Number.isInteger(item.id)),
        [organizationsQuery.data],
    )
    const organizations = catalogLoad(organizationsQuery, organizationItems)
    const orgParam = searchParams.get('org')
    const projectParam = searchParams.get('project')

    const preliminary = resolveOrganization(organizations, orgParam, { status: 'idle' })
    const organizationProbeQuery = useGetOrganizationByIdQuery(preliminary.probeId ?? 0, {
        skip: preliminary.probeId == null,
    })
    const organization = resolveOrganization(
        organizations,
        orgParam,
        organizationProbe(preliminary.probeId != null, organizationProbeQuery),
    )

    const projectsQuery = useGetProjectsQuery(
        { organization: organization.organizationId ?? 0 },
        { skip: scope === 'organization' || organization.organizationId == null },
    )
    const projectItems = useMemo(() => {
        const rows = projectsQuery.data ?? []
        return rows.map((item) => ({
            id: item.id,
            organizationId: typeof item.organization === 'number' ? item.organization : null,
        }))
    }, [projectsQuery.data])
    const listedProjects = organization.organizationId == null
        ? []
        : projectsOfOrganization(projectItems, organization.organizationId)
    const projectsCatalog: CatalogLoad<typeof projectItems[number]> = organization.organizationId == null
        ? { status: 'ready', items: [] }
        : catalogLoad(projectsQuery, projectItems)

    const preliminaryProject = organization.organizationId == null || scope === 'organization'
        ? null
        : resolveProject(organization.organizationId, projectsCatalog, projectParam, { status: 'idle' })
    const projectProbeQuery = useGetProjectByIdQuery(preliminaryProject?.probeId ?? 0, {
        skip: preliminaryProject?.probeId == null,
    })
    const project = organization.organizationId == null || scope === 'organization' || preliminaryProject == null
        ? null
        : resolveProject(
            organization.organizationId,
            projectsCatalog,
            projectParam,
            projectProbe(preliminaryProject.probeId != null, projectProbeQuery),
        )

    const status: WorkspaceStatus = organization.status !== 'ready'
        ? organization.status
        : scope === 'organization'
            ? 'ready'
            : (project?.status ?? 'loading')
    const reason: WorkspaceReason | null = organization.status !== 'ready'
        ? organization.reason
        : scope === 'organization'
            ? null
            : (project?.reason ?? null)
    const currentProjectId = status === 'ready' && scope === 'project' ? project?.projectId ?? null : null

    useEffect(() => {
        if (!persist) return
        const patch = {
            org: organization.autoOrgId,
            project: scope === 'project' ? project?.autoProjectId ?? null : null,
        }
        if (patch.org == null && patch.project == null) return
        const next = applyAutoSelection(searchParams, patch)
        if (!next) return
        setSearchParams(next, { replace: true })
    }, [organization.autoOrgId, persist, project?.autoProjectId, scope, searchParams, setSearchParams])

    const selectOrganization = (organizationId: number) => {
        setSearchParams((prev) => selectOrganizationParams(prev, organizationId))
    }

    const selectProject = (projectId: number) => {
        setSearchParams((prev) => selectProjectParams(prev, projectId))
    }

    const refetch = () => {
        void organizationsQuery.refetch()
        if (organization.organizationId != null) void projectsQuery.refetch()
        if (preliminary.probeId != null) void organizationProbeQuery.refetch()
        if (preliminaryProject?.probeId != null) void projectProbeQuery.refetch()
    }

    return {
        organizations: organizations.status === 'ready' ? organizationItems : [],
        projects: listedProjects.map((item) => ({
            id: item.id,
            name: projectsQuery.data?.find((projectRow) => projectRow.id === item.id)?.name ?? '',
            organization: item.organizationId ?? undefined,
        })),
        orgsLoading: organizations.status === 'loading' || (preliminary.probeId != null && organization.status === 'loading'),
        projectsLoading: scope === 'project' && organization.status === 'ready' && projectsQuery.isLoading,
        currentOrgId: organization.organizationId,
        currentProjectId,
        hasNoOrganizations: status === 'empty' && reason === 'organizations-empty',
        hasNoProjects: status === 'empty' && reason === 'projects-empty',
        status,
        reason,
        scope,
        searchParams,
        setSearchParams,
        selectOrganization,
        selectProject,
        refetch,
    }
}

/** Read-only verified selection. It does not write the URL; pages keep that effect. */
export function useWorkspaceHref() {
    const workspace = useEnsureOrgProjectParams('project', { persist: false })
    const explicitProject = workspace.currentProjectId != null && workspace.searchParams.get('project') === String(workspace.currentProjectId)
    return (pathname: string, scope: WorkspaceLinkScope) => workspaceHref(pathname, scope, {
        organizationId: workspace.currentOrgId,
        projectId: workspace.currentProjectId,
    }, explicitProject)
}
