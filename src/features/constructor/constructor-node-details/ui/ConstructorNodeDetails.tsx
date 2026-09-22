import { useTranslation } from 'react-i18next'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../../../../shared/ui/accordion"

import { AlertCircle, RefreshCcw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useSearchParams } from 'react-router-dom'
import { makeSelectAdminPanelNodes } from '../../../../entities/admin'
import { adminApi, useGetAdminPanelGroupsQuery, useGetAdminPanelNodeByIdQuery } from '../../../../entities/admin/model/adminSlice'
import type { AdminPanelGroup, AdminPanelNode } from '../../../../entities/admin/model/types'
import { Button } from '../../../../shared/ui/button'
import ConstructorNodeProvider from '../model/ConstructorNodeContext'
import ConstructorNodeConnections from './ConstructorNodeConnections'
import ConstructorNodeDetailsSkeleton from './ConstructorNodeDetailsSkeleton'
import ConstructorTableWrapper from './ConstructorTableWrapper'
import ConstructorTabs from './ConstructorTabs'

export interface ColumnConfig {
    key: string
    title: {
        en: string
        ru: string
    }
    dataIndex: string
    inputType: AdminPanelGroup['type']
    width?: number
}

export interface DataItem {
    key: string
    [key: string]: any
}


interface Props {
    nodeId: number
    addTab: (body: {
        name_en: string
        name_ru: string
        related_structure_elements?: number[]
    }) => void
    updateTab: (tab: {
        id: number
        name_en: string
        name_ru: string
        related_structure_elements?: number[]
    }) => void
    deleteTab: (tabId: number) => void
    updateNode: (node: AdminPanelNode) => void


}

const ConstructorNodeDetails = (props: Props) => {
    const { nodeId, addTab, updateTab, deleteTab, updateNode } = props
    const { t, i18n } = useTranslation()
    const currentLang = i18n.language === 'ru' ? 'ru' : 'en'
    const [searchParams] = useSearchParams()
    const organizationId = Number(searchParams.get('org'))
    const dispatch = useDispatch()

    const nodes = useSelector(makeSelectAdminPanelNodes(organizationId!))

    const { data: currentNode, isLoading, isFetching, isError } = useGetAdminPanelNodeByIdQuery({ organizationId: organizationId!, nodeId }, { skip: !organizationId || !nodeId })

    const { data: groups, isLoading: isGroupsLoading, isFetching: isGroupsFetching } = useGetAdminPanelGroupsQuery({
        group: nodeId,
        organizationId: organizationId,
    }, {
        skip: !nodeId
    })

    const handleUpdateNodeConnections = (node: AdminPanelNode) => {
        updateNode(node)
    }

    const [readyNodeId, setReadyNodeId] = useState<number | null>(null)

    useEffect(() => {
        if (currentNode?.id === nodeId && !isFetching && !isGroupsFetching) {
            setReadyNodeId(nodeId)
        }
    }, [currentNode?.id, nodeId, isFetching, isGroupsFetching])

    const showSkeleton =
        readyNodeId !== nodeId ||
        isLoading ||
        isGroupsLoading ||
        !currentNode ||
        currentNode.id !== nodeId

    if (showSkeleton) {
        return <ConstructorNodeDetailsSkeleton />
    }
    if (isError) {
        return (
            <div className="h-full flex flex-col gap-4 items-center justify-center">
                <AlertCircle className="h-4 w-4" />
                {t('errors.error-loading-node')}
                <Button variant="outline" size="sm" onClick={() => {
                    dispatch(adminApi.util.invalidateTags(['Nodes', 'Node']))
                }}>
                    <RefreshCcw className="h-4 w-4" onClick={() => {
                        dispatch(adminApi.util.invalidateTags(['Nodes', 'Node']))
                    }} />
                    {t('buttons.refresh')}
                </Button>
            </div>
        )
    }

    return (
        <ConstructorNodeProvider nodeId={nodeId} groups={groups || []}>
        <div>
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">{currentNode?.[`name_${currentLang}`]}</h1>
                <Button variant="outline" size="sm" onClick={() => {
                    dispatch(adminApi.util.invalidateTags(['Nodes', 'Node']))
                }}>
                    <RefreshCcw className="h-4 w-4" />
                    {t('buttons.refresh')}
                </Button>
            </div>
            <Accordion
                type="multiple"
                className="mt-4"
                defaultValue={['table', 'tabs', 'relatives']}
            >
                <AccordionItem value="table">
                    <AccordionTrigger>{t('admin-page.table')}</AccordionTrigger>
                    <AccordionContent>
                        <ConstructorTableWrapper
                            groups={groups || []}
                            isShowTitle={false}
                            data={
                                {
                                    entityId: currentNode?.id || 0,
                                    name_en: currentNode?.name_en || '',
                                    name_ru: currentNode?.name_ru || '',
                                    organizationId: currentNode?.organization || 0,
                                    type: 'group'
                                }} />

                    </AccordionContent>
                </AccordionItem>
                <AccordionItem value="relatives">
                    <AccordionTrigger>{t('admin-page.relatives')}</AccordionTrigger>
                    <AccordionContent>
                        <ConstructorNodeConnections
                            node={currentNode!}
                            nodes={nodes}
                            onChange={handleUpdateNodeConnections}
                        />
                    </AccordionContent>
                </AccordionItem>
                <AccordionItem value="tabs">
                    <AccordionTrigger>{t('admin-page.tabs')}</AccordionTrigger>
                    <AccordionContent>
                        <ConstructorTabs
                            node={currentNode}
                            addTab={addTab}
                            updateTab={updateTab}
                            deleteTab={deleteTab}
                        />
                    </AccordionContent>
                </AccordionItem>

            </Accordion>
        </div>
        </ConstructorNodeProvider>
    )
}

export default ConstructorNodeDetails