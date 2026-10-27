import { useTranslation } from "react-i18next"
import { useMemo, useState } from "react"
import { Button } from "../../../../shared/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "../../../../shared/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../../shared/ui/table"
import { Skeleton } from "../../../../shared/ui/skeleton"
import { RefreshCw, FileText } from "lucide-react"
import type { AdminPanelReportTable } from "../../../../entities/admin/model/types"
import { formatDate } from "date-fns"
import { DATE_VIEW_FORMAT } from "../../../../shared/config/constants"

export type ReportViewStatus = 'idle' | 'loading' | 'empty' | 'ready' | 'error' | 'forbidden'

interface ReportTableProps {
    data: AdminPanelReportTable
    isLoading?: boolean
    status?: ReportViewStatus
    onRefresh?: () => void
}

const ReportTable = ({ data, isLoading = false, status, onRefresh }: ReportTableProps) => {
    const { t } = useTranslation()
    const [refreshing, setRefreshing] = useState(false)

    const handleRefresh = async () => {
        if (!onRefresh) return
        
        setRefreshing(true)
        try {
            await onRefresh()
        } finally {
            setRefreshing(false)
        }
    }

    const tableData = useMemo((): Array<Record<string, string | number | React.ReactNode>> => {
        if (!data || Object.keys(data).length === 0) return []

        const allIds = new Set<number>()
        Object.values(data).forEach(fieldArray => {
            fieldArray.forEach(item => {
                allIds.add(item.id)
            })
        })
        
        const uniqueIds = Array.from(allIds)
        
        return uniqueIds.map((id, index) => {
            const rowData: Record<string, string | number | React.ReactNode> = { 
                id,
                counter: index + 1
            }
            
            Object.entries(data).forEach(([fieldName, fieldArray]) => {
                const fieldItem = fieldArray.find(item => item.id === id)
                if (fieldItem?.type === 'file') {
                    rowData[fieldName] = (
                        <a 
                            href={fieldItem.value} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                            <FileText className="h-4 w-4" />
                            <span>Файл</span>
                        </a>
                    )
                } else if(fieldItem?.type === 'date') {
                    rowData[fieldName] = formatDate(fieldItem?.value, DATE_VIEW_FORMAT)
                }
                
                else {
                    rowData[fieldName] = fieldItem?.value ?? '-'
                }
            })
            
            return rowData
        })
    }, [data])

    const columns = useMemo(() => {
        if (!data || Object.keys(data).length === 0) return []
        
        const baseColumns = [
            {
                key: 'counter',
                label: '#',
                width: 'w-16',
                type: 'integer'
            },
            {
                key: 'id',
                label: 'ID',
                width: 'w-20',
                type: 'integer'
            }
        ]
        
        const fieldColumns = Object.keys(data).map(fieldName => ({
            key: fieldName,
            label: fieldName,
            width: 'min-w-[150px]'
        }))
        
        return [...baseColumns, ...fieldColumns]
    }, [data])

    const totalRecords = tableData.length
    const hasData = data && Object.keys(data).length > 0
    const view: ReportViewStatus = status ?? (isLoading ? 'loading' : hasData ? 'ready' : 'empty')

    if (view === 'loading') {
        return (
            <Card className="border border-border rounded-lg">
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-base font-medium">
                        {t('admin-page.reports')}
                    </CardTitle>
                    {onRefresh && (
                        <Button 
                            variant="outline" 
                            size="sm"
                            onClick={handleRefresh}
                            disabled={true}
                        >
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            {t('buttons.refresh')}
                        </Button>
                    )}
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <Skeleton key={i} className="h-12 w-full" />
                        ))}
                    </div>
                </CardContent>
            </Card>
        )
    }

    if (view === 'idle' || view === 'empty' || view === 'error' || view === 'forbidden') {
        const message = view === 'idle'
            ? t('admin-page.report-idle')
            : view === 'error'
                ? t('admin-page.report-error')
                : view === 'forbidden'
                    ? t('admin-page.report-forbidden')
                    : t('admin-page.report-empty')
        return (
            <Card className="border border-border rounded-lg">
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-base font-medium">
                        {t('admin-page.reports')}
                    </CardTitle>
                    {onRefresh && (
                        <Button 
                            variant="outline" 
                            size="sm"
                            onClick={handleRefresh}
                            disabled={refreshing}
                        >
                            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                            {t('buttons.refresh')}
                        </Button>
                    )}
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <FileText className="h-12 w-12 text-muted-foreground/50 mb-3" />
                        <p className="text-muted-foreground">
                            {message}
                        </p>
                    </div>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="border border-border rounded-lg">
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="text-base font-medium">
                        {t('admin-page.reports')}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                        {t('admin-page.total-records')}: {totalRecords}
                    </p>
                </div>
                {onRefresh && (
                    <Button 
                        variant="outline" 
                        size="sm"
                        onClick={handleRefresh}
                        disabled={refreshing}
                    >
                        <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                        {t('buttons.refresh')}
                    </Button>
                )}
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                {columns.map((column) => (
                                    <TableHead 
                                        key={column.key} 
                                        className={column.width}
                                    >
                                        {column.label}
                                        {tableData[0]['']}
                                    </TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {tableData.map((row: any) => (
                                <TableRow key={row.id}>
                                    {columns.map((column) => (
                                        <TableCell key={`${row.id}-${column.key}`}>
                                            {row[column.key]}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>

                {totalRecords > 1000 && (
                    <div className="flex items-center justify-between mt-4">
                        <div className="text-sm text-muted-foreground">
                            {t('admin-page.showing')} {Math.min(10, totalRecords)} {t('admin-page.of')} {totalRecords} {t('admin-page.records')}
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled
                            >
                                {t('buttons.previous')}
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled
                            >
                                {t('buttons.next')}
                            </Button>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}

export default ReportTable