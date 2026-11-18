// TreeNodeFormDialog.tsx
import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { AdminPanelNode } from '../../../../entities/admin/model/types'
import { Button } from '../../../../shared/ui/button'
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '../../../../shared/ui/dialog'
import { Input } from '../../../../shared/ui/input'
import { Label } from '../../../../shared/ui/label'
import { MultiSelect } from '../../../../shared/ui/multiple-select'
import { findAllParentNodes } from '../utils'

interface NodeFormData {
    name_ru: string
    name_en: string
}

interface MultiSelectOption {
    label: string
    value: string
    fixed?: boolean
}

interface Props {
    open: boolean
    onOpenChange: (open: boolean) => void
    mode: 'create' | 'edit'
    node?: AdminPanelNode
    parentNode?: AdminPanelNode
    allNodes: AdminPanelNode[]
    onConfirm: (data: {
        name_ru: string
        name_en: string
        related_groups: string[]
    }) => void
    isLoading?: boolean
}

const TreeNodeFormDialog = ({
    open,
    onOpenChange,
    mode,
    node,
    parentNode,
    allNodes,
    onConfirm,
    isLoading = false,
}: Props) => {
    const { t, i18n } = useTranslation()
    const currentLang = i18n.language === 'ru' ? 'ru' : 'en'

    const [formData, setFormData] = useState<NodeFormData>({
        name_ru: '',
        name_en: '',
    })

    const [connectionValueList, setConnectionValueList] = useState<string[]>([])

    const connectionsOptions = useMemo(() => {
        if (!open) return []
        const result: MultiSelectOption[] = []
        const targetNode = node || parentNode

        if (
            targetNode?.related_groups &&
            targetNode.related_groups.length > 0 &&
            allNodes &&
            allNodes.length > 0
        ) {
            allNodes.forEach((item) => {
                if (targetNode?.related_groups.includes(item.id)) {
                    if (!result.some(el => el.value === item.id.toString())) {
                        result.push({
                            label: item[`name_${currentLang}`],
                            value: item.id.toString(),
                            fixed: mode === 'edit' ? item.id === targetNode?.parent : false,
                        })
                    }
                }
            })
        }

        const parentNodes = findAllParentNodes(allNodes, targetNode?.parent || null);

        if (parentNodes && parentNodes.length > 0) {
            const targetNestedEntities = parentNodes.filter(
                (item) => item.parent !== targetNode?.id,
            )
            targetNestedEntities.forEach((item) => {
                if (!result.some(el => el.value === item.id.toString())) {
                    result.push({
                        label: item[`name_${currentLang}`],
                        value: item.id.toString(),
                        fixed: item.id === targetNode?.parent,
                    })
                }
            })
        }

        if (mode === 'create' && parentNode) {
            result.push({
                label: parentNode[`name_${currentLang}`],
                value: parentNode.id.toString(),
                fixed: true,
            })
        }

        return result
    }, [allNodes, currentLang, open, node, parentNode, mode])

    useEffect(() => {
        if (!open) return

        if (mode === 'edit' && node) {
            setFormData({
                name_ru: node.name_ru,
                name_en: node.name_en,
            })

            const targetNode = node || parentNode

            const initialGroups: Set<string> = new Set()
            if (targetNode.parent) {
                if (parentNode) {
                    initialGroups.add(targetNode.parent.toString())
                }
            }
            if (targetNode.related_groups?.length) {
                targetNode.related_groups.forEach(nodeId => {
                    if (!initialGroups.has(nodeId.toString())) {
                        initialGroups.add(nodeId.toString())
                    }
                })
            }
            setConnectionValueList(Array.from(initialGroups))

        } else if (mode === 'create') {
            setFormData({
                name_ru: '',
                name_en: '',
            })
            if (parentNode) {
                setConnectionValueList([parentNode.id.toString()])
            }

        }
    }, [open, mode, node, parentNode, currentLang, i18n.language])

    const handleConfirm = useCallback(() => {
        if (!formData.name_ru.trim() && !formData.name_en.trim()) {
            return
        }
        onConfirm({
            name_ru: formData.name_ru,
            name_en: formData.name_en,
            related_groups: connectionValueList,
        })
    }, [formData, connectionValueList, mode, onConfirm])

    const handleChangeConnections = useCallback((value: string[]) => {
        setConnectionValueList(value)
    }, [])



    const title = mode === 'create'
        ? t('admin-page.create-node')
        : t('admin-page.edit-node')

    const confirmButtonText = mode === 'create'
        ? t('buttons.create')
        : t('buttons.save')

    if (!open) return null

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="name_ru">
                            {t('fields.name-in-russian')}
                            <span className="text-destructive ml-1">*</span>
                        </Label>
                        <Input
                            id="name_ru"
                            value={formData.name_ru}
                            onChange={(e) => setFormData({ ...formData, name_ru: e.target.value })}
                            placeholder={t('fields.enter-name-in-russian')}
                            disabled={isLoading}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="name_en">
                            {t('fields.name-in-english')}
                            <span className="text-destructive ml-1">*</span>
                        </Label>
                        <Input
                            id="name_en"
                            value={formData.name_en}
                            onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                            placeholder={t('fields.enter-name-in-english')}
                            disabled={isLoading}
                        />
                    </div>
                </div>

                {connectionsOptions.length > 0 && (
                    <div className="space-y-2">
                        <Label>
                            {t('fields.connection-with')}
                        </Label>
                        <MultiSelect
                            options={connectionsOptions}
                            value={connectionValueList}
                            onValueChange={handleChangeConnections}
                        />
                    </div>
                )}

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isLoading}
                    >
                        {t('buttons.cancel')}
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={isLoading || (!formData.name_ru.trim() && !formData.name_en.trim())}
                    >
                        {isLoading ? t('buttons.saving') : confirmButtonText}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

export default memo(TreeNodeFormDialog)