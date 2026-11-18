import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { calendarDateFromDate, dateFromCalendarDate } from '../lib/calendar-date'
import { cn } from '../lib/utils'
import { DatePicker } from './date-picker'

export function CalendarDatePicker({
  value,
  onChange,
  placeholder,
  disabled,
  id,
  className,
  triggerClassName,
  fromYear,
  toYear,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedBy,
  'aria-label': ariaLabel,
}: {
  value?: string | null
  onChange?: (value: string | null) => void
  placeholder?: string
  disabled?: boolean
  id?: string
  className?: string
  triggerClassName?: string
  fromYear?: number
  toYear?: number
  'aria-invalid'?: boolean
  'aria-describedby'?: string
  'aria-label'?: string
}) {
  const { t } = useTranslation()
  const dateValue = useMemo(() => dateFromCalendarDate(value), [value])

  return (
    <DatePicker
      id={id}
      className={cn('gap-0', className)}
      disabled={disabled}
      placeholder={placeholder ?? t('fields.select-date')}
      value={dateValue}
      fromYear={fromYear}
      toYear={toYear}
      triggerClassName={cn(
        'h-9 w-full border-border font-normal shadow-sm md:text-sm',
        ariaInvalid && 'border-destructive focus-visible:ring-destructive',
        triggerClassName,
      )}
      triggerProps={{
        'aria-invalid': ariaInvalid,
        'aria-describedby': ariaDescribedBy,
        'aria-label': ariaLabel,
      }}
      onChange={(date) => onChange?.(date ? calendarDateFromDate(date) : null)}
    />
  )
}
