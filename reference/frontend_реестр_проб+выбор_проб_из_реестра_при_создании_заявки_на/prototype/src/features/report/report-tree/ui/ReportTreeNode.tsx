import { ChevronDown, ChevronRight, FileText, FolderTree, Link as LinkIcon } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useGetAdminPanelGroupsQuery } from '../../../../entities/admin/model/adminSlice'
import type { AdminPanelGroup, AdminPanelNode, AdminPanelNodeTab } from '../../../../entities/admin/model/types'
import { cn } from '../../../../shared/lib/utils'
import { Checkbox } from '../../../../shared/ui/checkbox'
import {
    HoverCard,
    HoverCardContent,
    HoverCardTrigger,
} from "../../../../shared/ui/hover-card" // Импортируем HoverCard
import ReportTreeColumn from './ReportTreeColumn'
import ReportTreeTab from './ReportTreeTab'
import { Badge } from '../../../../shared/ui/badge'

interface Props {
    item: any
    node: AdminPanelNode
    isChecked?: boolean
    selectedNodes?: AdminPanelNode[]
    selectedTabs?: AdminPanelNodeTab[]
    selectedColumns?: AdminPanelGroup[]
    nodes: AdminPanelNode[]
    // connectionTabs: AdminPanelNodeTab[]
    onToggle?: (item: any) => void
    onNodeChange?: (node: AdminPanelNode, checked: boolean) => void
    onTabSelect?: (tab: AdminPanelNodeTab, checked: boolean, nodeId: number) => void
    onColumnSelect?: (column: AdminPanelGroup, checked: boolean, nodeId: number) => void
    setInitialTabs?: (tabs: AdminPanelNodeTab[]) => void
    setInitialColumns?: (columns: AdminPanelGroup[]) => void
}

const ReportTreeNode = ({
    item,
    node,
    isChecked = false,
    selectedNodes = [],
    selectedTabs = [],
    selectedColumns = [],
    nodes = [],
    // connectionTabs = [],
    onToggle,
    onNodeChange,
    onTabSelect,
    onColumnSelect,
    setInitialTabs,
    setInitialColumns,
}: Props) => {
    const { i18n, t } = useTranslation()
    const currentLang = i18n.language === 'ru' ? 'ru' : 'en'
    const displayName = currentLang === 'ru' ? node.name_ru : node.name_en
    const [connectionNodes, setConnectionNodes] = useState<AdminPanelNode[]>([])

    useEffect(() => {
        if (node.related_groups?.length > 0) {
            setConnectionNodes(nodes.filter(n => node.related_groups.includes(n.id)))
        } else {
            setConnectionNodes([])
        }
    }, [nodes, node.related_groups])


    const hasChildren = item.isFolder()
    const isExpanded = item.isExpanded()
    const level = item.getItemMeta().level

    const { data: columnsData } = useGetAdminPanelGroupsQuery({
        ['group']: node.id,
        organizationId: node.organization,
    }, {
        skip: !node.id || !node.organization || (hasChildren && !isExpanded)
    })

    const tabs = useMemo(() => {
        return node?.pre_made_structure_elements?.map((tab: AdminPanelNodeTab, i: number, arr: AdminPanelNodeTab[]) =>
            tab.id ? tab : { ...tab, id: i === 0 ? 0 : arr[i - 1]?.id! + 1 }
        ) || []
    }, [node?.pre_made_structure_elements])

    const columnsByTab = useMemo(() => {
        if (!columnsData) return new Map<number, any[]>()
        const map = new Map<number, any[]>()
        columnsData.forEach(column => {
            const tabId = column.structure_element
            if (!map.has(tabId)) map.set(tabId, [])
            map.get(tabId)!.push(column)
        })
        return map
    }, [columnsData])

    const orphanColumns = useMemo(() => {
        if (!columnsData) return []
        return columnsData.filter(column => !column.structure_element)
    }, [columnsData])

    useEffect(() => {
        setInitialTabs?.(tabs)
    }, [tabs, setInitialTabs])

    useEffect(() => {
        setInitialColumns?.(orphanColumns)
    }, [orphanColumns, setInitialColumns])

    const handleNodeSelect = (e: React.MouseEvent) => {
        e.stopPropagation()
        onNodeChange?.(node, !isChecked)
    }

    const handleTabSelect = (tab: AdminPanelNodeTab, checked: boolean, e: React.MouseEvent) => {
        e.stopPropagation()
        onTabSelect?.(tab, checked, node.id)
    }

    const handleColumnSelect = (column: AdminPanelGroup, checked: boolean, e: React.MouseEvent) => {
        e.stopPropagation()
        onColumnSelect?.(column, checked, node.id)
    }

    const isTabSelected = (tab: AdminPanelNodeTab) => !!selectedTabs.find(t => t.id === tab.id)
    const isColumnSelected = (column: AdminPanelGroup) => !!selectedColumns.find(c => c.id === column.id)

    const disableNodeCheckbox = useCallback(() => {
        if (!node.parent) return false
        return !(selectedNodes?.some(item => item.id === node.parent))
    }, [selectedNodes, node])

    const disableTabCheckbox = useCallback((tab: AdminPanelNodeTab) => {
        if (!selectedNodes?.some(item => item.id === node.id)) return true
        if (tab.related_structure_elements?.length) {
            const parentTabs = tab.related_structure_elements
                .map(relatedId => {
                    for (const el of selectedNodes) {
                        const nested = el.pre_made_structure_elements?.find(n => n.id === relatedId)
                        if (nested) return nested
                    }
                    return null
                })
                .filter((t): t is AdminPanelNodeTab =>
                    !!t && !!t.nestLevel && !!tab.nestLevel && t.nestLevel! < tab.nestLevel!
                )
            if (parentTabs.length > 0 && !parentTabs.some(parent => selectedNodes?.some(sel => sel.id === parent.id))) {
                return true
            }
        }
        return false
    }, [selectedNodes, node])

    const disableColumnCheckbox = useCallback(() => {
        return !(selectedNodes?.find(item => item?.id === node.id))
    }, [selectedNodes, node.id])

    const renderConnections = () => (
        <div className="space-y-2">
            <h4 className="text-sm font-semibold flex items-center gap-2">
                <LinkIcon className="h-3 w-3" />
                {t('admin-page.related-nodes')}
            </h4>
            <div className="flex flex-col gap-1">
                {connectionNodes.map((conn) => (
                    <Badge key={conn.id} className="bg-accent text-xs py-1 px-2 rounded-lg">
                        {currentLang === 'ru' ? conn.name_ru : conn.name_en}
                    </Badge>
                ))}
            </div>
        </div>
    )

    const isDisabled = disableNodeCheckbox()

    const nodeContent = (
        <div
            {...item.getProps()}
            className={cn(
                "w-fit flex items-center gap-2 py-2 px-3 rounded-lg transition-colors cursor-pointer group",
                "hover:bg-accent hover:text-accent-foreground",
                isDisabled ? "cursor-not-allowed" : "cursor-pointer"
            )}
            style={{ paddingLeft: `${level * 20 + 12}px` }}
        >
            <div onClick={isDisabled ? undefined : handleNodeSelect} className="flex-shrink-0">
                <Checkbox
                    className='cursor-pointer'
                    checked={isChecked}
                    disabled={isDisabled}
                    onCheckedChange={(checked) => onNodeChange?.(node, checked as boolean)}
                />
            </div>

            {hasChildren && (
                <button
                    onClick={(e) => {
                        e.stopPropagation()
                        onToggle?.(item)
                    }}
                    className="flex-shrink-0 p-0.5 rounded hover:bg-muted transition-colors"
                >
                    {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                </button>
            )}

            {!hasChildren && <div className="w-0" />}

            {hasChildren ? (
                <FolderTree className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            ) : (
                <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            )}

            <span className="text-sm flex-1 truncate">
                {displayName}
            </span>
        </div>
    )

    return (
        <div className="select-none">
            {connectionNodes.length > 0 ? (
                <HoverCard openDelay={100}>
                    <HoverCardTrigger asChild>
                        {nodeContent}
                    </HoverCardTrigger>
                    <HoverCardContent side="right" align="start" className="w-72 z-[100]">
                        {renderConnections()}
                    </HoverCardContent>
                </HoverCard>
            ) : (
                nodeContent
            )}

            {(tabs.length > 0 || orphanColumns.length > 0 || columnsByTab.size > 0) && (
                <div
                    style={{ marginLeft: `${level * 26 + 12}px` }}
                    className="mt-1 mb-2 space-y-3 border-l-2 border-border/50 ml-4 pl-4"
                >
                    {tabs.length > 0 && (
                        <div className="space-y-1 border-border border rounded-lg p-2 bg-card/50">
                            <h6 className="text-[10px] uppercase font-bold text-muted-foreground/70 mb-2">
                                {t('admin-page.tabs')}
                            </h6>
                            {tabs.map((tab) => (
                                <ReportTreeTab
                                    key={`tab-${tab.id}`}
                                    tab={tab}
                                    organizationId={node.organization}
                                    isExpanded={hasChildren ? isExpanded : true}
                                    selectedColumns={selectedColumns}
                                    nodes={nodes}
                                    setInitialColumns={setInitialColumns}
                                    isSelected={isTabSelected(tab)}
                                    disabledTab={disableTabCheckbox(tab)}
                                    disabledColumn={!isTabSelected(tab)}
                                    onTabSelect={handleTabSelect}
                                    onColumnSelect={handleColumnSelect}
                                />
                            ))}
                        </div>
                    )}

                    {/* Рендер колонок без привязки к вкладкам */}
                    {orphanColumns.length > 0 && (
                        <div className="space-y-1 border-border border rounded-lg p-2 bg-card/50">
                            <h6 className="text-[10px] uppercase font-bold text-muted-foreground/70 mb-2">
                                {t('admin-page.columns')}
                            </h6>
                            {orphanColumns.map((column) => (
                                <ReportTreeColumn
                                    key={`column-${column.id}`}
                                    column={column}
                                    isSelected={isColumnSelected(column)}
                                    disabled={disableColumnCheckbox()}
                                    onSelect={handleColumnSelect}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

export default ReportTreeNode