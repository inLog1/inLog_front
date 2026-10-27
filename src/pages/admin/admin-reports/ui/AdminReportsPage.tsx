import { Loader2 } from "lucide-react"
import { useCallback, useState } from "react"
import { useTranslation } from "react-i18next"
import { useGetAdminPanelNodesQuery } from "../../../../entities/admin/model/adminSlice"
import { WorkspaceStatus } from "../../../../features/org-project-selector"
import { useHasOrganizationGrant, useWorkspaceSection } from "../../../../features/org-project-selector/model/useWorkspaceSection"
import type { AdminPanelGroup, AdminPanelNode, AdminPanelNodeTab } from "../../../../entities/admin/model/types"
import { ReportDetails } from "../../../../features/report/report-details"
import { ReportTree } from "../../../../features/report/report-tree"
import { useMatchMedia } from "../../../../shared/lib/use-match-media"
import { Button } from "../../../../shared/ui/button"
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
    const narrow = useMatchMedia('(max-width: 1023px)')
    const [treeOpen, setTreeOpen] = useState(false)
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
        setTreeOpen(false)
    }, [])

    const tree = isLoadingAdminPanelNodes ? (
        <div className="flex h-full items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin" />
        </div>
    ) : nodesError ? (
        <div className="flex h-full flex-col items-center justify-center gap-3" role="alert">
            <p className="text-sm text-muted-foreground">{t('workspace.section-error')}</p>
            <button type="button" className="text-sm underline" onClick={() => void refetchNodes()}>
                {t('workspace.retry')}
            </button>
        </div>
    ) : adminPanelNodes?.length === 0 ? (
        <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted-foreground">{t('admin-page.no-nodes-available')}</p>
        </div>
    ) : (
        <ReportTree nodes={adminPanelNodes || []} createReport={createReport} canGenerate={canGenerate} />
    )

    const result = (
        <ReportDetails organizationId={organizationId} canGenerate={canGenerate} selectedEntities={reportData} />
    )

    if (narrow) {
        return (
            <div className="flex h-full min-w-0 flex-col">
                <div className="flex items-center gap-2 border-b border-border px-3 py-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setTreeOpen(true)}>
                        {t('shell.show-structure')}
                    </Button>
                </div>
                <div className="min-h-0 min-w-0 flex-1 overflow-auto p-3">{result}</div>
                {treeOpen && (
                    <div className="fixed inset-0 z-40">
                        <button type="button" className="absolute inset-0 bg-black/40" aria-label={t('shell.close-structure')} onClick={() => setTreeOpen(false)} />
                        <div className="absolute inset-y-0 left-0 flex w-[min(100%,20rem)] max-w-full flex-col overflow-hidden bg-background shadow-xl">
                            <div className="flex justify-end border-b border-border p-2">
                                <Button type="button" variant="ghost" size="sm" onClick={() => setTreeOpen(false)}>
                                    {t('shell.close-structure')}
                                </Button>
                            </div>
                            <div className="min-h-0 flex-1 overflow-auto p-3">{tree}</div>
                        </div>
                    </div>
                )}
            </div>
        )
    }

    return (
        <ResizablePanelGroup className="h-full min-w-0 max-w-full overflow-hidden rounded-lg border border-border" orientation="horizontal">
            <ResizablePanel defaultSize={32} minSize={20} className="min-w-0 overflow-hidden">
                <div className="h-full min-w-0 overflow-auto p-4">{tree}</div>
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={68} minSize={40} className="min-w-0 overflow-hidden">
                <div className="h-full min-w-0 overflow-auto p-4">{result}</div>
            </ResizablePanel>
        </ResizablePanelGroup>
    )
}

export default AdminReportsPage