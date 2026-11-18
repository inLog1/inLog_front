import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { useGenerateReportMutation } from "../../../../entities/admin/model/adminSlice"
import type { AdminPanelGroup, AdminPanelNode, AdminPanelNodeTab, AdminPanelReportRequest, AdminPanelReportTable } from "../../../../entities/admin/model/types"
import { errorsHandler } from "../../../../shared/lib/errors-handler"
import { reportResponseIsCurrent } from "../model/report-request"
import ReportTable, { type ReportViewStatus } from "./ReportTable"

interface ReportDetailsProps {
    organizationId: number
    canGenerate: boolean
    selectedEntities: {
        nodes: AdminPanelNode[]
        tabs: AdminPanelNodeTab[]
        columns: AdminPanelGroup[]
    }
}

const ReportDetails = ({ selectedEntities, organizationId, canGenerate }: ReportDetailsProps) => {
    const { t } = useTranslation()
    const [generateReport] = useGenerateReportMutation()
    const [reportData, setReportData] = useState<AdminPanelReportTable>({})
    const [status, setStatus] = useState<ReportViewStatus>('idle')
    const requestSerial = useRef(0)
    const contextKey = `${organizationId}:${canGenerate ? 1 : 0}`
    const [seenContext, setSeenContext] = useState(contextKey)
    if (seenContext !== contextKey) {
        setSeenContext(contextKey)
        setReportData({})
        setStatus(canGenerate ? 'idle' : 'forbidden')
    }

    const getValidRequestBody = useCallback((): AdminPanelReportRequest[] => {
        const data: AdminPanelReportRequest[] = []
        const { nodes, tabs, columns } = selectedEntities

        nodes.forEach(node => {
            data.push({
                group: node.id,
                fields: []
            })
        })
        
        tabs.forEach(tab => {
            data.push({
                element: tab.id,
                fields: []
            })
        })

        if (columns.length > 0) {
            data.forEach((item, i) => {
                const filteredFields = columns.filter(field => 
                    field.group === item.group || field.structure_element === item.element
                )
                if (filteredFields.length > 0) {
                    data[i] = { 
                        ...item, 
                        fields: [...item.fields, ...filteredFields.map(field => field.id)] 
                    }
                }
            })
        }
        
        return data
    }, [selectedEntities])

    const generateReportData = useCallback(async () => {
        const serial = ++requestSerial.current
        const requestedOrganizationId = organizationId
        if (!canGenerate) {
            setReportData({})
            setStatus('forbidden')
            return
        }
        const requestBody = getValidRequestBody()
        if (requestBody.length === 0) {
            setReportData({})
            setStatus('idle')
            return
        }

        setReportData({})
        setStatus('loading')
        try {
            const response = await generateReport({
                organizationId: requestedOrganizationId,
                body: requestBody
            }).unwrap()
            if (!reportResponseIsCurrent(
                { organizationId: requestedOrganizationId, serial },
                { organizationId, serial: requestSerial.current },
            )) return
            const next = response ?? {}
            setReportData(next)
            setStatus(Object.keys(next).length === 0 ? 'empty' : 'ready')
        } catch (error) {
            if (!reportResponseIsCurrent(
                { organizationId: requestedOrganizationId, serial },
                { organizationId, serial: requestSerial.current },
            )) return
            const httpStatus = error && typeof error === 'object' && 'status' in error
                ? Number((error as { status?: unknown }).status)
                : 0
            setReportData({})
            setStatus(httpStatus === 403 ? 'forbidden' : 'error')
            errorsHandler(error, t)
        }
    }, [organizationId, canGenerate, generateReport, getValidRequestBody, t])

    useEffect(() => {
        const timer = window.setTimeout(() => {
            generateReportData()
        }, 0)
        return () => window.clearTimeout(timer)
    }, [generateReportData])

    return (
        <div className="h-full">
            <ReportTable 
                data={reportData}
                status={status}
                onRefresh={() => { void generateReportData() }}
            />
        </div>
    )
}

export default ReportDetails
