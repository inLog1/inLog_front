import type { AdminPanelNode, AdminPanelNodeTab } from "../../../entities/admin/model/types"

export const getTopmostNodeId = (nodes: AdminPanelNode[]): number | null => {
    if (!nodes.length) return null

    const ids = new Set(nodes.map((node) => node.id))
    const roots = nodes.filter((node) => node.parent === null || !ids.has(node.parent))

    return roots[0]?.id ?? nodes[0].id
}

export const getSelectedEntities = (
    prevSelected: AdminPanelNode[],
    entity: AdminPanelNode
): AdminPanelNode[] => {
    const isSelected = prevSelected.some(item => item.id === entity.id)
    
    if (isSelected) {
        return prevSelected.filter(item => item.id !== entity.id)
    } else {
        return [...prevSelected, entity]
    }
}

export const findAllParentNodes = (
    nodes: AdminPanelNode[],
    parentId: number | null,
    result: AdminPanelNode[] = []
): AdminPanelNode[] => {
    if (!parentId) return result
    
    const parent = nodes.find(node => node.id === parentId)
    if (parent) {
        result.unshift(parent)
        return findAllParentNodes(nodes, parent.parent, result)
    }
    return result
}

export const findRelativeNodesInNodes = (
    nodes: AdminPanelNode[] = [],
    nodeId: number | null,
): Array<AdminPanelNode & { nestLevel: number }> => {
    const result: Array<AdminPanelNode & { nestLevel: number }> = []
    let targetNode = null as null | AdminPanelNode & { nestLevel: number }

    nodes.forEach((node: AdminPanelNode) => {
        const parentNodes = findAllParentNodes(nodes, node.id);
        const item: AdminPanelNode & { nestLevel: number } = { ...node, nestLevel: parentNodes ? parentNodes.length : 0 }

        if (item.id === nodeId) {
            targetNode = item
        }

        result.push(item)
        //возвращает массив дочерних узлов
    })

    if (targetNode && targetNode.nestLevel && result.length > 0) {
        return result.filter(item => item.nestLevel && item.nestLevel <= targetNode?.nestLevel!)
    } else return []

   //эта функция возвращает массив узлов, которые находятся на одном уровне или ниже, чем узел с id nodeId
}

export const getConnectionTabsOptions = (
    nodes: Array<AdminPanelNode> = [],
    nodeId: number,
    // tabId: number,
    language: 'en' | 'ru',
):Array<{
    label: string
    value: string
    fixed: boolean
}> => {
    const relativeNodes = findRelativeNodesInNodes(nodes, nodeId)
    const options:Array<{
        label: string
        value: string 
        fixed: boolean
    }> = []

    if (relativeNodes && relativeNodes.length > 0) {
        relativeNodes.forEach((node: AdminPanelNode & { nestLevel: number }) => {
            if (
                node.pre_made_structure_elements &&
                node.pre_made_structure_elements.length > 0
            ) {
                node.pre_made_structure_elements.forEach((tab) => {
                    options.push({
                        label: `${node[`name_${language}`]} — ${
                            tab[`name_${language}`]
                        }`,
                        value: tab.id!.toString(),
                        // fixed: item.id === nodeId,
                        fixed: false,
                    })
                })
            }
        })
       return options
    } else return []
}

export const findAllRelativeTabs = (
    nodes: AdminPanelNode[],
    tab: AdminPanelNodeTab,
) => {
    const result: AdminPanelNodeTab[] = []
    if(tab.related_structure_elements && tab.related_structure_elements.length > 0) {
        nodes.forEach((node) => {
            if(node.pre_made_structure_elements && node.pre_made_structure_elements.length > 0) {
                node.pre_made_structure_elements.forEach((tabElement) => {
                    if(tab.related_structure_elements && tab.related_structure_elements.includes(tabElement.id!)) {
                        result.push(tabElement)
                    }
                })
            }
        })
    }

    return result
}
