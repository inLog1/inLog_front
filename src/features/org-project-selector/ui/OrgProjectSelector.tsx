import { Loader2, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { routes } from '../../../shared/lib/routes'
import { Button } from '../../../shared/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../shared/ui/select'
import { type OrgProjectSelectorType, useEnsureOrgProjectParams } from '../model/useEnsureOrgProjectParams'

interface Props {
    type?: OrgProjectSelectorType
}

const OrgProjectSelector = ({
    type = 'all',
}: Props) => {
    const { t } = useTranslation()
    const {
        organizations,
        projects,
        orgsLoading,
        projectsLoading,
        currentOrgId,
        currentProjectId,
        searchParams,
        setSearchParams,
    } = useEnsureOrgProjectParams(type)

    const handleOrgChange = (value: string) => {
        const params = new URLSearchParams(searchParams)
        params.set('org', value)
        params.delete('project')
        params.delete('task')
        setSearchParams(params, { replace: true })
    }

    const handleProjectChange = (value: string) => {
        const params = new URLSearchParams(searchParams)
        params.set('project', value)
        params.delete('task')
        setSearchParams(params, { replace: true })
    }

    if (orgsLoading || projectsLoading) {
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
                            <Button asChild variant="outline" size="sm" className="w-full">
                                <Link to={routes.settings.organizationsAndProjects()}>
                                    <Plus className="h-4 w-4" />
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

                    {projects.length === 0 ? (
                        <div className="space-y-3 py-2">
                            <p className="text-sm text-muted-foreground">
                                {currentOrgId
                                    ? t('scheduler-page.no-projects-in-organization')
                                    : t('scheduler-page.select-organization-first')}
                            </p>
                            {currentOrgId && (
                                <Button asChild variant="outline" size="sm" className="w-full">
                                    <Link to={routes.settings.organizationsAndProjects()}>
                                        <Plus className="h-4 w-4" />
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
