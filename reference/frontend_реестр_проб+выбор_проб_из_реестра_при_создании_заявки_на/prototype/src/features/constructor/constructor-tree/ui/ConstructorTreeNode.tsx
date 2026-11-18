import { ChevronDown, ChevronRight, FileText, FolderTree, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { AdminPanelNode } from '../../../../entities/admin/model/types'
import { cn } from '../../../../shared/lib/utils'
import { Button } from '../../../../shared/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '../../../../shared/ui/dropdown-menu'


interface Props {
    item: any
    node: AdminPanelNode
    mode: 'single' | 'multiple'
    onToggle?: (item: any) => void
    onEdit?: () => void
    onDelete?: () => void
    onCreate?: () => void
}

export const ConstructorTreeNode = ({
    item,
    node,
    onToggle,
    onEdit,
    onDelete,
    onCreate,
}: Props) => {
    const { t, i18n } = useTranslation()
    const currentLang = i18n.language === 'ru' ? 'ru' : 'en'
    const displayName = currentLang === 'ru' ? node.name_ru : node.name_en

    const hasChildren = item.isFolder()
    const isExpanded = item.isExpanded()
    const isSelected = item.isSelected()
    const level = item.getItemMeta().level

    return (
        <>
            <div className="select-none">
                <div
                    {...item.getProps()}
                    className={cn(
                        "flex items-center gap-2 py-2 px-3 rounded-lg transition-colors cursor-pointer group",
                        isSelected
                            ? "bg-primary/10 text-primary font-medium"
                            : "hover:bg-accent hover:text-accent-foreground"
                    )}
                    style={{ paddingLeft: `${level * 24 + 12}px` }}
                >
                    {/* Иконка раскрытия/сворачивания */}
                    {hasChildren && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation()
                                onToggle?.(item)
                            }}
                            className="flex-shrink-0 p-0.5 rounded hover:bg-muted transition-colors"
                        >
                            {isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                        </button>
                    )}

                    {/* Заглушка для отступа, если нет детей */}
                    {!hasChildren && <div className="w-5" />}

                    {/* Иконка узла */}
                    {hasChildren ? (
                        <FolderTree className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    ) : (
                        <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    )}

                    {/* Название узла */}
                    <span className="text-sm flex-1">
                        {displayName}
                    </span>

                    {/* Меню с тремя точками */}
                    {
                        (onEdit || onDelete || onCreate) && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-40">
                                    {
                                        onCreate && (
                                            <DropdownMenuItem onClick={() => onCreate()}>
                                                <Plus className="h-4 w-4 mr-2" />
                                                {t('admin-page.create-node')}
                                            </DropdownMenuItem>
                                        )
                                    }
                                    {
                                        onEdit && (
                                            <DropdownMenuItem onClick={() => onEdit()}>
                                                <Pencil className="h-4 w-4 mr-2" />
                                                {t('buttons.edit')}
                                            </DropdownMenuItem>
                                        )
                                    }
                                    {
                                        onDelete && (
                                            <DropdownMenuItem
                                                onClick={() => onDelete()}
                                                className="text-destructive focus:text-destructive"
                                            >
                                                <Trash2 className="h-4 w-4 mr-2" />
                                                {t('buttons.delete')}
                                            </DropdownMenuItem>
                                        )
                                    }
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )
                    }
                </div>
            </div>


        </>
    )
}