import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FORM_SCHEMA_VERSION, type FormAnswer, type FormAnswers, type FormSchema } from '../model/types'
import { Checkbox } from '../../../shared/ui/checkbox'
import { Input } from '../../../shared/ui/input'
import { Label } from '../../../shared/ui/label'
import { Textarea } from '../../../shared/ui/textarea'

export type FormRendererProps = {
  schema: FormSchema
  values: FormAnswers
  errors?: Readonly<Record<string, string>>
  readOnly?: boolean
  onChange?: (fieldId: string, value: FormAnswer) => void
}

export function FormRenderer({ schema, values, errors, readOnly = false, onChange }: FormRendererProps) {
  const { t } = useTranslation()
  if (schema.schemaVersion !== FORM_SCHEMA_VERSION || !Array.isArray(schema.fields)) {
    return <p className="text-sm text-destructive">{t('forms.unknown-schema')}</p>
  }
  return (
    <div className="space-y-4">
      {schema.fields.map((field) => {
        const error = errors?.[field.id]
        const described = [`${field.id}-help`, error ? `${field.id}-error` : ''].filter(Boolean).join(' ')
        return (
          <div key={field.id} className="min-w-0 space-y-1">
            <Label htmlFor={field.id}>
              {field.label}
              {field.required && field.type !== 'boolean' ? <span className="text-destructive"> *</span> : null}
            </Label>
            {field.help ? (
              <p id={`${field.id}-help`} className="text-xs text-muted-foreground whitespace-pre-wrap">{field.help}</p>
            ) : null}
            <FieldControl
              id={field.id}
              type={field.type}
              value={values[field.id]}
              options={field.options}
              readOnly={readOnly}
              describedBy={described}
              invalid={Boolean(error)}
              onChange={(value) => onChange?.(field.id, value)}
            />
            {error ? <p id={`${field.id}-error`} className="text-xs text-destructive">{t(`forms.field-errors.${error}`, { defaultValue: error })}</p> : null}
          </div>
        )
      })}
    </div>
  )
}

function FieldControl({
  id,
  type,
  value,
  options,
  readOnly,
  describedBy,
  invalid,
  onChange,
}: {
  id: string
  type: FormSchema['fields'][number]['type']
  value: FormAnswer | undefined
  options: FormSchema['fields'][number]['options']
  readOnly: boolean
  describedBy: string
  invalid: boolean
  onChange: (value: FormAnswer) => void
}) {
  const { t } = useTranslation()
  if (type === 'textarea') {
    return (
      <Textarea
        id={id}
        value={typeof value === 'string' ? value : ''}
        disabled={readOnly}
        aria-invalid={invalid}
        aria-describedby={describedBy || undefined}
        onChange={(event) => onChange(event.target.value)}
      />
    )
  }
  if (type === 'number') {
    return <NumberControl id={id} value={typeof value === 'number' ? value : null} readOnly={readOnly} describedBy={describedBy} invalid={invalid} onChange={onChange} />
  }
  if (type === 'date') {
    return (
      <Input
        id={id}
        type="date"
        value={typeof value === 'string' ? value : ''}
        disabled={readOnly}
        aria-invalid={invalid}
        aria-describedby={describedBy || undefined}
        onChange={(event) => onChange(event.target.value === '' ? null : event.target.value)}
      />
    )
  }
  if (type === 'single_choice') {
    return (
      <select
        id={id}
        className="flex h-9 w-full rounded-md border border-border bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        value={typeof value === 'string' ? value : ''}
        disabled={readOnly}
        aria-invalid={invalid}
        aria-describedby={describedBy || undefined}
        onChange={(event) => onChange(event.target.value === '' ? null : event.target.value)}
      >
        <option value="">{t('forms.choice-empty')}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>{option.label}</option>
        ))}
      </select>
    )
  }
  if (type === 'boolean') {
    return (
      <Checkbox
        id={id}
        checked={value === true}
        disabled={readOnly}
        aria-invalid={invalid}
        aria-describedby={describedBy || undefined}
        onCheckedChange={(checked) => onChange(checked === true)}
      />
    )
  }
  return (
    <Input
      id={id}
      value={typeof value === 'string' ? value : ''}
      disabled={readOnly}
      aria-invalid={invalid}
      aria-describedby={describedBy || undefined}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}

function NumberControl({
  id,
  value,
  readOnly,
  describedBy,
  invalid,
  onChange,
}: {
  id: string
  value: number | null
  readOnly: boolean
  describedBy: string
  invalid: boolean
  onChange: (value: FormAnswer) => void
}) {
  const [text, setText] = useState(value === null ? '' : String(value))
  const [seen, setSeen] = useState(value)
  if (value !== seen) {
    setSeen(value)
    setText(value === null ? '' : String(value))
  }
  return (
    <Input
      id={id}
      inputMode="decimal"
      value={text}
      disabled={readOnly}
      aria-invalid={invalid}
      aria-describedby={describedBy || undefined}
      onChange={(event) => {
        const next = event.target.value
        setText(next)
        if (next.trim() === '') {
          onChange(null)
          return
        }
        if (/^-?(?:\d+|\d*\.\d+)$/.test(next)) {
          const parsed = Number(next)
          if (Number.isFinite(parsed)) onChange(parsed)
        }
      }}
      onBlur={() => {
        if (text.trim() === '') {
          setText('')
          onChange(null)
          return
        }
        if (!/^-?(?:\d+|\d*\.\d+)$/.test(text) || !Number.isFinite(Number(text))) {
          setText(value === null ? '' : String(value))
        }
      }}
    />
  )
}
