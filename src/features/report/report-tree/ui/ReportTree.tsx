import {
    hotkeysCoreFeature,
    selectionFeature,
    syncDataLoaderFeature
} from '@headless-tree/core'
import { useTree } from '@headless-tree/react'
import { ChevronsUpDown, FolderTree } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { AdminPanelGroup, AdminPanelNode, AdminPanelNodeTab } from '../../../../entities/admin/model/types'
import { cn } from '../../../../shared/lib/utils'
import { Button } from '../../../../shared/ui/button'
import { Checkbox } from '../../../../shared/ui/checkbox'
import { ScrollArea } from '../../../../shared/ui/scroll-area'
import ReportTreeNode from './ReportTreeNode'

type TreeNodeData = number

interface Props {
    className?: string
    nodes: AdminPanelNode[]
    createReport: (data: { nodes: AdminPanelNode[], tabs: AdminPanelNodeTab[], columns: AdminPanelGroup[] }) => void
}

const ReportTree = ({
    nodes = [],
    createReport,
    className = '',
}: Props) => {
    const { t, i18n } = useTranslation()
    const currentLang = i18n.language === 'ru' ? 'ru' : 'en'
    const [currentNodes, setCurrentNodes] = useState<AdminPanelNode[]>(nodes)
    const [forceUpdateKey, setForceUpdateKey] = useState(0)
    const [allExpanded, setAllExpanded] = useState(true)
    const [selectedNodes, setSelectedNodes] = useState<AdminPanelNode[]>([])
    const [selectedTabs, setSelectedTabs] = useState<AdminPanelNodeTab[]>([])
    const [selectedColumns, setSelectedColumns] = useState<AdminPanelGroup[]>([])
    const [isDisabledCreateReport, setIsDisabledCreateReport] = useState(false)

    const [initialTabs, setInitialTabs] = useState<AdminPanelNodeTab[]>([])
    const [initialColumns, setInitialColumns] = useState<AdminPanelGroup[]>([])

    useEffect(() => {
        setCurrentNodes(nodes)
        setForceUpdateKey(prev => prev + 1)
    }, [nodes])

    useEffect(() => {
        if (selectedNodes.length === 0 && selectedTabs.length === 0 && selectedColumns.length === 0) {
            setIsDisabledCreateReport(true)
        } else {
            setIsDisabledCreateReport(false)
        }
    }, [selectedNodes, selectedTabs, selectedColumns])

    const { nodesMap, rootIds } = useMemo(() => {
        const map = new Map<number, AdminPanelNode>()
        currentNodes.forEach(node => {
            map.set(node.id, node)
        })

        const roots = currentNodes
            .filter(node => node.parent === null || !map.has(node.parent))
            .map(node => node.id)

        return { nodesMap: map, rootIds: roots }
    }, [currentNodes])

    const getItemName = useCallback((item: any) => {
        const node = nodesMap.get(item.getItemData())
        if (!node) return ''
        return currentLang === 'ru' ? node.name_ru : node.name_en
    }, [nodesMap, currentLang])

    const isItemFolder = useCallback((item: any) => {
        const node = nodesMap.get(item.getItemData())
        if (!node) return false
        return currentNodes.some(child => child.parent === node.id)
    }, [nodesMap, currentNodes])

    const getChildren = useCallback((itemId: string) => {
        if (itemId === '__root__') {
            return rootIds.map(id => id.toString())
        }
        const nodeId = Number(itemId)
        const children = currentNodes.filter(node => node.parent === nodeId)
        return children.map(child => child.id.toString())
    }, [currentNodes, rootIds])

    const dataLoader = useMemo(() => ({
        getItem: (itemId: string) => {
            if (itemId === '__root__') return null as any
            return Number(itemId) as TreeNodeData
        },
        getChildren,
    }), [getChildren])

    const getAllChildrenIds = useCallback((nodeId: number): number[] => {
        const children = currentNodes.filter(node => node.parent === nodeId)
        let allChildren = [...children.map(child => child.id)]

        children.forEach(child => {
            allChildren = [...allChildren, ...getAllChildrenIds(child.id)]
        })

        return allChildren
    }, [currentNodes])

    const tree = useTree<TreeNodeData>({
        rootItemId: '__root__',
        getItemName,
        isItemFolder,
        dataLoader,
        features: [
            syncDataLoaderFeature,
            selectionFeature,
            hotkeysCoreFeature,
        ],
        setExpandedItems: (items) => {
            setAllExpanded(items.length > 0)
        },
    })

    const expandAllNodes = useCallback(() => {
        const allItems = tree.getItems()
        allItems.forEach(item => {
            if (item.isFolder() && !item.isExpanded()) {
                item.expand()
            }
        })
        setAllExpanded(true)
    }, [tree])

    const collapseAllNodes = useCallback(() => {
        const allItems = tree.getItems()
        allItems.forEach(item => {
            if (item.isFolder() && item.isExpanded()) {
                item.collapse()
            }
        })
        setAllExpanded(false)
    }, [tree])

    const toggleAllNodes = useCallback(() => {
        if (allExpanded) {
            collapseAllNodes()
        } else {
            expandAllNodes()
        }
    }, [allExpanded, expandAllNodes, collapseAllNodes])

    const handleToggle = useCallback((item: any) => {
        if (item.isExpanded()) {
            item.collapse()
        } else {
            item.expand()
        }
        setTimeout(() => {
            const allItems = tree.getItems()
            const allFoldersExpanded = allItems
                .filter(item => item.isFolder())
                .every(item => item.isExpanded())
            setAllExpanded(allFoldersExpanded)
        }, 0)
    }, [tree])

    const handleNodeSelect = useCallback((node: AdminPanelNode, checked: boolean) => {
        if (checked) {
            setSelectedNodes(prev => {
                const targetNode = prev.find(n => n.id === node.id)
                if (targetNode) return prev
                const result = [...prev, node]
                return result
            })
        } else {
            setSelectedNodes(prev => {
                if (!node.parent) return []
                const childNodes = currentNodes.filter(n => n.parent === node.id)
                const result = prev.filter(n => {
                    if (n.id === node.id) return false
                    if (childNodes.find(child => child.id === n.id)) return false
                    return true
                })
                return result
            })
            const relativeTabs = selectedTabs.filter(t => t.parent_node === node.id)
            const relativeColumns = selectedColumns.filter(c => c.parent_node === node.id)
            if (relativeTabs.length > 0) {
                setSelectedTabs(prev => {
                    return prev.filter(t => relativeTabs.find(tab => tab?.parent_node === t?.id))
                })
            }
            if (relativeColumns.length > 0) {
                setSelectedColumns(prev => {
                    return prev.filter(c => relativeColumns.find(column => column?.parent_node === c?.id))
                })
            }
            if (!node.parent) {
                setSelectedTabs([]);
                setSelectedColumns([]);
            }
        }
    }, [selectedTabs, selectedColumns])

    const handleTabSelect = useCallback((tab: AdminPanelNodeTab, checked: boolean, nodeId: number) => {
        if (checked) {
            setSelectedTabs(prev => {
                const targetTab = prev.find(t => t.id === tab.id)
                if (targetTab) return prev
                const result = [...prev, { ...tab, parent_node: nodeId }]
                return result
            })
        } else {
            setSelectedTabs(prev => {
                return prev.filter(t => t.id !== tab.id)
            })
            const relativeColumns = selectedColumns.filter(c => c?.parent_tab === tab.id)
            if (relativeColumns.length > 0) {
                setSelectedColumns(prev => {
                    return prev.filter(c => relativeColumns.find(column => column?.parent_tab === c?.id))
                })
            }
        }
    }, [selectedNodes, selectedTabs])

    const handleColumnSelect = useCallback((column: AdminPanelGroup, checked: boolean, nodeId: number) => {
        if (checked) {
            setSelectedColumns(prev => {
                const targetColumn = prev.find(c => c.id === column.id)
                if (targetColumn) return prev
                return [...prev, { ...column, parent_node: nodeId }]
            })
        } else {
            setSelectedColumns(prev => {
                return prev.filter(c => c.id !== column.id)
            })
        }
    }, [selectedNodes, selectedTabs])

    const handleCreateReport = useCallback(() => {
        const reportData = {
            nodes: selectedNodes,
            tabs: selectedTabs,
            columns: selectedColumns
        }
        createReport?.(reportData)
    }, [selectedNodes, selectedTabs, selectedColumns])

    const allNodesCount = currentNodes.length
    const hasFolders = useMemo(() => {
        return currentNodes.some(node =>
            currentNodes.some(child => child.parent === node.id)
        )
    }, [currentNodes])

    const handleSetInitialTabs = useCallback((tabs: AdminPanelNodeTab[]) => {
        setInitialTabs(prev => [...prev, ...tabs])
    }, [])

    const handleSetInitialColumns = useCallback((columns: AdminPanelGroup[]) => {
        setInitialColumns(prev => [...prev, ...columns])
    }, [])

    const isSelectAllEntities = useMemo(() => {
        return selectedTabs.length === initialTabs.length && selectedColumns.length === initialColumns.length && selectedNodes.length === currentNodes.length
    }, [selectedTabs, selectedColumns, selectedNodes, currentNodes])

    const handleSelectAllEntities = useCallback(() => {
        if (isSelectAllEntities) {
            setSelectedTabs([])
            setSelectedColumns([])
            setSelectedNodes([])
            return
        } else {
            setSelectedTabs(initialTabs)
            setSelectedColumns(initialColumns)
            setSelectedNodes(currentNodes)
        }
    }, [initialTabs, initialColumns, currentNodes, isSelectAllEntities])

    useEffect(() => {
        tree.rebuildTree()
        // if (allExpanded) {
        //     setTimeout(() => {
        //         expandAllNodes()
        //     }, 0)
        // }
    }, [forceUpdateKey, tree, allExpanded, expandAllNodes])

    return (
        <div className={cn("w-full h-full", className)}>
            {(allNodesCount > 0 && hasFolders) && (
                <div className="flex items-center justify-between gap-2 p-2 mb-2 border-b border-border/50">
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={toggleAllNodes}
                            className="h-7 gap-1 text-xs"
                            title={allExpanded ? t('buttons.collapse-all') : t('buttons.expand-all')}
                        >
                            <ChevronsUpDown className="h-3.5 w-3.5" />
                            <span>
                                {allExpanded ? t('buttons.collapse-all') : t('buttons.expand-all')}
                            </span>
                        </Button>
                    </div>
                    <div className="flex items-center gap-2 cursor-pointer" onClick={handleSelectAllEntities}>
                        <Checkbox
                            checked={isSelectAllEntities}
                            className='cursor-pointer'
                        />
                        <span className="text-xs font-medium">
                            {t('buttons.select-all')}
                        </span>
                    </div>
                    <Button
                        variant="default"
                        size="sm"
                        onClick={handleCreateReport}
                        className="h-7 gap-1 text-xs"
                        disabled={isDisabledCreateReport}
                    >
                        {t('buttons.create-report')}
                    </Button>
                </div>
            )}

            {allNodesCount === 0 ? (
                <div className="h-full flex flex-col items-center justify-center py-12 text-center">
                    <FolderTree className="h-12 w-12 text-muted-foreground/50 mb-3" />
                    <p className="text-muted-foreground">
                        {t('admin-page.no-nodes-available')}
                    </p>
                </div>
            ) : (
                <ScrollArea className="h-full min-h-0 overflow-y-auto">
                    <div {...tree.getContainerProps()} className="space-y-0.5 h-full">
                        {tree.getItems().map((item: any) => {
                            const nodeId = item.getItemData()
                            const node = nodesMap.get(nodeId)
                            const isChecked = selectedNodes.some(n => n.id === nodeId)

                            if (!node) return null

                            return (
                                <ReportTreeNode
                                    item={item}
                                    key={`${item.getId()}-${forceUpdateKey}`}
                                    node={node}
                                    nodes={nodes}
                                    isChecked={isChecked}
                                    selectedNodes={selectedNodes}
                                    selectedTabs={selectedTabs}
                                    selectedColumns={selectedColumns}
                                    onToggle={handleToggle}
                                    onNodeChange={handleNodeSelect}
                                    onTabSelect={handleTabSelect}
                                    onColumnSelect={handleColumnSelect}
                                    setInitialTabs={handleSetInitialTabs}
                                    setInitialColumns={handleSetInitialColumns}
                                />
                            )
                        })}
                    </div>
                </ScrollArea>
            )}
        </div>
    )
}

export default ReportTree