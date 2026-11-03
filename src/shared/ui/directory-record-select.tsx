import { Label } from './label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './select'
import { cn } from '../lib/utils'

export const DIRECTORY_RECORD_NONE = '__none__'

export function DirectoryRecordSelect({
  label,
  emptyLabel,
  value,
  items,
  onChange,
  id,
  disabled,
  triggerClassName,
  'aria-label': ariaLabel,
}: {
  label?: string
  emptyLabel: string
  value: string
  items: Array<{ id: string; label: string }>
  onChange: (value: string) => void
  id?: string
  disabled?: boolean
  triggerClassName?: string
  'aria-label'?: string
}) {
  const control = (
    <Select
      value={value || DIRECTORY_RECORD_NONE}
      disabled={disabled}
      onValueChange={(next) => onChange(next === DIRECTORY_RECORD_NONE ? '' : next)}
    >
      <SelectTrigger id={id} className={cn(triggerClassName)} aria-label={ariaLabel}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={DIRECTORY_RECORD_NONE}>{emptyLabel}</SelectItem>
        {items.map((item) => (
          <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )

  if (label == null) return control

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {control}
    </div>
  )
}
