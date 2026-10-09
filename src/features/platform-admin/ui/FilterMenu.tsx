import { Filter } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../../../shared/ui/button'
import { Input } from '../../../shared/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '../../../shared/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../shared/ui/select'

export interface FilterMenuField {
    id: string
    label: string
    kind: 'select' | 'text'
    placeholder?: string
    options?: { value: string; label: string }[]
    emptyValue: string
}

interface FilterMenuProps {
    values: Record<string, string>
    fields: FilterMenuField[]
    onApply: (values: Record<string, string>) => void
    active: boolean
}

export function FilterMenu({ values, fields, onApply, active }: FilterMenuProps) {
    const { t } = useTranslation()
    const [open, setOpen] = useState(false)
    const [draft, setDraft] = useState(values)

    const openChange = (next: boolean) => {
        if (next) setDraft(values)
        setOpen(next)
    }

    const apply = () => {
        onApply(draft)
        setOpen(false)
    }

    const reset = () => {
        const cleared = Object.fromEntries(fields.map((field) => [field.id, field.emptyValue]))
        setDraft(cleared)
        onApply(cleared)
        setOpen(false)
    }

    return (
        <Popover open={open} onOpenChange={openChange}>
            <PopoverTrigger asChild>
                <Button type="button" variant="outline" size="icon" className="relative" aria-label={t('admin-page.filters')}>
                    <Filter className="h-4 w-4" />
                    {active && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary" />}
                </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 space-y-4">
                <p className="text-sm font-semibold">{t('admin-page.filters')}</p>
                {fields.map((field) => (
                    <div key={field.id} className="space-y-1.5">
                        <label className="text-sm font-medium" htmlFor={`filter-${field.id}`}>
                            {field.label}
                        </label>
                        {field.kind === 'select' ? (
                            <Select
                                value={draft[field.id] || field.emptyValue}
                                onValueChange={(value) => setDraft((current) => ({ ...current, [field.id]: value }))}
                            >
                                <SelectTrigger id={`filter-${field.id}`}>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {field.options?.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        ) : (
                            <Input
                                id={`filter-${field.id}`}
                                value={draft[field.id] ?? ''}
                                placeholder={field.placeholder}
                                onChange={(event) => setDraft((current) => ({ ...current, [field.id]: event.target.value }))}
                            />
                        )}
                    </div>
                ))}
                <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={reset}>
                        {t('fields.clear-filters')}
                    </Button>
                    <Button type="button" onClick={apply}>
                        {t('buttons.apply')}
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    )
}

export function matchesCreatedPeriod(createdAt: string | undefined, period: string) {
    if (!period || period === 'all') return true
    if (!createdAt) return false
    const created = new Date(createdAt)
    if (Number.isNaN(created.getTime())) return false
    const now = new Date()
    if (period === 'year') return created.getFullYear() === now.getFullYear()
    const days = period === '30' ? 30 : 90
    return now.getTime() - created.getTime() <= days * 24 * 60 * 60 * 1000
}
