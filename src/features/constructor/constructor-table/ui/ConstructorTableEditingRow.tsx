import { TableRow, TableCell } from "../../../../shared/ui/table"
import { Button } from "../../../../shared/ui/button"
import { cn } from "../../../../shared/lib/utils"
import { Save, X, Edit, Trash2 } from "lucide-react"
import type { DataItem } from "./ConstructorTable"
import type { ColumnConfig } from "../model/types"

interface ConstructorTableEditingRowProps {
    editing?: boolean
    record: DataItem
    columns: ColumnConfig[]
    saveEdit: (key: string) => void
    cancelEdit: () => void
    startEdit: (record: DataItem) => void
    deleteRow: (key: string) => void
    renderEditCell: (column: ColumnConfig, record: DataItem) => React.ReactNode
    renderViewCell: (column: ColumnConfig, record: DataItem) => React.ReactNode
    disabled: boolean
    canUpdate?: boolean
    canDelete?: boolean
}

const ConstructorTableEditingRow = (props: ConstructorTableEditingRowProps) => {
    const { 
        editing, 
        record, 
        columns, 
        disabled,
        saveEdit, 
        cancelEdit, 
        startEdit, 
        deleteRow, 
        renderEditCell, 
        renderViewCell,
        canUpdate = true,
        canDelete = true,
    } = props
    return (
        <TableRow
            key={record.key}
            className={cn(
                "hover:bg-muted/30 transition-colors",
                editing && "bg-muted/20"
            )}
        >
            {columns.map((column) => (
                <TableCell
                    key={column.key}
                    style={{ minWidth: column.width || 150 }}
                    className="py-2"
                >
                    {editing
                        ? renderEditCell(column, record)
                        : renderViewCell(column, record)}
                </TableCell>
            ))}
            <TableCell className="py-2">
                <div className="flex items-center gap-1">
                    {editing ? (
                        <>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => saveEdit(record.key)}
                                className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50"
                            >
                                <Save className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={cancelEdit}
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            >
                                <X className="h-3.5 w-3.5" />
                            </Button>
                        </>
                    ) : (
                        <>
                            {canUpdate && (
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => startEdit(record)}
                                className="h-7 w-7"
                                disabled={disabled}
                            >
                                <Edit className="h-3.5 w-3.5" />
                            </Button>
                            )}
                            {canDelete && (
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteRow(record.key)}
                                className="h-7 w-7 text-destructive"
                                disabled={disabled}
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                            )}
                        </>
                    )}
                </div>
            </TableCell>
        </TableRow>
    )
}

export default ConstructorTableEditingRow