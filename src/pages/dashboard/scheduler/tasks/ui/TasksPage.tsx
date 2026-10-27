import { Tasks } from "../../../../../features/tasks"
import { useState } from "react"
import { Calendar, Kanban, LayoutList } from "lucide-react"
import { Tabs, TabsList, TabsTrigger } from "../../../../../shared/ui/tabs"
import TasksKanban from "../../../../../features/tasks/tasks-kanban"
import { useTranslation } from "react-i18next"
import { cn } from "../../../../../shared/lib/utils"
import { TasksRoadmap } from "../../../../../features/tasks/tasks-roadmap"
import { WorkspaceStatus } from "../../../../../features/org-project-selector"
import { useWorkspaceSection } from "../../../../../features/org-project-selector/model/useWorkspaceSection"

type ViewMode = "list" | "kanban" | "roadmap"

const TasksPage = () => {
    const { t } = useTranslation()
    const [viewMode, setViewMode] = useState<ViewMode>("list")
    const section = useWorkspaceSection('project', { resource: 'tasks', action: 'read' })

    if (section.kind !== 'ready' || section.projectId == null) {
        return <WorkspaceStatus status={section.kind === 'ready' ? 'loading' : section.status} reason={section.kind === 'ready' ? null : section.reason} onRetry={section.refetch} />
    }

    const projectId = section.projectId

    return (
        <div className="space-y-4 min-w-0">
            <div className="flex justify-start">
                <Tabs
                    value={viewMode}
                    onValueChange={(value) => setViewMode(value as ViewMode)}
                    className="w-auto"
                >
                    <TabsList className="grid w-[400px] grid-cols-3">
                        <TabsTrigger value="list" className={cn("flex items-center gap-2 cursor-pointer")}>
                            <LayoutList className="h-4 w-4" />
                            <span>{t('buttons.list')}</span>
                        </TabsTrigger>
                        <TabsTrigger value="kanban" className={cn("flex items-center gap-2 cursor-pointer")}>
                            <Kanban className="h-4 w-4" />
                            <span>{t('buttons.kanban')}</span>
                        </TabsTrigger>
                        <TabsTrigger value="roadmap" className={cn("flex items-center gap-2 cursor-pointer")}>
                            <Calendar className="h-4 w-4" />
                            <span>{t('buttons.roadmap')}</span>
                        </TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>

            <div className="h-full">
                {viewMode === "list" && <Tasks key={projectId} projectId={projectId} organizationId={section.organizationId} />}
                {viewMode === "kanban" && (
                    <div className="h-full w-full overflow-hidden min-w-0">
                        <TasksKanban key={projectId} projectId={projectId} organizationId={section.organizationId} />
                    </div>
                )}
                {viewMode === "roadmap" && (
                    <div className="h-full w-full overflow-hidden min-w-0">
                        <TasksRoadmap key={projectId} projectId={projectId} organizationId={section.organizationId} />
                    </div>
                )}
            </div>

        </div>
    )
}

export default TasksPage
