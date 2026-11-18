import { Calendar, File, Hash, Type } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { AdminPanelGroup } from "../../../../entities/admin/model/types"
import { Checkbox } from "../../../../shared/ui/checkbox"
import { cn } from "../../../../shared/lib/utils"


interface Props{
    column: AdminPanelGroup
    isSelected: boolean
    disabled: boolean
    className?: string
    onSelect: (column: AdminPanelGroup, checked: boolean,e: React.MouseEvent) => void
}

const ReportTreeColumn = (props: Props) => {
    const { column, isSelected, disabled, className, onSelect } = props
    const { i18n } = useTranslation()
    const currentLang = i18n.language === 'ru' ? 'ru' : 'en'
    const columnName = currentLang === 'ru' ? column.name_ru : column.name_en

    const getTypeIcon = (type: AdminPanelGroup['type'], className = "h-4 w-4") => {
        switch (type) {
          case 'integer':
            return <Hash className={className} />
          case 'date':
            return <Calendar className={className} />
          case 'file':
            return <File className={className} />
          default:
            return <Type className={className} />
        }
      }


    return (
        <div
            className={cn("w-fit flex items-center gap-2 p-2 cursor-pointer", className)}
            onClick={(e) => onSelect(column, !isSelected, e)}
        >
            <Checkbox
                className='cursor-pointer'
                checked={isSelected}
                disabled={disabled}
            />
            {getTypeIcon(column.type)}
            <span className="text-sm">
                {columnName}
            </span>
        </div>
    )
}

export default ReportTreeColumn