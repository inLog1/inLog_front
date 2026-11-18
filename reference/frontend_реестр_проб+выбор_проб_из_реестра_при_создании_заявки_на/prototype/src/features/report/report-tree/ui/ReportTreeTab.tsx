import { NotebookTabs, Link as LinkIcon } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useGetAdminPanelGroupsQuery } from "../../../../entities/admin/model/adminSlice"
import type { AdminPanelGroup, AdminPanelNode, AdminPanelNodeTab } from "../../../../entities/admin/model/types"
import { cn } from "../../../../shared/lib/utils"
import { Checkbox } from "../../../../shared/ui/checkbox"
import { 
    HoverCard, 
    HoverCardContent, 
    HoverCardTrigger 
} from "../../../../shared/ui/hover-card" 
import ReportTreeColumn from "./ReportTreeColumn"
import { findAllRelativeTabs } from "../../../constructor/constructor-tree/utils"
import { Badge } from "../../../../shared/ui/badge"

interface Props {
    tab: AdminPanelNodeTab
    isSelected: boolean
    disabledTab: boolean
    disabledColumn: boolean
    organizationId: number
    isExpanded: boolean
    selectedColumns: AdminPanelGroup[]
    nodes: AdminPanelNode[]
    onTabSelect: (tab: AdminPanelNodeTab, checked: boolean, e: React.MouseEvent) => void
    onColumnSelect: (column: AdminPanelGroup, checked: boolean, e: React.MouseEvent) => void
    setInitialColumns?: (columns: AdminPanelGroup[]) => void,
}

const ReportTreeTab = ({
    tab,
    isSelected,
    disabledTab,
    disabledColumn,
    organizationId,
    selectedColumns,
    nodes,
    onTabSelect, 
    onColumnSelect, 
    setInitialColumns,
}: Props) => {

    const { i18n, t } = useTranslation()
    const currentLang = i18n.language === 'ru' ? 'ru' : 'en'
    const tabName = currentLang === 'ru' ? tab.name_ru : tab.name_en
    const [connectionTabs, setConnectionTabs] = useState<AdminPanelNodeTab[]>([])

    useEffect(() => {
        if(nodes.length > 0 && tab.id) {
            const relativeTabs = findAllRelativeTabs(nodes, tab) || []
            setConnectionTabs(relativeTabs)
        } else {
            setConnectionTabs([])
        }
    }, [nodes, tab.id])

    const { data: columnsData } = useGetAdminPanelGroupsQuery({
        ['structure_element']: tab.id,
        organizationId: organizationId,
    }, {
        skip: !tab.id || !organizationId
    })

    const orphanColumns = useMemo(() => {
        if (!columnsData) return []
        return columnsData.map(column => ({ ...column, parent_tab: tab.id }))
    }, [columnsData, tab.id])

    const isColumnSelected = (column: AdminPanelGroup) => !!selectedColumns.find(c => c.id === column.id)

    useEffect(() => {
        setInitialColumns?.(orphanColumns)
    }, [orphanColumns, setInitialColumns])

    const renderConnections = () => (
        <div className="space-y-2">
            <h4 className="text-sm font-semibold flex items-center gap-2">
                <LinkIcon className="h-3 w-3" />
                {t('admin-page.related-tabs', 'Связанные табы')}
            </h4>
            <div className="grid gap-1">
                {connectionTabs.map((conn) => (
                    <Badge key={conn.id} className=" text-xs py-1 px-2 rounded-lg">
                        {currentLang === 'ru' ? conn.name_ru : conn.name_en}
                    </Badge>
                ))}
            </div>
        </div>
    )

    const TriggerContent = (
        <div 
            className={cn(
                "flex items-center gap-2 cursor-pointer w-fit p-2 rounded-lg transition-colors hover:bg-accent",
                disabledTab ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
            )}
            onClick={(e) => disabledTab ? undefined : onTabSelect(tab, !isSelected, e)}
        >
            <Checkbox
                className='cursor-pointer'
                checked={isSelected}
                disabled={disabledTab}
            />
            <NotebookTabs className="h-3 w-3 text-muted-foreground" />
            <span className="text-sm font-medium">
                {tabName}
            </span>
        </div>
    )

    return (
        <div className="space-y-1">
            {connectionTabs.length > 0 ? (
                <HoverCard openDelay={300}>
                    <HoverCardTrigger asChild>
                        {TriggerContent}
                    </HoverCardTrigger>
                    <HoverCardContent side="right" className="w-64 z-50">
                        {renderConnections()}
                    </HoverCardContent>
                </HoverCard>
            ) : (
                TriggerContent
            )}

            {orphanColumns && orphanColumns.length > 0 && (
                <div className="ml-4 mt-2 space-y-1 border-border border rounded-lg p-2 bg-card/50">
                    <h6 className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-2 flex items-center gap-1 opacity-70">
                        {t('admin-page.columns')}
                    </h6>
                    <div className="space-y-1">
                        {orphanColumns.map((column) => (
                            <ReportTreeColumn
                                key={`column-${column.id}`}
                                column={column}
                                isSelected={isColumnSelected(column)}
                                disabled={disabledColumn}
                                onSelect={(column, checked, e) =>disabledColumn ? undefined : onColumnSelect(column, checked, e)}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

export default ReportTreeTab