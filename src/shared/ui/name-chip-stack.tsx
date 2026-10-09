import { SiteNameChip } from './site-name-chip'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip'

export interface NameChipItem {
    id: string | number
    name: string
}

export function NameChipStack({ items, max = 2 }: { items: NameChipItem[]; max?: number }) {
    const named = items.filter((item) => item.name.trim())
    if (named.length === 0) return <span className="text-muted-foreground">—</span>

    const visible = named.slice(0, max)
    const extra = named.slice(max)

    return (
        <TooltipProvider delayDuration={200}>
            <div className="flex items-center gap-1">
                {visible.map((item) => (
                    <SiteNameChip
                        key={item.id}
                        value={item.name}
                        toneKey={String(item.id)}
                        className="max-w-[9rem]"
                    />
                ))}
                {extra.length > 0 && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span className="inline-flex h-6 min-w-6 cursor-default items-center justify-center rounded-full border border-border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
                                +{extra.length}
                            </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">
                            {extra.map((item) => (
                                <p key={item.id}>{item.name}</p>
                            ))}
                        </TooltipContent>
                    </Tooltip>
                )}
            </div>
        </TooltipProvider>
    )
}
