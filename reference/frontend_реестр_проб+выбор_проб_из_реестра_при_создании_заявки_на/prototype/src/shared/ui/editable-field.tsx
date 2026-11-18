'use client'

import { useState } from 'react'
import {
    type Control,
    type FieldPath,
    type FieldValues,
} from 'react-hook-form'
import {
    FormField,
    FormItem,
    FormLabel,
    FormControl,
    FormMessage,
} from '../../shared/ui/form'
import { Input } from '../../shared/ui/input'
import { Textarea } from '../../shared/ui/textarea'
import { Loader2, Pencil } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select'
import { cn } from '../lib/utils'
import { MultiSelect,  } from './multiple-select'
import { useTranslation } from 'react-i18next'

type EditableType =
    | 'input'
    | 'textarea'
    | 'select'
    | 'custom'
    | 'multiple-select'

interface SelectOption {
    label: string
    value: string
}

interface EditableFieldProps<
    T extends FieldValues
> {
    name: FieldPath<T>
    className?: string
    label?: string | React.ReactNode
    control: Control<T>
    type?: EditableType
    placeholder?: string
    options?: { label: string; value: string }[]
    isVisible?: boolean
    disabled?: boolean
    disabledReason?: string
    onSave: (name: FieldPath<T>, value: any) => Promise<void>
    renderCustom?: (
        value: any,
        save: (value: any) => void
    ) => React.ReactNode
    renderValue?: (value: any) => React.ReactNode
    renderOption?: (option: SelectOption) => React.ReactNode
    renderSelectedValue?: (selected: string[]) => React.ReactNode // Для кастомного отображения выбранных значений
}

export function EditableField<
    T extends FieldValues
>({
    name,
    className,
    label,
    control,
    type = 'input',
    placeholder,
    options,
    isVisible = true,
    disabled = false,
    disabledReason,
    renderOption,
    renderValue,
    renderSelectedValue,
    onSave,
    renderCustom,
}: EditableFieldProps<T>) {
    const { t } = useTranslation()
    const [editing, setEditing] = useState(false)
    const [loading, setLoading] = useState(false)
    if (disabled && editing) setEditing(false)

    const handleSave = async (value: any) => {
        if (disabled) {
            setEditing(false)
            return
        }
        try {
            setLoading(true)
            await onSave(name, value)
            setEditing(false)
        } finally {
            setLoading(false)
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>, value: any) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            (e.target as HTMLInputElement).blur()
            handleSave(value)
        }
    }

    const getOptionLabel = (value: string) => {
        const option = options?.find(o => o.value === value)
        return option?.label || value
    }

    const renderSelectedMultipleValues = (selectedValues: string[] = []) => {
        if (!selectedValues || selectedValues.length === 0) {
            return t('fields.not-specified')
        }

        if (renderSelectedValue) {
            return renderSelectedValue(selectedValues)
        }

        const labels = selectedValues
            .map(v => getOptionLabel(v))
            .filter(Boolean)

        if (labels.length <= 3) {
            return labels.join(', ')
        }

        return `${labels.slice(0, 3).join(', ')} и еще ${labels.length - 3}`
    }

    if (!isVisible) {
        return null
    }

    return (
        <FormField
            control={control}
            name={name}
            render={({ field }) => (
                <FormItem className={cn("flex flex-col gap-2", className)}>
                    {label && <FormLabel className="mb-0">{label}</FormLabel>}
                    <FormControl>
                        {editing ? (
                            <>
                                {type === 'input' && (
                                    <Input
                                        {...field}
                                        autoFocus
                                        onBlur={(e) =>
                                            handleSave(e.target.value)
                                        }
                                        onKeyDown={(e) => handleKeyDown(e, field.value)}
                                    />
                                )}

                                {type === 'textarea' && (
                                    <Textarea
                                        {...field}
                                        autoFocus
                                        onBlur={(e) =>
                                            handleSave(e.target.value)
                                        }
                                        onKeyDown={(e) => handleKeyDown(e, field.value)}
                                    />
                                )}

                                {type === 'select' && options && (
                                    <Select
                                        defaultValue={field.value}
                                        onValueChange={(value) =>
                                            handleSave(value)
                                        }
                                    >
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder={placeholder}>
                                                    {field.value && getOptionLabel(field.value)}
                                                </SelectValue>
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {options.map((o) => (
                                                <SelectItem key={o.value} value={o.value} className="px-0 py-1">
                                                    {renderOption ? renderOption(o) : o.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}

                                {type === 'multiple-select' && options && (
                                    <MultiSelect
                                        value={field.value || []}
                                        onValueChange={(value) => {
                                            handleSave(value)
                                        }}
                                        options={options}
                                        placeholder={placeholder}
                                        renderOption={renderOption}
                                    />
                                )}

                                {type === 'custom' &&
                                    renderCustom?.(
                                        field.value,
                                        handleSave
                                    )}
                            </>
                        ) : (
                            <div
                                onClick={() => {
                                    if (!disabled) setEditing(true)
                                }}
                                title={disabled ? disabledReason : undefined}
                                className={cn(
                                    'group flex items-center justify-between gap-2 rounded-md py-1.5 px-2 bg-muted/50 transition-colors',
                                    disabled ? 'cursor-not-allowed' : 'cursor-pointer',
                                )}
                            >
                                <span className="flex-1">
                                    {renderValue
                                        ? renderValue(field.value)
                                        : type === 'multiple-select'
                                            ? renderSelectedMultipleValues(field.value)
                                            : typeof field.value === 'object' && field.value !== null
                                                ? 'Не указано'
                                                : field.value || 'Не указано'}
                                </span>

                                <div className="flex items-center gap-2">
                                    {loading && (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    )}

                                    {!loading && !disabled && (
                                        <Pencil className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground" />
                                    )}
                                </div>
                            </div>
                        )}
                    </FormControl>
                    <FormMessage />
                </FormItem>
            )}
        />
    )
}