import { useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

import { useGetOrganizationsQuery } from '../../../entities/organization/model/organizationSlice'
import { useGetProjectsQuery } from '../../../entities/project/model/projectSlice'

export type OrgProjectSelectorType = 'all' | 'organization' | 'project'

export function useEnsureOrgProjectParams(type: OrgProjectSelectorType = 'all') {
    const [searchParams, setSearchParams] = useSearchParams()
    const { data: organizations = [], isLoading: orgsLoading } = useGetOrganizationsQuery()

    const orgParam = Number(searchParams.get('org')) || null
    const projectParam = Number(searchParams.get('project')) || null
    const shouldResolveProject = type === 'all' || type === 'project'

    const resolvedOrgId = useMemo(() => {
        if (orgsLoading) return orgParam
        if (organizations.length === 0) return null
        if (orgParam && organizations.some((org) => org.id === orgParam)) return orgParam
        return organizations[0].id
    }, [orgsLoading, organizations, orgParam])

    const { data: projects = [], isLoading: projectsLoading } = useGetProjectsQuery(
        { organization: resolvedOrgId! },
        { skip: !resolvedOrgId }
    )

    const resolvedProjectId = useMemo(() => {
        if (!shouldResolveProject) return projectParam
        if (!resolvedOrgId || projectsLoading) return projectParam
        if (projects.length === 0) return null
        if (projectParam && projects.some((project) => project.id === projectParam)) return projectParam
        return projects[0].id
    }, [shouldResolveProject, resolvedOrgId, projectsLoading, projects, projectParam])

    useEffect(() => {
        if (orgsLoading) return
        if (shouldResolveProject && resolvedOrgId && projectsLoading) return

        const params = new URLSearchParams(searchParams)
        let changed = false

        const nextOrg = resolvedOrgId ? String(resolvedOrgId) : null
        if (params.get('org') !== nextOrg) {
            if (nextOrg) params.set('org', nextOrg)
            else params.delete('org')
            changed = true
        }

        if (shouldResolveProject) {
            const nextProject = resolvedProjectId ? String(resolvedProjectId) : null
            if (params.get('project') !== nextProject) {
                if (nextProject) params.set('project', nextProject)
                else params.delete('project')
                changed = true
            }
        }

        if (changed) {
            setSearchParams(params, { replace: true })
        }
    }, [
        orgsLoading,
        projectsLoading,
        resolvedOrgId,
        resolvedProjectId,
        searchParams,
        setSearchParams,
        shouldResolveProject,
    ])

    return {
        organizations,
        projects,
        orgsLoading,
        projectsLoading,
        currentOrgId: resolvedOrgId,
        currentProjectId: resolvedProjectId,
        hasNoOrganizations: !orgsLoading && organizations.length === 0,
        hasNoProjects: Boolean(resolvedOrgId) && !projectsLoading && projects.length === 0,
        searchParams,
        setSearchParams,
    }
}
