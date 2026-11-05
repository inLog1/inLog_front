import { useState } from 'react'
import { ChevronDown, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Checkbox } from '../../../shared/ui/checkbox'
import { Input } from '../../../shared/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '../../../shared/ui/popover'

type OrganizationOption = { id: number; shortName: string }

type OrganizationMultiSelectProps = {
  options: readonly OrganizationOption[]
  value: readonly number[]
  onChange: (ids: number[]) => void
  disabled?: boolean
}

export function OrganizationMultiSelect({ options, value, onChange, disabled = false }: OrganizationMultiSelectProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const selected = options.filter((item) => value.includes(item.id))
  const needle = query.trim().toLowerCase()
  const shown = needle.length === 0
    ? options
    : options.filter((item) => item.shortName.toLowerCase().includes(needle))
  const allSelected = options.length > 0 && options.every((item) => value.includes(item.id))

  const toggle = (id: number) => {
    if (disabled) return
    onChange(value.includes(id) ? value.filter((item) => item !== id) : [...value, id])
  }

  const toggleAll = () => {
    if (disabled) return
    onChange(allSelected ? [] : options.map((item) => item.id))
  }

  return (
    <Popover open={open} onOpenChange={(next) => { if (!disabled) setOpen(next) }}>
      <PopoverTrigger asChild>
        <div
          role="combobox"
          tabIndex={disabled ? -1 : 0}
          aria-expanded={open}
          aria-disabled={disabled}
          aria-label={t('access.availability.organizations-placeholder')}
          className="flex min-h-9 w-full cursor-pointer items-center justify-between gap-2 rounded-md border border-border bg-transparent px-2 py-1 text-left text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
        >
          <span className="flex min-w-0 flex-1 flex-wrap gap-1">
            {selected.length === 0 ? (
              <span className="px-1 text-muted-foreground">{t('access.availability.organizations-placeholder')}</span>
            ) : selected.map((item) => (
              <span key={item.id} className="inline-flex max-w-full items-center gap-1 rounded-md border border-border bg-muted/70 px-1.5 py-0.5 text-xs text-foreground">
                <span className="truncate">{item.shortName}</span>
                <button
                  type="button"
                  disabled={disabled}
                  tabIndex={disabled ? -1 : 0}
                  aria-label={t('access.availability.remove', { name: item.shortName })}
                  className="inline-flex rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation()
                    event.preventDefault()
                    toggle(item.id)
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return
                    event.stopPropagation()
                    event.preventDefault()
                    toggle(item.id)
                  }}
                >
                  <X className="size-3" aria-hidden />
                </button>
              </span>
            ))}
          </span>
          <ChevronDown className="size-4 shrink-0 opacity-50" aria-hidden />
        </div>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
        <div className="flex items-center justify-between gap-2 border-b border-border px-2 py-1.5">
          <p className="text-xs text-muted-foreground">{t('access.availability.selected', { count: value.length, total: options.length })}</p>
          {options.length > 1 ? (
            <button type="button" className="text-xs font-medium text-primary" onClick={toggleAll}>
              {allSelected ? t('access.availability.clear') : t('access.availability.select-all')}
            </button>
          ) : null}
        </div>
        {options.length > 6 ? (
          <div className="border-b border-border p-2">
            <Input
              value={query}
              aria-label={t('access.availability.search')}
              placeholder={t('access.availability.search')}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        ) : null}
        <div className="max-h-60 overflow-y-auto p-1" role="listbox" aria-multiselectable="true">
          {shown.length === 0 ? (
            <p className="px-2 py-3 text-sm text-muted-foreground">{t('access.availability.nothing-found')}</p>
          ) : shown.map((item) => {
            const checked = value.includes(item.id)
            return (
              <div
                key={item.id}
                role="option"
                aria-selected={checked}
                tabIndex={0}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                onClick={() => toggle(item.id)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') return
                  event.preventDefault()
                  toggle(item.id)
                }}
              >
                <Checkbox checked={checked} tabIndex={-1} className="pointer-events-none" aria-hidden />
                <span className="min-w-0 truncate">{item.shortName}</span>
              </div>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
