import type { TaskPriority } from '../../../entities/task/model/types'
import { priorityColorStyles } from '../../../shared/config/constants'
import { cn } from '../../../shared/lib/utils'
import { useTranslation } from 'react-i18next'

export function TaskPriorityChip({
  priority,
  className,
}: {
  priority?: string | null
  className?: string
}) {
  const { t } = useTranslation()
  const value = priority?.trim()
  if (!value) return <span className="text-muted-foreground">—</span>

  const color = priorityColorStyles[value as TaskPriority]
  const label = t(`fields.priority-types.${value}`, { defaultValue: value })

  return (
    <span
      className={cn(
        'inline-flex max-w-[10rem] items-center rounded-full border px-2.5 py-0.5 text-xs font-medium leading-5',
        className,
      )}
      style={
        color
          ? {
              background: `color-mix(in srgb, ${color} 18%, var(--card))`,
              color,
              borderColor: `color-mix(in srgb, ${color} 42%, transparent)`,
            }
          : undefined
      }
      title={label}
    >
      <span className="truncate">{label}</span>
    </span>
  )
}
