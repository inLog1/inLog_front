'use client'

import * as React from "react"
import { Check, ChevronsUpDown, X } from "lucide-react"

import { cn } from "../lib/utils"
import { Button } from "../../shared/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../../shared/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../shared/ui/popover"
import { Badge } from "../../shared/ui/badge"
import { useTranslation } from 'react-i18next'

export interface MultiSelectOption {
  value: string
  label: string
  fixed?: boolean 
}

interface MultiSelectProps {
  options: { label: string; value: string; fixed?: boolean }[]
  value?: string[]
  onValueChange?: (value: string[]) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  renderOption?: (option: MultiSelectOption) => React.ReactNode
}

export function MultiSelect({
  options = [],
  value = [],
  onValueChange,
  placeholder,
  disabled = false,
  className,
  renderOption,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false)
  const { t } = useTranslation()

  const fixedOptions = React.useMemo(() => {
    return options.filter(opt => opt.fixed === true)
  }, [options])

  const fixedValues = React.useMemo(() => {
    return fixedOptions.map(opt => opt.value)
  }, [fixedOptions])

  React.useEffect(() => {
    const missingFixedValues = fixedValues.filter(v => !value.includes(v))
    if (missingFixedValues.length > 0 && onValueChange) {
      onValueChange([...value, ...missingFixedValues])
    }
  }, [fixedValues, value, onValueChange])

  const handleToggle = (optionValue: string) => {
    const option = options.find(opt => opt.value === optionValue)
    
    if (option?.fixed) {
      return
    }

    const newValue = value.includes(optionValue)
      ? value.filter((v) => v !== optionValue)
      : [...value, optionValue]
    
    onValueChange?.(newValue)
  }

  const handleRemove = (optionValue: string, event: React.MouseEvent | React.KeyboardEvent) => {
    event.stopPropagation()
    const option = options.find(opt => opt.value === optionValue)
    
    if (option?.fixed) {
      return
    }
    
    const newValue = value.filter((v) => v !== optionValue)
    onValueChange?.(newValue)
  }

  const getOptionLabel = (optionValue: string) => {
    const option = options.find((opt) => opt.value === optionValue)
    return option?.label || optionValue
  }

  const isOptionFixed = (optionValue: string) => {
    const option = options.find(opt => opt.value === optionValue)
    return option?.fixed === true
  }

  const handleKeyDown = (e: React.KeyboardEvent, optionValue: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleRemove(optionValue, e)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between h-auto min-h-10 py-2 px-2",
            disabled && "cursor-not-allowed",
            className
          )}
          disabled={disabled}
        >
          <div className="flex flex-wrap gap-1 flex-1 mr-2">
            {value.length > 0 ? (
              value.map((itemValue) => {
                const isFixed = isOptionFixed(itemValue)
                return (
                  <Badge
                    key={itemValue}
                    variant={isFixed ? "secondary" : "default"}
                    className="gap-1"
                  >
                    {getOptionLabel(itemValue)}
                    {!isFixed && (
                      <span
                        role="button"
                        tabIndex={0}
                        className={cn(
                          "h-4 w-4 p-0 inline-flex items-center justify-center rounded-sm",
                          "hover:bg-accent hover:text-accent-foreground",
                          "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                          "cursor-pointer"
                        )}
                        onClick={(e) => handleRemove(itemValue, e)}
                        onKeyDown={(e) => handleKeyDown(e, itemValue)}
                        aria-label={`Remove ${getOptionLabel(itemValue)}`}
                      >
                        <X className="h-3 w-3" />
                      </span>
                    )}
                  </Badge>
                )
              })
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </div>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandInput placeholder={t('fields.search')} />
          <CommandEmpty>{t('fields.nothing-found')}</CommandEmpty>
          <CommandList>
            <CommandGroup>
              {options.map((option) => {
                const isFixed = option.fixed === true
                const isSelected = value.includes(option.value)
                
                return (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    onSelect={() => handleToggle(option.value)}
                    disabled={isFixed}
                    className={cn(
                      "cursor-pointer text-popover-foreground",
                      isFixed && "cursor-default text-muted-foreground"
                    )}
                  >
                    <div
                      className={cn(
                        "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border",
                        isSelected
                          ? "bg-primary border-primary text-popover-foreground"
                          : "border-muted-foreground/20"
                      )}
                    >
                      {isSelected && (
                        <Check className="h-3 w-3" />
                      )}
                    </div>
                    <span className="flex-1">
                      {renderOption ? renderOption(option) : option.label}
                    </span>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}