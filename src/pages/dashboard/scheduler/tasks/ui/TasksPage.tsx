import { Tasks } from "../../../../../features/tasks"
import { useState } from "react"
import { Building2, Calendar, FolderOpen, Kanban, LayoutList, Plus } from "lucide-react"
import { Tabs, TabsList, TabsTrigger } from "../../../../../shared/ui/tabs"
import TasksKanban from "../../../../../features/tasks/tasks-kanban"
import { useTranslation } from "react-i18next"
import { Link, useSearchParams } from "react-router-dom"
import { cn } from "../../../../../shared/lib/utils"
import { TasksRoadmap } from "../../../../../features/tasks/tasks-roadmap"
import { useEnsureOrgProjectParams } from "../../../../../features/org-project-selector"
import { Button } from "../../../../../shared/ui/button"
import { routes } from "../../../../../shared/lib/routes"

type ViewMode = "list" | "kanban" | "roadmap"

const TasksPage = () => {
    const { t } = useTranslation()
    const [viewMode, setViewMode] = useState<ViewMode>("list")
    const [searchParams] = useSearchParams()
    const projectId = searchParams.get('project')
    const { hasNoOrganizations, hasNoProjects } = useEnsureOrgProjectParams()

    if (hasNoOrganizations || hasNoProjects) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="text-center max-w-md text-muted-foreground border border-border/50 rounded-lg p-10">
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
                    <Button asChild variant="outline">
                        <Link to={routes.settings.organizationsAndProjects()}>
                            <Plus className="h-4 w-4" />
                            {hasNoOrganizations
                                ? t('scheduler-page.create-first-organization')
                                : t('settings-page.create-first-project')}
                        </Link>
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-4 min-w-0">
            <div className="flex justify-start">
                <Tabs
                    value={viewMode}
                    onValueChange={(value) => setViewMode(value as ViewMode)}
                    className="w-auto"
                >
                    <TabsList className="grid w-[400px] grid-cols-3">
                        <TabsTrigger disabled={!projectId} value="list" className={cn("flex items-center gap-2 cursor-pointer", !projectId && "opacity-50 cursor-not-allowed")}>
                            <LayoutList className="h-4 w-4" />
                            <span>{t('buttons.list')}</span>
                        </TabsTrigger>
                        <TabsTrigger disabled={!projectId} value="kanban" className={cn("flex items-center gap-2 cursor-pointer", !projectId && "opacity-50 cursor-not-allowed")}>
                            <Kanban className="h-4 w-4" />
                            <span>{t('buttons.kanban')}</span>
                        </TabsTrigger>
                        <TabsTrigger disabled={!projectId} value="roadmap" className={cn("flex items-center gap-2 cursor-pointer", !projectId && "opacity-50 cursor-not-allowed")}>
                            <Calendar className="h-4 w-4" />
                            <span>{t('buttons.roadmap')}</span>
                        </TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>

            <div className="h-full">
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