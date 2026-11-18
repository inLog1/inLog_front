import { Minus, Plus } from 'lucide-react'

export function SampleTreeToggle({code, expanded, onToggle}: {code:string; expanded:boolean; onToggle:()=>void}) {
  return <button type="button" aria-label={`${expanded ? 'Свернуть' : 'Показать'} подпробы ${code}`} aria-expanded={expanded} onClick={event=>{event.stopPropagation(); onToggle()}} className="flex size-6 shrink-0 items-center justify-center rounded border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{expanded ? <Minus className="size-3.5" aria-hidden /> : <Plus className="size-3.5" aria-hidden />}</button>
}
