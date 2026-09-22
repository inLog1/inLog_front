'use client';

import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
    useAddAdminPanelGroupMutation,
    useAddAdminPanelRowMutation,
    useDeleteAdminPanelGroupMutation,
    useDeleteAdminPanelRowMutation,
    useUpdateAdminPanelGroupMutation,
    useUpdateAdminPanelRowMutation
} from "../../../../entities/admin/model/adminSlice";
import type { AdminPanelGroup, AdminPanelRowRequest } from "../../../../entities/admin/model/types";
import { errorsHandler } from "../../../../shared/lib/errors-handler";
import ConstructorTable from "../../constructor-table/ui/ConstructorTable";
import { useConstructorNodeContext } from "../model/ConstructorNodeContext";
import { useMemo } from "react";
import type { ColumnConfig } from "../../constructor-table/model/types";

interface DataItem {
    key: string
    [key: string]: any
}


interface Props {
    groups: AdminPanelGroup[]
    data: {
        entityId: number
        name_en: string
        name_ru: string
        organizationId: number
        type: 'group' | 'structure_element'
    }
    isShowTitle?: boolean
}

const ConstructorTableWrapper = ({ groups, data, isShowTitle = true }: Props) => {
    const { t } = useTranslation()

    const tableCoumns = useMemo(() => (groups || []).map((group: AdminPanelGroup) => ({
        key: group.id.toString(),
        title: {
            en: group.name_en,
            ru: group.name_ru,
        },
        inputType: group.type,
        dropdownOptions: group.dropdown_choices,
        width: 100,
    })), [groups])

    const [addAdminPanelGroupMutation] = useAddAdminPanelGroupMutation()
    const [updateAdminPanelRow] = useUpdateAdminPanelRowMutation()
    const [deleteAdminPanelGroupMutation] = useDeleteAdminPanelGroupMutation()
    const [updateAdminPanelGroupMutation] = useUpdateAdminPanelGroupMutation()
    const [addAdminPanelRow] = useAddAdminPanelRowMutation()
    const [deleteAdminPanelRow] = useDeleteAdminPanelRowMutation()


    const { nodeId, tableRowsData, refetchRows } = useConstructorNodeContext()


    const onEdit = async (column: ColumnConfig) => {
        let toastId: string | undefined
        try {
            toastId = toast.loading(t('notice-list.updating-group')) as string
            await updateAdminPanelGroupMutation({
                organizationId: data.organizationId,
                groupId: Number(column.key),
                body: {
                    name_en: column.title.en,
                    name_ru: column.title.ru,
                    [data.type]: data.entityId, type: column.inputType
                }
            }).unwrap()
            toast.success(t('notice-list.group-updated'))
        } catch (error) {
            errorsHandler(error, t)
        } finally {
            toast.dismiss(toastId)
        }
    }

    const onCreate = async (column: ColumnConfig) => {
        let toastId: string | undefined
        try {
            toastId = toast.loading(t('notice-list.creating-group')) as string
            await addAdminPanelGroupMutation({
                organizationId: data.organizationId,
                body: {
                    name_en: column.title.en,
                    name_ru: column.title.ru,
                    // structure_element: node.id, 
                    [data.type]: data.entityId,
                    type: column.inputType,
                    dropdown_choices: column.dropdownOptions
                }
            }).unwrap()
            toast.success(t('notice-list.group-created'))
        } catch (error) {
            errorsHandler(error, t)
            throw error
        } finally {
            toast.dismiss(toastId)
        }
    }
    const onDelete = async (columnKey: string) => {
        let toastId: string | undefined
        try {
            toastId = toast.loading(t('notice-list.deleting-group')) as string
            await deleteAdminPanelGroupMutation({
                organizationId: data.organizationId,
                groupId: Number(columnKey)
            }).unwrap()
            toast.success(t('notice-list.group-deleted'))
        } catch (error) {
            errorsHandler(error, t)
        } finally {
            toast.dismiss(toastId)
        }
    }

    const onSaveRow = async (row: AdminPanelRowRequest['data']) => {
        let toastId: string | undefined
        try {
            toastId = toast.loading(t('notice-list.saving-row')) as string
            await addAdminPanelRow({
                organizationId: data.organizationId,
                body: {
                    data: row,
                    group: nodeId ?? 0,
                    structure_element: data.type === 'structure_element' ? data.entityId : undefined
                }
            }).unwrap()
            await refetchRows()
            toast.success(t('notice-list.row-saved'))
        } catch (error) {
            errorsHandler(error, t)
            throw error
        } finally {
            toast.dismiss(toastId)
        }
    }

    const onEditRow = async (rowKey: string, body: AdminPanelRowRequest['data']) => {
        let toastId: string | undefined
        try {
            toastId = toast.loading(t('notice-list.editing-row')) as string
            await updateAdminPanelRow({
                organizationId: data.organizationId,
                rowId: Number(rowKey),
                body: {
                    data: body,
                    group: nodeId ?? 0,
                    structure_element: data.type === 'structure_element' ? data.entityId : undefined
                }
            })
            await refetchRows()
            toast.success(t('notice-list.row-edited'))
        } catch (error) {
            errorsHandler(error, t)
            throw error
        } finally {
            toast.dismiss(toastId)
        }
    }

    const onDeleteRow = async (rowId: string) => {
        let toastId: string | undefined
        try {
            toastId = toast.loading(t('notice-list.deleting-row')) as string
            await deleteAdminPanelRow({
                organizationId: data.organizationId,
                rowId: Number(rowId)
            }).unwrap()
            await refetchRows()
            toast.success(t('notice-list.row-deleted'))
        } catch (error) {
            errorsHandler(error, t)
            throw error
        } finally {
            toast.dismiss(toastId)
        }
    }

    const tableRows = useMemo(() => {
        if (!tableRowsData) return []

        const rowsById = new Map<string, DataItem>()

        Object.entries(tableRowsData).forEach(([fieldName, responseKeyValues]) => {
            const targetColumn = tableCoumns.find(
                (column) => column.title?.en === fieldName || column.title?.ru === fieldName
            )
            if (!targetColumn?.key || !Array.isArray(responseKeyValues)) return

            responseKeyValues.forEach((item) => {
                const rowKey = item?.id != null ? String(item.id) : ''
                if (!rowKey) return

                const existing = rowsById.get(rowKey) ?? { key: rowKey }
                existing[targetColumn.key] = item.value
                rowsById.set(rowKey, existing)
            })
        })

        return Array.from(rowsById.values())
    }, [tableRowsData, tableCoumns])

    return (
        <div >
            {isShowTitle && <h4 className="text-sm font-semibold mb-2">{t('admin-page.table')}</h4>}
            <ConstructorTable
                initialColumns={tableCoumns}
                initialRows={tableRows}
                onCreate={onCreate}
                onDelete={onDelete}
                onEdit={onEdit}
                onSaveRow={onSaveRow}
                onEditRow={onEditRow}
                onDeleteRow={onDeleteRow}
            />
        </div>
    )
}

export default ConstructorTableWrapper;