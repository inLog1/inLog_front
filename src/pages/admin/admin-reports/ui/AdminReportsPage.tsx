import { Loader2 } from "lucide-react"
import { useCallback, useState } from "react"
import { useTranslation } from "react-i18next"
import { useGetAdminPanelNodesQuery } from "../../../../entities/admin/model/adminSlice"
import { WorkspaceStatus } from "../../../../features/org-project-selector"
import { useHasOrganizationGrant, useWorkspaceSection } from "../../../../features/org-project-selector/model/useWorkspaceSection"
import type { AdminPanelGroup, AdminPanelNode, AdminPanelNodeTab } from "../../../../entities/admin/model/types"
import { ReportDetails } from "../../../../features/report/report-details"
import { ReportTree } from "../../../../features/report/report-tree"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "../../../../shared/ui/resizable"

const AdminReportsPage = () => {
    const section = useWorkspaceSection('organization', { resource: 'reports', action: 'read' })
    const currentOrgId = section.kind === 'ready' ? section.organizationId : null
    const canGenerate = useHasOrganizationGrant('reports', 'generate', currentOrgId)

    if (section.kind !== 'ready' || currentOrgId == null) {
        return (
            <WorkspaceStatus
                status={section.kind === 'ready' ? 'loading' : section.status}
                reason={section.kind === 'ready' ? null : section.reason}
                onRetry={section.refetch}
            />
        )
    }

    return <AdminReportsWorkspace key={currentOrgId} organizationId={currentOrgId} canGenerate={canGenerate} />
}

const AdminReportsWorkspace = ({ organizationId, canGenerate }: { organizationId: number; canGenerate: boolean }) => {
    const { t } = useTranslation()
    const [reportData, setReportData] = useState<{
        nodes: AdminPanelNode[]
        tabs: AdminPanelNodeTab[]
        columns: AdminPanelGroup[]
    }>({
        nodes: [],
        tabs: [],
        columns: []
    })

    const { data: adminPanelNodes, isLoading: isLoadingAdminPanelNodes, isError: nodesError, refetch: refetchNodes } = useGetAdminPanelNodesQuery(
        { organizationId }
    )

    const createReport = useCallback((data: { nodes: AdminPanelNode[], tabs: AdminPanelNodeTab[], columns: AdminPanelGroup[] }) => {
        setReportData(data)
    }, [])

    return (
            <ResizablePanelGroup
            className="h-fit rounded-lg border border-border "
            orientation="horizontal"
        >
            <ResizablePanel
                defaultSize={100}
            >
                <div className="p-4 h-full w-full">
                    {isLoadingAdminPanelNodes ? (
                        <div className="flex items-center justify-center h-full">
                            <Loader2 className="h-4 w-4 animate-spin" />
                        </div>
                    ) : nodesError ? (
                        <div className="flex h-full flex-col items-center justify-center gap-3" role="alert">
                            <p className="text-sm text-muted-foreground">{t('workspace.section-error')}</p>
                            <button type="button" className="text-sm underline" onClick={() => void refetchNodes()}>
                                {t('workspace.retry')}
                            </button>
                        </div>
                    ) : !isLoadingAdminPanelNodes && adminPanelNodes?.length === 0 ? (
                        <div className="flex items-center justify-center h-full">
                            <p className="text-sm text-muted-foreground">
                                {t('admin-page.no-nodes-available')}
                            </p>
                        </div>
                    ) : (
                        <ReportTree
                            nodes={adminPanelNodes || []}
                            createReport={createReport}
                            canGenerate={canGenerate}
                        />
                    )}

                </div>

            </ResizablePanel>

            <ResizableHandle withHandle />

            <ResizablePanel defaultSize={60} className="border-none rounded-none">
                <div className="h-[calc(100vh-64px-32px)] p-4" >
                    <ReportDetails organizationId={organizationId} canGenerate={canGenerate} selectedEntities={reportData} />
                </div>
            </ResizablePanel>
        </ResizablePanelGroup>
    )
}

export default AdminReportsPage