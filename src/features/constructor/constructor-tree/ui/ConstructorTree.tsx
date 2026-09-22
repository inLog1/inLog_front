import {
    hotkeysCoreFeature,
    selectionFeature,
    syncDataLoaderFeature,
    type FeatureImplementation
} from '@headless-tree/core'
import { useTree } from '@headless-tree/react'
import { ChevronsUpDown, FolderTree } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { AdminPanelNode, AdminPanelNodeRequest } from '../../../../entities/admin/model/types'
import { cn } from '../../../../shared/lib/utils'
import { Button } from '../../../../shared/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '../../../../shared/ui/dialog'
import { ConstructorTreeNode } from './ConstructorTreeNode'
import TreeNodeFormDialog from './TreeNodeFormDialog'
import { ScrollArea } from '../../../../shared/ui/scroll-area'

type TreeNodeData = number

interface Props {
    nodes: AdminPanelNode[]
    mode?: 'single' | 'multiple'
    selectedIds?: number[]
    onSelect?: (nodeId: number) => void
    onEdit?: (node: AdminPanelNode, body: AdminPanelNodeRequest) => void
    onDelete?: (node: AdminPanelNode) => void
    onCreate?: (body: AdminPanelNodeRequest) => void
    className?: string
}

const ConstructorTree = ({
    nodes = [],
    mode = 'single',
    selectedIds = [],
    onSelect,
    onEdit,
    onDelete,
    onCreate,
    className = '',
}: Props) => {
    const { t, i18n } = useTranslation()
    const currentLang = i18n.language === 'ru' ? 'ru' : 'en'

    const [currentNodes, setCurrentNodes] = useState<AdminPanelNode[]>(nodes)
    const [forceUpdateKey, setForceUpdateKey] = useState(0)
    const [allExpanded, setAllExpanded] = useState(true)

    useEffect(() => {
        setCurrentNodes(nodes)
        setForceUpdateKey(prev => prev + 1)
    }, [nodes])

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

    const [dialogState, setDialogState] = useState<{
        open: boolean
        mode: 'create' | 'edit'
        node?: AdminPanelNode
        parentNode?: AdminPanelNode
    }>({
        open: false,
        mode: 'create',
    })

    const [deleteDialogState, setDeleteDialogState] = useState<{
        open: boolean
        node?: AdminPanelNode
    }>({
        open: false,
    })

    const handleOpenCreateDialog = useCallback((parentNode?: AdminPanelNode) => {
        setDialogState({
            open: true,
            mode: 'create',
            parentNode,
        })
    }, [])

    const handleOpenEditDialog = useCallback((node: AdminPanelNode) => {
        setDialogState({
            open: true,
            mode: 'edit',
            node,
        })
    }, [])

    const handleCloseDialog = useCallback(() => {
        setDialogState({
            open: false,
            mode: 'create',
        })
    }, [])

    const handleOpenDeleteDialog = useCallback((node: AdminPanelNode) => {
        setDeleteDialogState({
            open: true,
            node,
        })
    }, [])

    const handleCloseDeleteDialog = useCallback(() => {
        setDeleteDialogState({
            open: false,
        })
    }, [])

    const handleConfirmCreate = useCallback(async (formData: { name_ru: string; name_en: string; related_groups: string[] }) => {
        onCreate?.({
            name_ru: formData.name_ru,
            name_en: formData.name_en,
            parent: dialogState.parentNode?.id || 0,
            organization: dialogState.parentNode?.organization || 0,
            related_groups: formData.related_groups.map(Number) || [],
        })
        handleCloseDialog()
    }, [onCreate, dialogState.parentNode, handleCloseDialog])

    const handleConfirmEdit = useCallback(async (formData: { name_ru: string; name_en: string; related_groups: string[] }) => {
        if (dialogState.node) {
            onEdit?.(dialogState.node, {
                name_ru: formData.name_ru,
                name_en: formData.name_en,
                organization: dialogState.node.organization,
                related_groups: formData.related_groups.map(Number) || [],
            })
            handleCloseDialog()
        }
    }, [onEdit, dialogState.node, handleCloseDialog])

    const handleConfirmDelete = useCallback(() => {
        if (deleteDialogState.node) {
            onDelete?.(deleteDialogState.node)
            handleCloseDeleteDialog()
        }
    }, [onDelete, deleteDialogState.node, handleCloseDeleteDialog])

    const toggleAllNodes = useCallback(() => {
        if (allExpanded) {
            collapseAllNodes()
        } else {
            expandAllNodes()
        }
    }, [allExpanded])

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

    const customClickBehavior: FeatureImplementation = useMemo(() => ({
        itemInstance: {
            getProps: ({ tree, item, prev }) => ({
                ...prev?.(),
                onDoubleClick: (e: MouseEvent) => {
                    e.stopPropagation()
                    if (item.isFolder()) {
                        if (item.isExpanded()) {
                            item.collapse()
                        } else {
                            item.expand()
                        }
                    }
                },
                onClick: () => {
                    const selectedItemId = item.getItemMeta().itemId
                    tree.setSelectedItems([selectedItemId])
                    item.setFocused()

                    if (selectedItemId) {
                        onSelect?.(Number(selectedItemId))
                    }
                },
            }),
        },
    }), [nodesMap, onSelect])

    const tree = useTree<TreeNodeData>({
        rootItemId: '__root__',
        getItemName,
        isItemFolder,
        dataLoader,
        features: [
            syncDataLoaderFeature,
            selectionFeature,
            hotkeysCoreFeature,
            customClickBehavior,
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

    const allNodesCount = currentNodes.length

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

    useEffect(() => {
        tree.rebuildTree()
        if (allExpanded) {
            setTimeout(() => {
                expandAllNodes()
            }, 0)
        }
    }, [forceUpdateKey, tree, allExpanded, expandAllNodes])

    useEffect(() => {
        if (!selectedIds.length) return
        tree.setSelectedItems(selectedIds.map(String))
    }, [selectedIds, forceUpdateKey, tree])

    const hasFolders = useMemo(() => {
        return currentNodes.some(node =>
            currentNodes.some(child => child.parent === node.id)
        )
    }, [currentNodes])

    return (
        <>
            <div className={cn("w-full h-full", className)}>
                {allNodesCount > 0 && hasFolders && (
                    <div className="flex items-center gap-2 px-2 py-1 mb-2 border-b border-border/50">
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
                )}

                {allNodesCount === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center py-12 text-center">
                        <FolderTree className="h-12 w-12 text-muted-foreground/50 mb-3" />
                        <p className="text-muted-foreground">
                            {t('admin-page.no-nodes-available')}
                        </p>
                    </div>
                ) : (
                    <ScrollArea className="h-full overflow-y-auto max-h-[calc(100vh-180px)]">
                        <div {...tree.getContainerProps()} className="space-y-0.5 h-full">
                            {tree.getItems().map((item: any) => {
                                const nodeId = item.getItemData()
                                const node = nodesMap.get(nodeId)
                                const level = item.getItemMeta().level

                                if (!node) return null

                                return (
                                    <ConstructorTreeNode
                                        key={`${item.getId()}-${forceUpdateKey}`}
                                        item={item}
                                        node={node}
                                        mode={mode}
                                        onToggle={handleToggle}
                                        onEdit={() => handleOpenEditDialog(node)}
                                        onDelete={level > 0 ? () => handleOpenDeleteDialog(node) : undefined}
                                        onCreate={() => handleOpenCreateDialog(node)}
                                    />
                                )
                            })}
                        </div>
                    </ScrollArea>
                )}
            </div>
            <TreeNodeFormDialog
                open={dialogState.open}
                onOpenChange={handleCloseDialog}
                mode={dialogState.mode}
                node={dialogState.node}
                parentNode={dialogState.parentNode}
                allNodes={currentNodes}
                onConfirm={dialogState.mode === 'create' ? handleConfirmCreate : handleConfirmEdit}
                isLoading={false}
            />

            <Dialog open={deleteDialogState.open} onOpenChange={handleCloseDeleteDialog}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>{t('admin-page.delete-node-title')}</DialogTitle>
                        <DialogDescription>
                            {deleteDialogState.node && (
                                <p>
                                    {t('admin-page.delete-node-warning')}
                                </p>
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={handleCloseDeleteDialog}>
                            {t('buttons.cancel')}
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleConfirmDelete}
                        >
                            {t('buttons.delete')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}

export default ConstructorTree