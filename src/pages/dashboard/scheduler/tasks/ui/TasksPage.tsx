import { Tasks } from "../../../../../features/tasks"
import { useState } from "react"
import { Building2, Calendar, FolderOpen, Kanban, LayoutList, Plus } from "lucide-react"
import { Tabs, TabsList, TabsTrigger } from "../../../../../shared/ui/tabs"
import TasksKanban from "../../../../../features/tasks/tasks-kanban"
import { useTranslation } from "react-i18next"
import { useSelector } from "react-redux"
import { Link, useSearchParams } from "react-router-dom"
import { selectUser } from "../../../../../entities/user/model/selectors"
import { canAccessSection } from "../../../../../shared/lib/available-features"
import { cn } from "../../../../../shared/lib/utils"
import { TasksRoadmap } from "../../../../../features/tasks/tasks-roadmap"
import { useEnsureOrgProjectParams } from "../../../../../features/org-project-selector"
import { Button } from "../../../../../shared/ui/button"
import { routes } from "../../../../../shared/lib/routes"

type ViewMode = "list" | "kanban" | "roadmap"

const TasksPage = () => {
    const { t } = useTranslation()
    const user = useSelector(selectUser)
    const [viewMode, setViewMode] = useState<ViewMode>("list")
    const [searchParams] = useSearchParams()
    const projectId = searchParams.get('project')
    const { hasNoOrganizations, hasNoProjects } = useEnsureOrgProjectParams()
    const createTargetOpen = canAccessSection(user, hasNoOrganizations ? 'organizations' : 'projects')

    if (hasNoOrganizations || hasNoProjects) {
        return (
            <div className="flex min-h-[50vh] items-center justify-center px-4">
                <div className="max-w-md rounded-lg border border-border/50 p-6 text-center text-muted-foreground sm:p-10">
                    {hasNoOrganizations ? (
                        <Building2 className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                    ) : (
                        <FolderOpen className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                    )}
                    <p className="mb-4">
                        {hasNoOrganizations
                            ? t('scheduler-page.need-organization-and-project')
                            : t('scheduler-page.need-project')}
                    </p>
                    {createTargetOpen && (
                        <Button asChild variant="outline">
                            <Link to={hasNoOrganizations ? routes.settings.organizations() : routes.settings.projects()}>
                                <Plus className="h-4 w-4" />
                                {hasNoOrganizations
                                    ? t('scheduler-page.create-first-organization')
                                    : t('settings-page.create-first-project')}
                            </Link>
                        </Button>
                    )}
                </div>
            </div>
        )
    }

    return (
        <div className="flex h-full min-h-0 min-w-0 flex-col gap-3 sm:gap-4">
            <div className="flex justify-start">
                <Tabs
                    value={viewMode}
                    onValueChange={(value) => setViewMode(value as ViewMode)}
                    className="w-full max-w-md"
                >
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger disabled={!projectId} value="list" className={cn("flex items-center gap-2 cursor-pointer", !projectId && "opacity-50 cursor-not-allowed")}>
                            <LayoutList className="h-4 w-4" />
                            <span className="hidden sm:inline">{t('buttons.list')}</span>
                            <span className="sr-only sm:hidden">{t('buttons.list')}</span>
                        </TabsTrigger>
                        <TabsTrigger disabled={!projectId} value="kanban" className={cn("flex items-center gap-2 cursor-pointer", !projectId && "opacity-50 cursor-not-allowed")}>
                            <Kanban className="h-4 w-4" />
                            <span className="hidden sm:inline">{t('buttons.kanban')}</span>
                            <span className="sr-only sm:hidden">{t('buttons.kanban')}</span>
                        </TabsTrigger>
                        <TabsTrigger disabled={!projectId} value="roadmap" className={cn("flex items-center gap-2 cursor-pointer", !projectId && "opacity-50 cursor-not-allowed")}>
                            <Calendar className="h-4 w-4" />
                            <span className="hidden sm:inline">{t('buttons.roadmap')}</span>
                            <span className="sr-only sm:hidden">{t('buttons.roadmap')}</span>
                        </TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>

            <div className="min-h-0 flex-1">
                {viewMode === "list" && <Tasks />}
                {viewMode === "kanban" && (
                    <div className="h-full w-full overflow-hidden min-w-0">
                        <TasksKanban />
                    </div>
                )}
                {viewMode === "roadmap" && (
                    <div className="h-full w-full overflow-hidden min-w-0">
                        <TasksRoadmap />
                    </div>
                )}
            </div>

        </div>
    )
}

export default TasksPage