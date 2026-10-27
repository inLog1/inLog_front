import { Loader2 } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { useAddAdminPanelNodeMutation, useAddAdminPanelNodeTabMutation, useDeleteAdminPanelNodeMutation, useDeleteAdminPanelNodeTabMutation, useGetAdminPanelNodesQuery, useUpdateAdminPanelNodeMutation, useUpdateAdminPanelNodeTabMutation } from "../../../../entities/admin/model/adminSlice"
import type { AdminPanelNode, AdminPanelNodeRequest } from "../../../../entities/admin/model/types"
import ConstructorNodeDetails from "../../../../features/constructor/constructor-node-details/ui/ConstructorNodeDetails"
import { ConstructorTree } from "../../../../features/constructor/constructor-tree"
import { WorkspaceStatus } from "../../../../features/org-project-selector"
import { constructorResultMatchesScreen, selectConstructorNode } from "../model/select-constructor-node"
import { useConstructorAccess, useWorkspaceSection } from "../../../../features/org-project-selector/model/useWorkspaceSection"
import { errorsHandler } from "../../../../shared/lib/errors-handler"
import { useMatchMedia } from "../../../../shared/lib/use-match-media"
import { Button } from "../../../../shared/ui/button"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "../../../../shared/ui/resizable"

const AdminConstructorPage = () => {
    const { t } = useTranslation()
    const [searchParams, setSearchParams] = useSearchParams()
    const narrow = useMatchMedia('(max-width: 1023px)')
    const [treeOpen, setTreeOpen] = useState(false)
    const section = useWorkspaceSection('organization', { resource: 'constructor.schema', action: 'read' })
    const currentOrgId = section.kind === 'ready' ? section.organizationId : null
    const access = useConstructorAccess(currentOrgId)
    const canReadRecords = access.recordsRead
    const nodeParam = Number(searchParams.get('node')) || null

    const nodesQuery = useGetAdminPanelNodesQuery(
        { organizationId: currentOrgId ?? 0 },
        { skip: currentOrgId == null }
    )
    const adminPanelNodes = nodesQuery.currentData
    const nodesPending = adminPanelNodes == null && !nodesQuery.isError
    const nodesError = nodesQuery.isError
    const refetchNodes = nodesQuery.refetch

    const [addAdminPanelNodeMutation] = useAddAdminPanelNodeMutation()
    const [updateAdminPanelNodeMutation] = useUpdateAdminPanelNodeMutation()
    const [deleteAdminPanelNodeMutation] = useDeleteAdminPanelNodeMutation()
    const [addAdminPanelNodeTabMutation] = useAddAdminPanelNodeTabMutation()
    const [updateAdminPanelNodeTabMutation] = useUpdateAdminPanelNodeTabMutation()
    const [deleteAdminPanelNodeTabMutation] = useDeleteAdminPanelNodeTabMutation()

    const selectedNodeId = selectConstructorNode(adminPanelNodes, nodeParam)
    const screenRef = useRef({ organizationId: currentOrgId, nodeId: selectedNodeId })
    screenRef.current = { organizationId: currentOrgId, nodeId: selectedNodeId }

    useEffect(() => {
        if (currentOrgId == null || adminPanelNodes == null) return

        const params = new URLSearchParams(searchParams)
        const nextNode = selectedNodeId ? String(selectedNodeId) : null

        if (params.get('node') === nextNode) return

        if (nextNode) params.set('node', nextNode)
        else params.delete('node')

        setSearchParams(params, { replace: true })
    }, [adminPanelNodes, currentOrgId, searchParams, selectedNodeId, setSearchParams])

    const handleSelectEntity = useCallback((nodeId: number) => {
        const params = new URLSearchParams(searchParams)
        params.set('node', String(nodeId))
        setSearchParams(params, { replace: true })
        setTreeOpen(false)
    }, [searchParams, setSearchParams])

    const showResult = (started: { organizationId: number; nodeId?: number | null }, message: string) => {
        if (!constructorResultMatchesScreen(started, screenRef.current)) return
        toast.success(message)
    }

    const handleCreateEntity = async (body: AdminPanelNodeRequest) => {
        const organizationId = currentOrgId
        if (!organizationId) return

        let toastId: string | undefined
        try {
            toastId = toast.loading(t('notice-list.creating-node')) as string
            await addAdminPanelNodeMutation({ organizationId, body }).unwrap()
            showResult({ organizationId }, t('notice-list.node-created'))
        } catch (error) {
            errorsHandler(error, t)
        } finally {
            toast.dismiss(toastId)
        }
    }

    const handleEditEntity = async (node: AdminPanelNode, body: AdminPanelNodeRequest) => {
        const organizationId = currentOrgId
        if (!organizationId || node.organization !== organizationId) return
        if (!adminPanelNodes?.some((item) => item.id === node.id)) return

        let toastId: string | undefined
        try {
            toastId = toast.loading(t('notice-list.updating-node')) as string
            await updateAdminPanelNodeMutation({ organizationId, nodeId: node.id, body }).unwrap()
            showResult({ organizationId, nodeId: node.id }, t('notice-list.node-updated'))
        } catch (error) {
            errorsHandler(error, t)
        } finally {
            toast.dismiss(toastId)
        }
    }

    const handleDeleteEntity = async (node: AdminPanelNode) => {
        const organizationId = currentOrgId
        if (!organizationId || node.organization !== organizationId) return

        let toastId: string | undefined
        try {
            toastId = toast.loading(t('notice-list.deleting-node')) as string
            await deleteAdminPanelNodeMutation({ organizationId, nodeId: node.id }).unwrap()
            showResult({ organizationId }, t('notice-list.node-deleted'))
        } catch (error) {
            errorsHandler(error, t)
        } finally {
            toast.dismiss(toastId)
        }
    }

    const handleAddNodeTab = async (body: {
        name_en: string
        name_ru: string
        related_structure_elements?: number[]
    }) => {
        const organizationId = currentOrgId
        const nodeId = selectedNodeId
        if (!organizationId || nodeId == null) return

        let toastId: string | undefined
        try {
            toastId = toast.loading(t('notice-list.adding-node-tab')) as string
            await addAdminPanelNodeTabMutation({
                organizationId,
                body: {
                    name_en: body.name_en,
                    name_ru: body.name_ru,
                    group: nodeId,
                    related_structure_elements: body.related_structure_elements || [],
                }
            }).unwrap()
            showResult({ organizationId, nodeId }, t('notice-list.node-tab-added'))
        } catch (error) {
            errorsHandler(error, t)
        } finally {
            toast.dismiss(toastId)
        }
    }

    const handleUpdateNodeTab = async (tab: {
        id: number
        name_en: string
        name_ru: string
        related_structure_elements?: number[]
    }) => {
        const organizationId = currentOrgId
        const nodeId = selectedNodeId
        if (!organizationId || nodeId == null) return
        const node = adminPanelNodes?.find((item) => item.id === nodeId)
        if (!node || node.organization !== organizationId) return

        let toastId: string | undefined

        try {
            toastId = toast.loading(t('notice-list.updating-node-tab')) as string
            const validNodeTabs = (() => {
                const targetTab = node.pre_made_structure_elements?.find(element => element.id === tab.id)
                if(targetTab){
                    return node.pre_made_structure_elements?.map(element => element.id === tab.id ? tab : element)
                }else{
                    return [...(node.pre_made_structure_elements || []), tab]
                }
            })()
            await updateAdminPanelNodeTabMutation({
                organizationId, body: {
                    id: tab.id,
                    group: nodeId,
                    name_en: tab.name_en,
                    name_ru: tab.name_ru,
                    related_structure_elements: tab.related_structure_elements || [],
                    structure_elements: validNodeTabs as { id: number, name_en: string, name_ru: string }[],
                }
            }).unwrap()

            showResult({ organizationId, nodeId }, t('notice-list.node-tab-updated'))
        } catch (error) {
            errorsHandler(error, t)
        } finally {
            toast.dismiss(toastId)
        }
    }

    const handleDeleteNodeTab = async (tabId: number) => {
        const organizationId = currentOrgId
        const nodeId = selectedNodeId
        if (!organizationId || nodeId == null) return

        let toastId: string | undefined

        try {
            toastId = toast.loading(t('notice-list.deleting-node-tab')) as string
            await deleteAdminPanelNodeTabMutation({
                organizationId, tabId
            }).unwrap()
            showResult({ organizationId, nodeId }, t('notice-list.node-tab-deleted'))
        } catch (error) {
            errorsHandler(error, t)
        } finally {
            toast.dismiss(toastId)
        }
    }

    const handleUpdateNode = async (node: AdminPanelNode) => {
        const organizationId = currentOrgId
        if (!organizationId || node.organization !== organizationId) return
        if (!adminPanelNodes?.some((item) => item.id === node.id)) return

        let toastId: string | undefined
        try {
            toastId = toast.loading(t('notice-list.updating-node')) as string
            await updateAdminPanelNodeMutation({ organizationId, nodeId: node.id, body: node }).unwrap()
            showResult({ organizationId, nodeId: node.id }, t('notice-list.node-updated'))
        } catch (error) {
            errorsHandler(error, t)
        } finally {
            toast.dismiss(toastId)
        }
    }

    if (section.kind !== 'ready' || currentOrgId == null) {
        return (
            <WorkspaceStatus
                status={section.kind === 'ready' ? 'loading' : section.status}
                reason={section.kind === 'ready' ? null : section.reason}
                onRetry={section.refetch}
            />
        )
    }

    const tree = (
        <ConstructorTree
            nodes={adminPanelNodes || []}
            selectedIds={selectedNodeId ? [selectedNodeId] : []}
            onSelect={handleSelectEntity}
            onEdit={handleEditEntity}
            onDelete={handleDeleteEntity}
            onCreate={handleCreateEntity}
            canCreate={access.schemaCreate}
            canUpdate={access.schemaUpdate}
            canDelete={access.schemaDelete}
        />
    )

    const details = nodesPending ? (
        <div className="flex h-full items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin" />
        </div>
    ) : selectedNodeId ? (
        <ConstructorNodeDetails
            key={`${currentOrgId}-${selectedNodeId}`}
            nodeId={selectedNodeId}
            organizationId={currentOrgId}
            canReadRecords={canReadRecords}
            access={access}
            addTab={handleAddNodeTab}
            updateTab={handleUpdateNodeTab}
            deleteTab={handleDeleteNodeTab}
            updateNode={handleUpdateNode}
        />
    ) : !nodesError ? (
        <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted-foreground">{t('admin-page.no-entity-selected')}</p>
        </div>
    ) : null

    if (narrow) {
        return (
            <div className="flex h-full min-w-0 flex-col">
                <div className="flex items-center gap-2 border-b border-border px-3 py-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setTreeOpen(true)}>
                        {t('shell.show-structure')}
                    </Button>
                </div>
                <div className="min-h-0 min-w-0 flex-1 overflow-auto p-3">
                    {nodesPending ? (
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
                    ) : details}
                </div>
                {treeOpen && (
                    <div className="fixed inset-0 z-40">
                        <button type="button" className="absolute inset-0 bg-black/40" aria-label={t('shell.close-structure')} onClick={() => setTreeOpen(false)} />
                        <div className="absolute inset-y-0 left-0 flex w-[min(100%,20rem)] max-w-full flex-col overflow-hidden bg-background shadow-xl">
                            <div className="flex justify-end border-b border-border p-2">
                                <Button type="button" variant="ghost" size="sm" onClick={() => setTreeOpen(false)}>
                                    {t('shell.close-structure')}
                                </Button>
                            </div>
                            <div className="min-h-0 flex-1 overflow-auto p-3">
                                {tree}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        )
    }

    return (
        <ResizablePanelGroup
            key={currentOrgId}
            className="h-full min-w-0 max-w-full overflow-hidden rounded-lg border border-border"
            orientation="horizontal"
        >
            <ResizablePanel defaultSize={32} minSize={20} className="min-w-0 overflow-hidden">
                <div className="h-full w-full min-w-0 overflow-auto p-4">
                    {nodesPending ? (
                        <div className="flex items-center justify-center h-full w-full">
                            <Loader2 className="h-4 w-4 animate-spin" />
                        </div>
                    ) : nodesError ? (
                        <div className="flex h-full w-full flex-col items-center justify-center gap-3" role="alert">
                            <p className="text-sm text-muted-foreground">{t('workspace.section-error')}</p>
                            <button type="button" className="text-sm underline" onClick={() => void refetchNodes()}>
                                {t('workspace.retry')}
                            </button>
                        </div>
                    ) : (
                        <div className="h-full w-full min-w-0">
                            {tree}
                        </div>
                    )}
                </div>
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={68} minSize={40} className="min-w-0 overflow-hidden border-none rounded-none">
                <div className="h-full min-w-0 overflow-auto p-4">
                    {details}
                </div>
            </ResizablePanel>
        </ResizablePanelGroup>
    )
}

export default AdminConstructorPage