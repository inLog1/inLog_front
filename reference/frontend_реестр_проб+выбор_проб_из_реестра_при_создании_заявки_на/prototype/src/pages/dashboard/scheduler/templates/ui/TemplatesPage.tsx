'use client'

import { WorkspaceStatus } from "../../../../../features/org-project-selector"
import { useWorkspaceSection } from "../../../../../features/org-project-selector/model/useWorkspaceSection"
import { Tasks } from "../../../../../features/tasks"

const TemplatesPage = () => {
    const section = useWorkspaceSection('project', { resource: 'tasks', action: 'read' })
    if (section.kind !== 'ready' || section.projectId == null) {
        return (
            <WorkspaceStatus
                status={section.kind === 'ready' ? 'loading' : section.status}
                reason={section.kind === 'ready' ? null : section.reason}
                onRetry={section.refetch}
            />
        )
    }

    return (
        <div className="space-y-4 min-w-0">
            <Tasks key={section.projectId} type="templates-page" projectId={section.projectId} organizationId={section.organizationId} />
        </div>
    )
}

export default TemplatesPage
