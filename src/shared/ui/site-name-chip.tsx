import { cn } from '../lib/utils'

const TONES = [
    {
        background: 'color-mix(in oklch, var(--primary) 16%, var(--card))',
        color: 'color-mix(in oklch, var(--primary) 70%, var(--foreground))',
        border: 'color-mix(in oklch, var(--primary) 40%, transparent)',
    },
    {
        background: 'color-mix(in oklch, var(--accent) 18%, var(--card))',
        color: 'color-mix(in oklch, var(--accent) 62%, var(--foreground))',
        border: 'color-mix(in oklch, var(--accent) 42%, transparent)',
    },
    {
        background: 'color-mix(in oklch, var(--success) 16%, var(--card))',
        color: 'color-mix(in oklch, var(--success) 58%, var(--foreground))',
        border: 'color-mix(in oklch, var(--success) 40%, transparent)',
    },
    {
        background: 'color-mix(in oklch, var(--shell-accent) 14%, var(--card))',
        color: 'var(--shell-header-fg)',
        border: 'color-mix(in oklch, var(--shell-accent) 36%, transparent)',
    },
    {
        background: 'color-mix(in oklch, var(--warning) 18%, var(--card))',
        color: 'color-mix(in oklch, var(--warning) 55%, var(--foreground))',
        border: 'color-mix(in oklch, var(--warning) 42%, transparent)',
    },
]

function toneIndex(value: string) {
    let hash = 0
    for (let index = 0; index < value.length; index += 1) {
        hash = (hash * 31 + value.charCodeAt(index)) >>> 0
    }
    return hash % TONES.length
}

export function SiteNameChip({
    value,
    toneKey,
    className,
}: {
    value?: string | null
    toneKey?: string
    className?: string
}) {
    const label = value?.trim()
    if (!label || label === '—') return <span className="text-muted-foreground">—</span>

    const tone = TONES[toneIndex(toneKey || label)]
    return (
        <span
            className={cn(
                'inline-flex max-w-[14rem] items-center rounded-full border px-2.5 py-0.5 text-xs font-medium leading-5',
                className,
            )}
            style={{ background: tone.background, color: tone.color, borderColor: tone.border }}
            title={label}
        >
            <span className="truncate">{label}</span>
        </span>
    )
}
