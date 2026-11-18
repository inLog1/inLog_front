"use client"

import * as React from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"
import { enUS, ru } from "react-day-picker/locale"
import { useTranslation } from "react-i18next"

import { cn } from "../lib/utils"
import { Button } from "./button"
import { Calendar } from "./calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./popover"
import { Label } from "./label"
import { DATE_VIEW_FORMAT } from "../config/constants"

interface DatePickerProps {
  value?: Date
  onChange?: (date: Date | undefined) => void
  placeholder?: string
  label?: string
  disabled?: boolean
  className?: string
  triggerClassName?: string
  calendarClassName?: string
  id?: string
  defaultMonth?: Date
  fromYear?: number
  toYear?: number
  triggerProps?: React.ComponentProps<typeof Button>
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Выберите дату",
  label,
  disabled = false,
  className,
  triggerClassName,
  calendarClassName,
  id = "date-picker",
  defaultMonth,
  fromYear,
  toYear,
  triggerProps,
}: DatePickerProps) {
  const { t, i18n } = useTranslation()
  const [date, setDate] = React.useState<Date | undefined>(value)
  const [isOpen, setIsOpen] = React.useState(false)

  const calendarLocale = i18n.language?.startsWith("ru") ? ru : enUS

  const yearBounds = React.useMemo(() => {
    const currentYear = new Date().getFullYear()
    const minYear = fromYear ?? currentYear - 100
    const maxYear = toYear ?? currentYear
    return {
      startMonth: new Date(minYear, 0, 1),
      endMonth: new Date(maxYear, 11, 1),
    }
  }, [fromYear, toYear])

  // Синхронизация внешнего value
  React.useEffect(() => {
    setDate(value)
  }, [value])

  // Внутренний обработчик изменения
  const handleSelect = (newDate: Date | undefined) => {
    setDate(newDate)
  }

  const handleApply = () => {
    onChange?.(date)
    setIsOpen(false)
  }

  const handleClear = () => {
    setDate(undefined)
    onChange?.(undefined)
    setIsOpen(false)
  }

  return (
    <div className={cn("grid gap-2", className)}>
      {label && (
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
        </Label>
      )}

      <Popover open={isOpen} onOpenChange={setIsOpen} >
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            className={cn(
              "h-9 w-full justify-start gap-2 text-left font-normal px-3 bg-transparent",
              !date && "text-muted-foreground",
              disabled && "opacity-50 cursor-not-allowed",
              triggerClassName
            )}
            disabled={disabled}
            {...triggerProps}
          >
            <CalendarIcon className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-colors", isOpen && "text-primary")} />
            {date ? (
              format(date, DATE_VIEW_FORMAT)
            ) : (
              <span>{placeholder}</span>
            )}
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-auto overflow-visible p-0 bg-background" align="start">
            <Calendar
              mode="single"
              selected={date}
              onSelect={handleSelect}
              defaultMonth={defaultMonth ?? date}
              className={calendarClassName}
              captionLayout="dropdown"
              reverseYears
              startMonth={yearBounds.startMonth}
              endMonth={yearBounds.endMonth}
              locale={calendarLocale}
              initialFocus
            />
          <div className="flex items-center justify-end gap-2 p-2 pt-0">
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={handleClear}
              className="h-8 px-3"
            >
              {t('buttons.clear')}
            </Button>
            <Button
              variant="default"
              size="sm"
              type="button"
              onClick={handleApply}
              className="h-8 px-3"
            >
              {t('buttons.apply')}
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}