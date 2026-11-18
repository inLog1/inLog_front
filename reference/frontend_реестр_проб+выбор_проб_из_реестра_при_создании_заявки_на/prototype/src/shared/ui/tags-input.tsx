import { Check, Search, X } from "lucide-react"
import * as React from "react"
import { cn } from "../lib/utils"
import { Badge } from "./badge"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./popover"

export interface TagsInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value?: string[]
  onChange?: (tags: string[]) => void
  placeholder?: string
  disabled?: boolean
  maxTags?: number
  options?: string[] // Существующие теги для автодополнения
}

const TagsInput = React.forwardRef<HTMLInputElement, TagsInputProps>(
  ({ className, value = [], onChange, placeholder, disabled, maxTags, options = [], ...props }, ref) => {
    const [inputValue, setInputValue] = React.useState("")
    const [open, setOpen] = React.useState(false)
    const inputRef = React.useRef<HTMLInputElement>(null)

    const setInputRef = React.useCallback(
      (node: HTMLInputElement | null) => {
        inputRef.current = node
        if (typeof ref === 'function') {
          ref(node)
        } else if (ref) {
          ref.current = node
        }
      },
      [ref]
    )

    // Фильтруем опции на основе ввода, исключая уже выбранные теги
    const filteredOptions = React.useMemo(() => {
      if (!options.length) return []
      return options.filter(
        option => 
          option.toLowerCase().includes(inputValue.toLowerCase()) && 
          !value.includes(option)
      )
    }, [options, inputValue, value])

    const addTag = (tag?: string) => {
      const tagToAdd = tag || inputValue.trim()
      
      if (tagToAdd && !value.includes(tagToAdd) && (!maxTags || value.length < maxTags)) {
        onChange?.([...value, tagToAdd])
        setInputValue("")
        setOpen(false)
      }
    }

    const removeTag = (tagToRemove: string) => {
      onChange?.(value.filter(tag => tag !== tagToRemove))
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" || e.key === ",") {
        e.preventDefault()
        addTag()
      } else if (e.key === "Backspace" && !inputValue && value.length > 0) {
        removeTag(value[value.length - 1])
      }
    }

    const handleBlur = () => {
      setTimeout(() => {
        if (!open && inputValue.trim()) {
          addTag()
        }
      }, 200)
    }

    return (
      <div className="relative w-full">
        <Popover open={open && filteredOptions.length > 0} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <div
              className={cn(
                "flex min-h-9 w-full flex-wrap items-center gap-2 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm ring-offset-background focus-within:ring-1 focus-within:ring-ring cursor-text",
                disabled && "cursor-not-allowed opacity-50",
                className
              )}
              onClick={() => {
                if (!disabled) {
                  inputRef.current?.focus()
                  if (options.length > 0 && inputValue) {
                    setOpen(true)
                  }
                }
              }}
            >
              {value.map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="gap-1 px-2 py-0.5 text-sm"
                >
                  {tag}
                  {!disabled && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        removeTag(tag)
                      }}
                      className="ml-1 rounded-full cursor-pointer outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    >
                      <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                    </button>
                  )}
                </Badge>
              ))}
              <input
                ref={setInputRef}
                type="text"
                className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed min-w-[120px] text-foreground text-sm"
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value)
                  if (e.target.value && options.length > 0) {
                    setOpen(true)
                  }
                }}
                onKeyDown={handleKeyDown}
                onBlur={handleBlur}
                placeholder={value.length === 0 ? placeholder : ""}
                disabled={disabled}
                {...props}
              />
            </div>
          </PopoverTrigger>
          <PopoverContent 
            className="w-full p-0 bg-popover text-popover-foreground shadow-md rounded-md border"
            align="start"
            sideOffset={4}
            style={{ 
              width: 'var(--radix-popover-trigger-width)',
              maxHeight: '300px'
            }}
          >
            <div className="flex items-center border-b border-border px-3">
              <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
              <input
                className="flex h-9 w-full rounded-md bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Поиск тегов..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                autoFocus
              />
            </div>
            <div className="max-h-48 overflow-auto p-1">
              {filteredOptions.length === 0 ? (
                <div className="py-2 text-center text-sm text-muted-foreground">
                  Теги не найдены
                </div>
              ) : (
                filteredOptions.map((option, index) => (
                  <button
                    key={option+index}
                    className={cn(
                      "relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
                      "data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                    )}
                    onClick={() => {
                      addTag(option)
                      setInputValue("")
                      inputRef.current?.focus()
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.focus()
                    }}
                  >
                    <span className="flex-1 text-left">{option}</span>
                    {value.includes(option) && (
                      <Check className="ml-2 h-4 w-4 shrink-0 text-primary" />
                    )}
                  </button>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    )
  }
)

TagsInput.displayName = "TagsInput"

export { TagsInput }
