import { Loader2 } from "lucide-react"
import { useCallback, useState } from "react"
import { useTranslation } from "react-i18next"
import { useSearchParams } from "react-router-dom"
import { useGetAdminPanelNodesQuery } from "../../../../entities/admin/model/adminSlice"
import type { AdminPanelGroup, AdminPanelNode, AdminPanelNodeTab } from "../../../../entities/admin/model/types"
import { ReportDetails } from "../../../../features/report/report-details"
import { ReportTree } from "../../../../features/report/report-tree"
import { ResponsiveSplit } from "../../../../shared/ui/responsive-split"

const AdminReportsPage = () => {
    const { t } = useTranslation()
    const [searchParams] = useSearchParams()
    const currentOrgId = Number(searchParams.get('org'))
    const [reportData,setReportData] = useState<{
        nodes: AdminPanelNode[]
        tabs: AdminPanelNodeTab[]
        columns: AdminPanelGroup[]
    }>({
        nodes: [],
        tabs: [],
        columns: []
    })

    const { data: adminPanelNodes, isLoading: isLoadingAdminPanelNodes } = useGetAdminPanelNodesQuery(
        { organizationId: currentOrgId },
        { skip: !currentOrgId }
    )

    const createReport = useCallback((data: { nodes: AdminPanelNode[], tabs: AdminPanelNodeTab[], columns: AdminPanelGroup[] }) => {
        setReportData(data)
    }, [])

    return (
        <ResponsiveSplit
            className="h-full min-h-0 rounded-lg border border-border"
            asideDefaultSize={100}
            mainDefaultSize={60}
            aside={
                <div className="h-full w-full p-3 sm:p-4">
                    {isLoadingAdminPanelNodes ? (
                        <div className="flex h-full items-center justify-center">
                            <Loader2 className="h-4 w-4 animate-spin" />
                        </div>
                    ) : !isLoadingAdminPanelNodes && adminPanelNodes?.length === 0 ? (
                        <div className="flex h-full items-center justify-center">
                            <p className="text-sm text-muted-foreground">
                                {t('admin-page.no-nodes-available')}
                            </p>
                        </div>
                    ) : (
                        <ReportTree
                            nodes={adminPanelNodes || []}
                            createReport={createReport}
                        />
                    )}
                </div>
            }
            main={
                <div className="h-full min-h-0 p-3 sm:p-4">
                    <ReportDetails selectedEntities={reportData} />
                </div>
            }
        />
    )
}

export default AdminReportsPage