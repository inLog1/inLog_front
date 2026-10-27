'use client'

import {
  Download,
  Eye,
  File as FileIcon,
  Info,
  MoreHorizontal,
  Trash2,
  Upload
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { imageExtensions } from '../config/constants'
import { cn } from '../lib/utils'
import { Button } from './button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './dropdown-menu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip'

interface IFile {
  id: number
  file: string
  filename: string
  size?: number
  created_at?: string
  mime_type?: string
  isNew?: boolean // Флаг для новых файлов, только что загруженных
}

interface Props {
  files?: IFile[]
  title?: string
  onUpload?: (file: File) => void
  uploadDisabledReason?: string
  onDelete?: (id: number) => void
}

export function FileAttachment({
  files = [],
  title,
  onUpload,
  uploadDisabledReason,
  onDelete,
}: Props) {
  const { t } = useTranslation()

  const [isDragging, setIsDragging] = useState(false)
  const [preview, setPreview] = useState<{
    open: boolean
    file?: string
    name?: string
  }>({ open: false })

  const handleUploadFiles = (fileList: FileList | null) => {
    if (!onUpload || !fileList) return

    Array.from(fileList).forEach((file) => {
      // const newFile: IFile = {
      //   id: Date.now(), // Временный ID
      //   file: URL.createObjectURL(file),
      //   filename: file.name,
      //   size: file.size,
      //   mime_type: file.type,
      //   created_at: new Date().toISOString(),
      //   isNew: true
      // }
      onUpload?.(file)
    })
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleUploadFiles(e.target.files)
    e.target.value = ''
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)

    handleUploadFiles(e.dataTransfer.files)
  }

  const isImage = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase() || ''
    return imageExtensions.includes(`.${ext}`)
  }

  const downloadFile = (url: string, filename: string) => {
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
  }

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return t('fields.unknown-size')
    const units = ['B', 'KB', 'MB', 'GB']
    let size = bytes
    let unitIndex = 0
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }
    return `${size.toFixed(1)} ${units[unitIndex]}`
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return t('fields.unknown-date')
    
    try {
      const date = new Date(dateString)
      const now = new Date()
      const diffMs = now.getTime() - date.getTime()
      const diffMins = Math.floor(diffMs / 60000)
      const diffHours = Math.floor(diffMs / 3600000)
      const diffDays = Math.floor(diffMs / 86400000)
      
      // Для файлов, загруженных сегодня
      if (diffDays === 0) {
        if (diffHours === 0) {
          return `${diffMins} ${t('fields.minutes-ago')}`
        }
        return `${diffHours} ${t('fields.hours-ago')}`
      }
      
      // Для старых файлов показываем полную дату
      return date.toLocaleString()
    } catch {
      return t('fields.unknown-date')
    }
  }

 return (
    <TooltipProvider>
      <div className="flex flex-col gap-4">
        {onUpload ? <div
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={cn(
            'relative flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed p-6 text-sm transition',
            isDragging
              ? 'border-primary bg-primary/10'
              : 'border-border hover:bg-muted'
          )}
        >
          <Upload className="w-4 h-4" />

          <span>
            {title ?? (isDragging ? t('fields.drag-file') : t('fields.upload-file-or-drag-it-here'))}
          </span>

          <input
            type="file"
            multiple
            className="absolute inset-0 opacity-0 cursor-pointer"
            onChange={handleInputChange}
          />
        </div> : uploadDisabledReason ? (
          <p className="text-sm text-muted-foreground">{uploadDisabledReason}</p>
        ) : null}

        {files.length > 0 && (
          <ul className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {files.map((file) => {
              const filename = file.filename.split('/').at(-1) || 'file'
              const isImageFile = isImage(filename)
              
              return (
                <li
                  key={file.id}
                  className={cn("relative group flex flex-col items-center justify-center rounded-md border border-border p-3 bg-muted/40 hover:bg-muted transition", isImageFile ? 'cursor-pointer' : 'cursor-default')}
                  onClick={() => {
                    if(isImageFile) {
                      setPreview({
                        open: true,
                        file: file.file,
                        name: filename,
                      })
                    }
                  }}
                >
                  <div className="flex items-center justify-center h-16">
                    {isImageFile ? (
                      <img
                        src={file.file}
                        alt={filename}
                        className="max-h-16 object-contain cursor-pointer"
                      />
                    ) : (
                      <FileIcon className="w-10 h-10 text-muted-foreground" />
                    )}
                  </div>

                  <p className="mt-2 text-xs text-center truncate w-full">
                    {filename}
                  </p>

                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 bg-accent/50 hover:bg-accent/70"
                          onClick={(e) => {
                            e.stopPropagation()
                            if(!isImageFile) {
                              e.preventDefault()
                            }
                          }}
                        >
                          <MoreHorizontal className="w-4 h-4 text-white" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        {isImageFile && (
                          <DropdownMenuItem
                            onClick={() =>
                              setPreview({
                                open: true,
                                file: file.file,
                                name: filename,
                              })
                            }
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            {t('buttons.preview')}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => downloadFile(file.file, filename)}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          {t('buttons.download')}
                        </DropdownMenuItem>
                        {onDelete && (
                          <DropdownMenuItem
                            onClick={() => onDelete(file.id)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            {t('buttons.delete')}
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition cursor-help"
                        onClick={(e) => {
                          e.stopPropagation()
                          if(!isImageFile) {
                            e.preventDefault()
                          }
                        }}
                      >
                        <Info className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" align="start" className="max-w-xs">
                      <div className="space-y-1 text-xs">
                        <p className="font-semibold">{filename}</p>
                        {file.size && (
                          <p>{t('fields.file-size')}: {formatFileSize(file.size)}</p>
                        )}
                        <p>{t('fields.upload-date')}: {formatDate(file.created_at)}</p>
                        {file.mime_type && (
                          <p>{t('fields.type')}: {file.mime_type}</p>
                        )}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </li>
              )
            })}
          </ul>
        )}

        <Dialog
          open={preview.open}
          onOpenChange={() => setPreview({ open: false, file: undefined, name: undefined })}
        >
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>{preview.name}</DialogTitle>
            </DialogHeader>

            {preview.file && (
              <img
                src={preview.file}
                alt={preview.name}
                className="w-full object-contain rounded-md"
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  )
} 