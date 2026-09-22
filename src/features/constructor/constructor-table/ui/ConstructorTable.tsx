import { format } from 'date-fns'
import { enUS, ru } from 'date-fns/locale'
import {
  AlertCircle,
  Calendar,
  Edit,
  File,
  FileSpreadsheet,
  Hash,
  List,
  MoreHorizontal,
  Plus,
  Trash2,
  Type,
  Upload,
  X as XIcon
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { AdminPanelGroup, AdminPanelRowRequest } from '../../../../entities/admin/model/types'
import { DATE_VIEW_FORMAT } from '../../../../shared/config/constants'
import { errorsHandler } from '../../../../shared/lib/errors-handler'
import { cn, formatFileName } from '../../../../shared/lib/utils'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../../shared/ui/alert-dialog'
import { Button } from '../../../../shared/ui/button'
import { DatePicker } from '../../../../shared/ui/date-picker'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../../shared/ui/dropdown-menu'
import { Input } from '../../../../shared/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '../../../../shared/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../shared/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../../shared/ui/table'
import { createUniqueRowKey, uniqueRowsByKey } from '../model/unique-rows'
import type { ColumnConfig } from '../model/types'
import ConstructorTableEditingRow from './ConstructorTableEditingRow'
import ConstructorTableFormDialog from './ConstructorTableFormDialog'

export interface ColumnFormData {
  titleEn: string
  titleRu: string
  inputType: AdminPanelGroup['type']
  dropdownOptions?: string[]
}

export interface FileData {
  id: string
  name: string
  size: number
  type: string
  url?: string
  file?: File
}

export interface DataItem {
  key: string
  [key: string]: any
}

interface Props {
  initialColumns?: ColumnConfig[]
  initialRows?: any[]
  onCreate?: (column: ColumnConfig) => Promise<void>
  onDelete?: (columnKey: string) => void
  onEdit?: (column: ColumnConfig) => void
  onDataChange?: (data: DataItem[]) => void
  onSaveRow?: (row: AdminPanelRowRequest['data']) => Promise<void>
  onEditRow?: (rowKey: string, body: AdminPanelRowRequest['data']) => Promise<void>
  onDeleteRow?: (rowId: string) => Promise<void>
}

const ConstructorTable = (props: Props) => {
  const { 
    initialColumns, 
    initialRows, 
    onCreate, 
    onDelete, 
    onEdit, 
    onDataChange, 
    onSaveRow,
    onEditRow,
    onDeleteRow
  } = props
  const { t, i18n } = useTranslation()
  const currentLang = i18n.language === 'ru' ? 'ru' : 'en'


  const dateLocale = currentLang === 'ru' ? ru : enUS

  const [columns, setColumns] = useState<ColumnConfig[]>(initialColumns || [])
  const [rows, setRows] = useState<DataItem[]>([])
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<Record<string, any>>({})
  const [editErrors, setEditErrors] = useState<Record<string, string>>({})
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const [isColumnDialogOpen, setIsColumnDialogOpen] = useState(false)
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false)
  const [selectedColumn, setSelectedColumn] = useState<ColumnConfig | null>(null)
  const [isEditingColumn, setIsEditingColumn] = useState(false)

  const getDefaultValueForColumn = useCallback((inputType: AdminPanelGroup['type']): any => {
    switch (inputType) {
      case 'integer':
        return 0
      case 'date':
      case 'file':
      case 'dropdown':
        return null
      default:
        return ''
    }
  }, [])

  useEffect(() => {
    if (!initialColumns) return

    const oldColumnsMap = new Map(columns.map(col => [col.key, col]))
    const newColumnsMap = new Map(initialColumns.map(col => [col.key, col]))

    const columnsChanged =
      initialColumns.length !== columns.length ||
      initialColumns.some(col => !oldColumnsMap.has(col.key)) ||
      columns.some(col => !newColumnsMap.has(col.key))

    if (!columnsChanged) return

    setColumns(initialColumns)

    if (rows.length > 0) {
      const updatedData = rows.map(row => {
        const newRow = { ...row }

        initialColumns.forEach(newCol => {
          if (!oldColumnsMap.has(newCol.key)) {
            newRow[newCol.key] = getDefaultValueForColumn(newCol.inputType)
          }
        })

        Object.keys(newRow).forEach(key => {
          if (key !== 'key' && !newColumnsMap.has(key)) {
            delete newRow[key]
          }
        })

        return newRow
      })
      setRows(uniqueRowsByKey(updatedData))
    }
  }, [initialColumns, columns, rows, getDefaultValueForColumn])

  useEffect(() => {
    if (!initialRows) return

    setRows((prev) => {
      const incoming = uniqueRowsByKey(initialRows)
      const incomingKeys = new Set(incoming.map((row) => row.key))
      const localDrafts = prev.filter(
        (row) => Boolean(editingKey) && row.key === editingKey && !incomingKeys.has(row.key)
      )

      return uniqueRowsByKey([...incoming, ...localDrafts])
    })
  }, [initialRows, editingKey])

  useEffect(() => {
    if (onDataChange) {
      onDataChange(rows)
    }
  }, [rows, onDataChange])

  const formatDate = (date: Date | string | null) => {
    if (!date) return ''
    const dateObj = typeof date === 'string' ? new Date(date) : date
    return format(dateObj, DATE_VIEW_FORMAT, { locale: dateLocale })
  }

  const getTypeIcon = (type: AdminPanelGroup['type'], className = "h-4 w-4") => {
    switch (type) {
      case 'integer':
        return <Hash className={className} />
      case 'date':
        return <Calendar className={className} />
      case 'file':
        return <File className={className} />
      case 'dropdown':
        return <List className={className} />
      default:
        return <Type className={className} />
    }
  }

  const deleteRow = async(key: string) => {
    let targetId = rows.find((item) => item.key === key)?.key

    if (targetId) {
    await onDeleteRow?.(targetId).then(() => {
      if (editingKey === key) {
          cancelEdit()
        }
      })
    }
  }

  const deleteColumn = (columnKey: string) => {
    const updatedColumns = columns.filter((col) => col.key !== columnKey)
    setColumns(updatedColumns)

    const updatedData = rows.map(row => {
      const newRow = { ...row }
      delete newRow[columnKey]
      return newRow
    })
    setRows(uniqueRowsByKey(updatedData))
    onDelete?.(columnKey)
  }

  const openDeleteColumnAlert = (column: ColumnConfig) => {
    setSelectedColumn(column)
    setIsDeleteAlertOpen(true)
  }

  const confirmDeleteColumn = () => {
    if (selectedColumn) {
      deleteColumn(selectedColumn.key)
      setIsDeleteAlertOpen(false)
      setSelectedColumn(null)
    }
  }

  const openAddColumnDialog = () => {
    setIsEditingColumn(false)
    setSelectedColumn(null)
    setIsColumnDialogOpen(true)
  }

  const openEditColumnDialog = (column: ColumnConfig) => {
    setIsEditingColumn(true)
    setSelectedColumn(column)
    setIsColumnDialogOpen(true)
  }

  const validateEditValue = (column: ColumnConfig, value: any): string => {
    if (value === '') {
      return t('validation.required')
    }

    if (column.inputType === 'integer') {
      if (value !== '' && isNaN(Number(value))) {
        return t('validation.invalid-number')
      }
    }
    return ''
  }

  const validateRow = () => {
    const newErrors: Record<string, string> = {}
    const rowKeys = Object.keys(editValues)
    rowKeys.forEach((columnKey) => {
      const column = columns.find(col => col.key === columnKey)
      if (column) {
        const error = validateEditValue(column, editValues[columnKey])
        if (error) {
          newErrors[columnKey] = error
        }
      }
    })
    return newErrors
  }

  const handleColumnSubmit = async (formData: ColumnFormData) => {
    if (isEditingColumn && selectedColumn) {
      const updatedColumn: ColumnConfig = {
        ...selectedColumn,
        title: {
          en: formData.titleEn,
          ru: formData.titleRu,
        },
        inputType: formData.inputType,
        dropdownOptions: formData.dropdownOptions,
      }

      const updatedColumns = columns.map(col =>
        col.key === selectedColumn.key ? updatedColumn : col
      )
      setColumns(updatedColumns)

      onEdit?.(updatedColumn)
      try {
        await onEdit?.(updatedColumn)
      } catch {
        setColumns(columns)
        setRows(rows)
      }
    } else {
      const newColumn: ColumnConfig = {
        key: Date.now().toString(),
        title: {
          en: formData.titleEn,
          ru: formData.titleRu,
        },
        inputType: formData.inputType,
        width: 150,
        dropdownOptions: formData.dropdownOptions,
      }

      const updatedColumns = [...columns, newColumn]
      setColumns(updatedColumns)

      if (rows.length > 0) {
        const updatedData = rows.map(row => ({
          ...row,
          [newColumn.key]: getDefaultValueForColumn(newColumn.inputType)
        }))
        setRows(uniqueRowsByKey(updatedData))
      }

      try {
        await onCreate?.(newColumn)
      } catch {
        setColumns(columns)
        setRows(rows)
      }
    }
  }

  const cancelEdit = () => {
    const newErrors = validateRow()
    const hasErrors = Object.keys(newErrors).length > 0
    if (hasErrors) {
      setRows(rows.slice(0, -1))
    }
    setEditingKey(null)
    setEditValues({})
    setEditErrors({})
  }

  const startEdit = (record: DataItem) => {
    const values: Record<string, any> = {}
    columns.forEach((col) => {
      const value = record[col.key]
      if (col.inputType === 'file' && value) {
        values[col.key] = { ...value }
      } else {
        values[col.key] = value !== undefined && value !== null ? value : ''
      }
    })
    setEditValues(values)
    setEditErrors({})
    setEditingKey(record.key)
  }

  const saveEdit = async () => {
    const newErrors = validateRow()
    let hasErrors = false
    if (Object.keys(newErrors).length > 0) {
      hasErrors = true
    }

    if (hasErrors) {
      setEditErrors(newErrors)
      return
    }

    try {
      const fieldsKeys = Object.keys(editValues).filter((key) => key !== 'key')
      const body: AdminPanelRowRequest['data'] = {
      }

      for (const key of fieldsKeys) {
        const field = editValues[key]
        const targetColumn = columns.find(val => val.key === key)
        const fieldType = targetColumn?.inputType || 'string'

        if (field) {
          body[`${targetColumn?.title.en || ''}`] = {
            type: fieldType === 'dropdown' ? 'string' : fieldType,
            value: fieldType ==='integer' ? Number(field) : field || ''
          }
        }
      }
      const targetRowKey = initialRows?.find((item) => item.key === editingKey)?.key
      if(targetRowKey) {
       await onEditRow?.(targetRowKey, body)
      }else{
        await onSaveRow?.(body)
      }

      setEditingKey(null)
      setEditValues({})
      setEditErrors({})
    } catch (error) {
      errorsHandler(error, t)
      setRows(rows.slice(0, -1))
    }
  }

  const updateEditValue = (columnKey: string, value: any) => {
    setEditValues((prev) => ({ ...prev, [columnKey]: value }))
    if (editErrors[columnKey]) {
      setEditErrors((prev) => ({ ...prev, [columnKey]: '' }))
    }
  }

  const handleFileUpload = (columnKey: string, file: File) => {
    const fileData: FileData = {
      id: Date.now().toString(),
      name: file.name,
      size: file.size,
      type: file.type,
      file: file,
      url: URL.createObjectURL(file)
    }
    updateEditValue(columnKey, fileData)
  }

  const removeFile = (columnKey: string) => {
    updateEditValue(columnKey, null)
  }

  const addRow = () => {
    if (editingKey) return

    const newKey = createUniqueRowKey(rows)
    const newRow: DataItem = { key: newKey }

    columns.forEach((col) => {
      newRow[col.key] = getDefaultValueForColumn(col.inputType)
    })

    setRows((prev) => {
      if (prev.some((row) => row.key === newKey)) {
        return prev
      }
      return uniqueRowsByKey([...prev, newRow])
    })
    startEdit(newRow)
  }

  const renderEditCell = (column: ColumnConfig, record: DataItem) => {
    const value = editValues[column.key] !== undefined
      ? editValues[column.key]
      : record[column.key]
    const error = editErrors[column.key]

    switch (column.inputType) {
      case 'integer':
        return (
          <div className="space-y-1 min-w-[150px]">
            <Input
              type="number"
              value={value || ''}
              onChange={(e) => updateEditValue(column.key, e.target.value)}
              placeholder={t('fields.enter-number')}
              className={cn("h-8", error && "border-destructive")}
            />
            {error && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {error}
              </p>
            )}
          </div>
        )
      case 'date':
        return (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "h-8 w-full justify-start text-left font-normal",
                  error && "border-destructive"
                )}
              >
                {value ? formatDate(value) : <span>{t('fields.select-date')}</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <DatePicker
                value={value ? new Date(value) : undefined}
                onChange={(date) => updateEditValue(column.key, date)}
              />
            </PopoverContent>
          </Popover>
        )
      case 'file':
        return (
          <div className="flex flex-col gap-2 min-w-[150px]">
            {value ? (
              <div className="h-8 flex items-center justify-between gap-2 p-2 border border-border rounded-md">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-sm truncate">{value.name}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeFile(column.key)}
                  className="h-6 w-6 flex-shrink-0"
                >
                  <XIcon className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-2 min-w-[150px]">
                <input
                  type="file"
                  ref={(el) => {
                    if (el) fileInputRefs.current[column.key] = el
                  }}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      handleFileUpload(column.key, file)
                    }
                  }}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRefs.current[column.key]?.click()}
                  className="h-8"
                >
                  <Upload className="h-3 w-3 mr-1" />
                  {t('buttons.upload-file')}
                </Button>
              </div>
            )}
          </div>
        )
      case 'dropdown':
        const options: { label: string, value: string }[] = (column.dropdownOptions || []).map((option) => ({ label: option, value: option }))
        return (
          <div className="space-y-1 min-w-[150px]">
            <Select
              value={value || ''}
              onValueChange={(value: string) => updateEditValue(column.key, value)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('fields.select-option')} />
              </SelectTrigger>
              <SelectContent>
                {options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {error && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {error}
              </p>
            )}
          </div>
        )
      default:
        return (
          <div className="space-y-1 min-w-[150px]">
            <Input
              value={value || ''}
              onChange={(e) => updateEditValue(column.key, e.target.value)}
              className={cn("h-8", error && "border-destructive")}
              placeholder={t('fields.enter-text')}
            />
            {error && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {error}
              </p>
            )}
          </div>
        )
    }
  }

  const renderViewCell = (column: ColumnConfig, record: DataItem) => {
    const value = record[column.key]

    if (!value && value !== 0) {
      return <span className="text-muted-foreground/50">—</span>
    }

    switch (column.inputType) {
      case 'date':
        return <span className="text-sm truncate min-w-[150px]">{formatDate(value)}</span>
      case 'integer':
        return <span className="text-sm truncate min-w-[150px]">{value}</span>
      case 'dropdown':
        return <span className="text-sm truncate min-w-[150px]">
          {value}
        </span>
      case 'file':
        return (
          <div className="flex items-center gap-2 min-w-[150px]">
            {value.url ? (
              <a
                href={value.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline truncate min-w-[150px]"
                onClick={(e) => e.stopPropagation()}
                title={value.name}
              >
                {formatFileName(value.name)}
              </a>
            ) : (
              <span className="text-sm truncate min-w-[150px]" title={value.name}>
                {formatFileName(value.name)}
              </span>
            )}
          </div>
        )
      default:
        return (
          <div className="whitespace-pre-wrap break-words min-w-[150px]">
            {value}
          </div>
        )
    }
  }

  const isEditing = (key: string) => editingKey === key

  return (
    <div className="w-full">
      <div className="rounded-md border border-border/50 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              {columns.map((column) => (
                <TableHead
                  key={column.key}
                  style={{ minWidth: column.width || 150 }}
                  className="h-10"
                >
                  <div className="w-fit flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">
                        {column.title[currentLang]}
                      </span>
                      <div className="flex items-center text-muted-foreground/60 ml-1">
                        {getTypeIcon(column.inputType, "h-3 w-3")}
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                        >
                          <MoreHorizontal className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem className="" onClick={() => openEditColumnDialog(column)}>
                          <Edit className="h-3 w-3 mr-2" />
                          {t('buttons.edit')}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => openDeleteColumnAlert(column)}
                          className="text-destructive focus:text-destructive"
                        // disabled={columns.length <= 1}
                        >
                          <Trash2 className="h-3 w-3 mr-2" />
                          {t('buttons.delete')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableHead>
              ))}
              <TableHead className="w-[100px] text-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={openAddColumnDialog}
                  className="h-8"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  {t('buttons.add-column')}
                </Button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length + 1}
                  className="h-32 text-center text-muted-foreground"
                >
                  <div className="flex flex-col items-center gap-2">
                    <FileSpreadsheet className="h-8 w-8 opacity-50" />
                    <span>{t('errors.no-data')}</span>
                    <Button variant="outline" size="sm" onClick={addRow} disabled={columns.length === 0 || !!editingKey}>
                      <Plus className="h-3 w-3 mr-1" />
                      {t('buttons.add-row')}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((record) => {
                const editing = isEditing(record.key)
                return (
                  <ConstructorTableEditingRow
                    key={record.key}
                    editing={editing}
                    record={record}
                    columns={columns}
                    saveEdit={saveEdit}
                    cancelEdit={cancelEdit}
                    startEdit={startEdit}
                    deleteRow={deleteRow}
                    renderEditCell={renderEditCell}
                    renderViewCell={renderViewCell}
                    disabled={!!editingKey}
                  />
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {rows.length > 0 && (
        <div className="mt-4">
          <Button
            variant="outline"
            onClick={addRow}
            disabled={!!editingKey}
            className="w-full border-dashed"
          >
            <Plus className="h-4 w-4 mr-2" />
            {t('buttons.add-row')}
          </Button>
        </div>
      )}

      <ConstructorTableFormDialog
        open={isColumnDialogOpen}
        onOpenChange={setIsColumnDialogOpen}
        onSubmit={handleColumnSubmit}
        initialData={selectedColumn}
        isEditing={isEditingColumn}
      />

      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin-page.delete-group-title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('admin-page.delete-group-warning')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('buttons.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteColumn} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t('buttons.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default ConstructorTable