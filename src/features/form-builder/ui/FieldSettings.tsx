import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { changeFieldType, FORM_FIELD_TYPES, type FormField, type FormFieldType } from '../../../entities/form'
import { Button } from '../../../shared/ui/button'
import { Checkbox } from '../../../shared/ui/checkbox'
import { Input } from '../../../shared/ui/input'
import { Label } from '../../../shared/ui/label'
import { Textarea } from '../../../shared/ui/textarea'

export function FieldSettings({ field, onChange }: { field: FormField; onChange: (field: FormField) => void }) {
  const { t } = useTranslation()
  const usesLength = field.type === 'text' || field.type === 'textarea'
  const usesNumber = field.type === 'number'
  return (
    <div className="min-w-0 space-y-3">
      <div className="space-y-1">
        <Label htmlFor={`${field.id}-type`}>{t('forms.field-type')}</Label>
        <select
          id={`${field.id}-type`}
          className="flex h-9 w-full rounded-md border border-border bg-transparent px-3 text-sm shadow-sm"
          value={field.type}
          onChange={(event) => onChange(changeFieldType(field, event.target.value as FormFieldType))}
        >
          {FORM_FIELD_TYPES.map((type) => (
            <option key={type} value={type}>{t(`forms.types.${type}`)}</option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${field.id}-label`}>{t('forms.field-label')}</Label>
        <Input
          id={`${field.id}-label`}
          value={field.label}
          onChange={(event) => onChange({ ...field, label: event.target.value })}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${field.id}-help`}>{t('forms.field-help')}</Label>
        <Textarea
          id={`${field.id}-help`}
          value={field.help}
          onChange={(event) => onChange({ ...field, help: event.target.value })}
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={field.required}
          onCheckedChange={(checked) => onChange({ ...field, required: checked === true })}
        />
        {t('forms.field-required')}
      </label>
      {usesLength ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <BoundNumber id={`${field.id}-min-length`} label={t('forms.min-length')} value={field.minLength} onChange={(minLength) => onChange({ ...field, minLength })} integer />
          <BoundNumber id={`${field.id}-max-length`} label={t('forms.max-length')} value={field.maxLength} onChange={(maxLength) => onChange({ ...field, maxLength })} integer />
        </div>
      ) : null}
      {usesNumber ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <BoundNumber id={`${field.id}-min`} label={t('forms.min')} value={field.min} onChange={(min) => onChange({ ...field, min })} />
          <BoundNumber id={`${field.id}-max`} label={t('forms.max')} value={field.max} onChange={(max) => onChange({ ...field, max })} />
        </div>
      ) : null}
      {field.type === 'single_choice' ? (
        <div className="space-y-2">
          <div className="text-sm font-medium">{t('forms.options')}</div>
          {field.options.map((option) => (
            <div key={option.id} className="flex min-w-0 gap-2">
              <Input
                aria-label={t('forms.option-label')}
                value={option.label}
                onChange={(event) => onChange({
                  ...field,
                  options: field.options.map((item) => item.id === option.id ? { ...item, label: event.target.value } : item),
                })}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => onChange({ ...field, options: field.options.filter((item) => item.id !== option.id) })}
              >
                {t('forms.remove-option')}
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={() => onChange({ ...field, options: [...field.options, { id: crypto.randomUUID(), label: '' }] })}
          >
            {t('forms.add-option')}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

function BoundNumber({
  id,
  label,
  value,
  integer,
  onChange,
}: {
  id: string
  label: string
  value: number | null
  integer?: boolean
  onChange: (value: number | null) => void
}) {
  const [text, setText] = useState(value === null ? '' : String(value))
  const [seen, setSeen] = useState(value)
  if (value !== seen) {
    setSeen(value)
    setText(value === null ? '' : String(value))
  }
  const pattern = integer ? /^(?:0|[1-9]\d*)$/ : /^-?(?:\d+|\d*\.\d+)$/
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        inputMode={integer ? 'numeric' : 'decimal'}
        value={text}
        onChange={(event) => {
          const next = event.target.value
          setText(next)
          if (next.trim() === '') onChange(null)
          else if (pattern.test(next)) onChange(Number(next))
        }}
      />
    </div>
  )
}
