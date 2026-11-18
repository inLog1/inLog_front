import { Minus, Plus } from 'lucide-react'

export function SampleTreeToggle({
  expanded,
  label,
  onToggle,
}: {
  expanded: boolean
  label: string
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-expanded={expanded}
      onClick={(event) => {
        event.stopPropagation()
        onToggle()
      }}
      className="flex size-6 shrink-0 items-center justify-center rounded border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {expanded ? <Minus className="size-3.5" aria-hidden /> : <Plus className="size-3.5" aria-hidden />}
    </button>
  )
}
