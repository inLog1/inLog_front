import type { LucideIcon } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger } from './select'
import { cn } from '../lib/utils'

export type LabeledIconOption = {
  value: string
  label: string
}

/**
 * Closed control: icon, then "label: selected name", then the chevron.
 * The label stays. The name follows the selected option, including when the list has one row.
 */
export function LabeledIconSelect({
  label,
  icon: Icon,
  value,
  options,
  onValueChange,
  className,
  placeholder,
  disabled = false,
}: {
  label: string
  icon: LucideIcon
  value: string
  options: LabeledIconOption[]
  onValueChange: (value: string) => void
  className?: string
  /** Shown after the label when nothing is selected. Keeps the control visible. */
  placeholder?: string
  disabled?: boolean
}) {
  const selected = options.find((item) => item.value === value)
  if ((!selected && !placeholder) || (options.length === 0 && !placeholder)) return null
  const unavailable = disabled || options.length === 0

  return (
    <Select value={selected?.value ?? ''} onValueChange={onValueChange} disabled={unavailable}>
      <SelectTrigger
        className={cn(
          'h-9 w-auto max-w-full min-w-0 gap-2 rounded-lg border-border bg-card px-1.5 pr-2 shadow-sm [&>span]:line-clamp-none',
          className,
        )}
      >
        {/* div, not span: SelectTrigger's >span line-clamp sets display and knocks the icon off center */}
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-3.5 w-3.5" aria-hidden />
        </div>
        <span className="min-w-0 truncate text-sm font-medium text-foreground">
          <span className="font-normal text-muted-foreground">{label}:</span>
          {' '}
          {selected ? selected.label : <span className="font-normal text-muted-foreground">{placeholder}</span>}
        </span>
      </SelectTrigger>
      <SelectContent align="start" className="min-w-[12rem]">
        {options.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            <span className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-primary" aria-hidden />
              {item.label}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
