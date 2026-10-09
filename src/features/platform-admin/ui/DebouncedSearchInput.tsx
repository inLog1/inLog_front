import { Search } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Input } from '../../../shared/ui/input'

interface DebouncedSearchInputProps {
    value: string
    onDebouncedChange: (value: string) => void
    placeholder: string
    delay?: number
}

export function DebouncedSearchInput({
    value,
    onDebouncedChange,
    placeholder,
    delay = 300,
}: DebouncedSearchInputProps) {
    const [text, setText] = useState(value)
    const onChangeRef = useRef(onDebouncedChange)
    onChangeRef.current = onDebouncedChange

    useEffect(() => {
        const timeoutId = window.setTimeout(() => onChangeRef.current(text), delay)
        return () => window.clearTimeout(timeoutId)
    }, [delay, text])

    return (
        <div className="relative min-w-[240px] flex-1 max-w-xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder={placeholder}
                className="pl-9"
            />
        </div>
    )
}
