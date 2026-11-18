import { Search } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '../../../shared/ui/button'
import { Input } from '../../../shared/ui/input'

interface AdminSearchBarProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  placeholder: string
  actionLabel: string
  extra?: ReactNode
}

export function AdminSearchBar({
  value,
  onChange,
  onSubmit,
  placeholder,
  actionLabel,
  extra,
}: AdminSearchBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-[240px] flex-1 max-w-xl">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="pl-9"
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              onSubmit()
            }
          }}
        />
      </div>
      <Button variant="outline" onClick={onSubmit}>
        {actionLabel}
      </Button>
      {extra}
    </div>
  )
}
