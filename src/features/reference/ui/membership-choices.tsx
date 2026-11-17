import { useTranslation } from 'react-i18next'
import { Checkbox } from '../../../shared/ui/checkbox'
import { Label } from '../../../shared/ui/label'

export function RequiredMark() {
  const { t } = useTranslation()
  return (
    <>
      <span className="ml-1 text-destructive" aria-hidden="true">*</span>
      <span className="sr-only"> {t('validation.required')}</span>
    </>
  )
}

export function MembershipChoices({
  labelledBy,
  options,
  value,
  onChange,
  disabled,
}: {
  labelledBy: string
  options: { value: string; label: string; hint?: string; disabled?: boolean }[]
  value: string[]
  onChange: (value: string[]) => void
  disabled?: boolean
}) {
  const toggle = (optionValue: string, checked: boolean) => {
    if (checked) {
      if (value.includes(optionValue)) return
      onChange([...value, optionValue])
      return
    }
    onChange(value.filter((item) => item !== optionValue))
  }

  return (
    <div role="group" aria-labelledby={labelledBy} className="max-h-48 space-y-0.5 overflow-y-auto rounded-md border border-input p-1.5">
      {options.map((option) => {
        const inputId = `${labelledBy}-${option.value}`
        const optionDisabled = disabled || option.disabled
        return (
          <label
            key={option.value}
            htmlFor={inputId}
            className="flex cursor-pointer items-start gap-2 rounded-md px-1.5 py-1.5 text-sm hover:bg-muted/60 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60"
          >
            <Checkbox
              id={inputId}
              className="mt-0.5"
              checked={value.includes(option.value)}
              disabled={optionDisabled}
              onCheckedChange={(next) => toggle(option.value, next === true)}
            />
            <span className="min-w-0">
              <span className="block">{option.label}</span>
              {option.hint ? <span className="block text-xs text-muted-foreground">{option.hint}</span> : null}
            </span>
          </label>
        )
      })}
    </div>
  )
}

export function FieldLabel({
  id,
  htmlFor,
  children,
  required,
}: {
  id?: string
  htmlFor?: string
  children: string
  required?: boolean
}) {
  return (
    <Label id={id} htmlFor={htmlFor}>
      {children}
      {required ? <RequiredMark /> : null}
    </Label>
  )
}
