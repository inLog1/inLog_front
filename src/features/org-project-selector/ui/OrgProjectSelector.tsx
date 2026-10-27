import { Loader2, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { routes } from '../../../shared/lib/routes'
import { cn } from '../../../shared/lib/utils'
import { Button } from '../../../shared/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../shared/ui/select'
import { type OrgProjectSelectorType, useEnsureOrgProjectParams } from '../model/useEnsureOrgProjectParams'

interface Props {
    type?: OrgProjectSelectorType
    appearance?: 'panel' | 'toolbar'
    persist?: boolean
}

const OrgProjectSelector = ({
    type = 'all',
    appearance = 'panel',
    persist = true,
}: Props) => {
    const { t } = useTranslation()
    const {
        organizations,
        projects,
        orgsLoading,
        projectsLoading,
        currentOrgId,
        currentProjectId,
        status,
        reason,
        selectOrganization,
        selectProject,
        refetch,
    } = useEnsureOrgProjectParams(type, { persist })

    const handleOrgChange = (value: string) => {
        const organizationId = Number(value)
        if (!Number.isInteger(organizationId)) return
        selectOrganization(organizationId)
    }

    const handleProjectChange = (value: string) => {
        const projectId = Number(value)
        if (!Number.isInteger(projectId)) return
        selectProject(projectId)
    }

    const showOrganization = type === 'all' || type === 'organization'
    const showProject = type === 'all' || type === 'project'

    if (appearance === 'toolbar') {
        if (status === 'error' && (reason === 'organizations-error' || reason === 'access-error')) {
            return (
                <Button type="button" variant="outline" size="sm" className="h-8 max-w-full" onClick={refetch}>
                    {t('workspace.retry')}
                </Button>
            )
        }
        if (orgsLoading) {
            return <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" aria-label={t('workspace.loading')} />
        }
        return (
            <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
                {showOrganization && (
                    <Select value={currentOrgId ? String(currentOrgId) : undefined} onValueChange={handleOrgChange}>
                        <SelectTrigger className="h-8 w-[min(100%,11rem)] min-w-[8rem] bg-background" aria-label={t('scheduler-page.organization')}>
                            <SelectValue placeholder={t('scheduler-page.select-organization-first')} />
                        </SelectTrigger>
                        <SelectContent>
                            {organizations.map((org) => (
                                <SelectItem key={org.id} value={org.id.toString()}>
                                    {org.fullName}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}
                {showProject && (
                    <Select
                        value={currentProjectId ? String(currentProjectId) : undefined}
                        onValueChange={handleProjectChange}
                        disabled={!currentOrgId || (!projectsLoading && projects.length === 0)}
                    >
                        <SelectTrigger className={cn('h-8 w-[min(100%,11rem)] min-w-[8rem] bg-background')} aria-label={t('scheduler-page.projects')}>
                            <SelectValue placeholder={projectsLoading ? t('workspace.loading') : t('scheduler-page.select-project-first')} />
                        </SelectTrigger>
                        <SelectContent>
                            {projects.map((proj) => (
                                <SelectItem key={proj.id} value={proj.id.toString()}>
                                    {proj.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}
            </div>
        )
    }

    if (status === 'error' && (reason === 'organizations-error' || reason === 'access-error')) {
        return (
            <div className="space-y-3 rounded-lg border border-border bg-card px-4 py-4" role="alert">
                <p className="text-sm text-muted-foreground">{t('workspace.organizations-error')}</p>
                <Button type="button" variant="outline" size="sm" className="w-full" onClick={refetch}>
                    {t('workspace.retry')}
                </Button>
            </div>
        )
    }

    if (orgsLoading) {
        return (
            <div className="flex items-center justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="space-y-6 px-4 py-4 bg-card rounded-lg border border-border">
            {(type === 'all' || type === 'organization') && (
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-muted-foreground">
                            {t('scheduler-page.organization')}
                        </span>
                    </div>

                    {organizations.length === 0 ? (
                        <div className="space-y-3 py-2">
                            <p className="text-sm text-muted-foreground">
                                {t('scheduler-page.no-organizations-yet')}
                            </p>
                            <Button asChild variant="outline" size="sm" className="w-full whitespace-nowrap">
                                <Link to={routes.settings.organizationsAndProjects()}>
                                    <Plus className="h-4 w-4 shrink-0" />
                                    {t('scheduler-page.create-first-organization')}
                                </Link>
                            </Button>
                        </div>
                    ) : (
                        <Select
                            value={currentOrgId?.toString() || ''}
                            onValueChange={handleOrgChange}
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder={t('scheduler-page.select-organization-first')} />
                            </SelectTrigger>
                            <SelectContent>
                                {organizations.map(org => (
                                    <SelectItem key={org.id} value={org.id.toString()}>
                                        {org.fullName}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                </div>
            )}

            {(type === 'all' || type === 'project') && (
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-muted-foreground">
                            {t('scheduler-page.projects')}
                        </span>
                    </div>

                    {status === 'error' && reason === 'projects-error' ? (
                        <div className="space-y-3 py-2" role="alert">
                            <p className="text-sm text-muted-foreground">{t('workspace.projects-error')}</p>
                            <Button type="button" variant="outline" size="sm" className="w-full" onClick={refetch}>
                                {t('workspace.retry')}
                            </Button>
                        </div>
                    ) : projectsLoading ? (
                        <div className="flex items-center justify-center py-4">
                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                    ) : projects.length === 0 ? (
                        <div className="space-y-3 py-2">
                            <p className="text-sm text-muted-foreground">
                                {currentOrgId
                                    ? t('scheduler-page.no-projects-in-organization')
                                    : t('scheduler-page.select-organization-first')}
                            </p>
                            {currentOrgId && (
                                <Button asChild variant="outline" size="sm" className="w-full whitespace-nowrap">
                                    <Link to={routes.settings.organizationsAndProjects()}>
                                        <Plus className="h-4 w-4 shrink-0" />
                                        {t('settings-page.create-first-project')}
                                    </Link>
                                </Button>
                            )}
                        </div>
                    ) : (
                        <Select
                            value={currentProjectId?.toString() || ''}
                            onValueChange={handleProjectChange}
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder={t('scheduler-page.select-project-first')} />
                            </SelectTrigger>
                            <SelectContent>
                                {projects.map(proj => (
                                    <SelectItem key={proj.id} value={proj.id.toString()}>
                                        {proj.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                </div>
            )}
        </div>
    )
}

export default OrgProjectSelector
