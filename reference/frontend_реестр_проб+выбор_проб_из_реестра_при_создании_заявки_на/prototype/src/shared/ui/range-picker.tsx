"use client"

import * as React from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"
import type { DateRange } from "react-day-picker"

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
import { useTranslation } from "react-i18next"

interface RangePickerProps {
  value?: DateRange
  onChange?: (range: DateRange | undefined) => void
  placeholder?: string
  label?: string
  disabled?: boolean
  className?: string
  triggerClassName?: string
  calendarClassName?: string
  id?: string
  defaultMonth?: Date
  numberOfMonths?: number
}

export function RangePicker({
  value,
  onChange,
  placeholder,
  label,
  disabled = false,
  className,
  triggerClassName,
  calendarClassName,
  id = "date-range-picker",
  defaultMonth,
  numberOfMonths = 2,
}: RangePickerProps) {
  const { t } = useTranslation()
  const [date, setDate] = React.useState<DateRange | undefined>(value)
  const [isOpen, setIsOpen] = React.useState(false)

  React.useEffect(() => {
    setDate(value)
  }, [value])

  const handleSelect = (newDate: DateRange | undefined) => {
    setDate(newDate)
  }

  const handleButtonClick = (value: DateRange | undefined) => {
    setDate(value)
    onChange?.(value)
    setIsOpen(false)
  }

  return (
    <div className={cn("grid gap-2", className)}>
      {label && (
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
        </Label>
      )}

      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal px-3",
              !date && "text-muted-foreground",
              disabled && "opacity-50 cursor-not-allowed",
              triggerClassName
            )}
            disabled={disabled}
          >
            <CalendarIcon className={`mr-2 h-4 w-4 transition-colors text-muted-foreground ${isOpen && "text-primary"}`} />
            {date?.from ? (
              date.to ? (
                <>
                  {format(date.from, DATE_VIEW_FORMAT)} — {format(date.to, DATE_VIEW_FORMAT)}
                </>
              ) : (
                format(date.from, DATE_VIEW_FORMAT)
              )
            ) : (
              <span>{placeholder}</span>
            )}
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-auto p-2 bg-background" align="start">
          <Calendar
            mode="range"
            selected={date}
            onSelect={handleSelect}
            defaultMonth={defaultMonth ?? date?.from}
            numberOfMonths={numberOfMonths}
            className={calendarClassName}
            buttonVariant={"ghost"}
            style={{
              width: '400px',
            }}
          />
          <div className="flex justify-end gap-2 bg-background">
            <Button variant="ghost" className="w-fit" onClick={() => handleButtonClick(undefined)}>{t('buttons.clear')}</Button>
            <Button variant="default" className="w-fit" onClick={() => handleButtonClick(date)}>{t('buttons.apply')}</Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}