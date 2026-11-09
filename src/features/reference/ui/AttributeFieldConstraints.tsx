import { format } from 'date-fns'
import { useTranslation } from 'react-i18next'
import {
  CATALOG_DATE_DISPLAY_FORMATS,
  type CatalogAttributeType,
  type DirectoryAttributeConstraints,
} from '../../../entities/personnel/model/types'
import { Checkbox } from '../../../shared/ui/checkbox'
import { DatePicker } from '../../../shared/ui/date-picker'
import { Input } from '../../../shared/ui/input'
import { Label } from '../../../shared/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../shared/ui/select'

function isoFromDate(value: Date | undefined): string | null {
  if (!value) return null
  return format(value, 'yyyy-MM-dd')
}

function dateFromIso(value: string | null | undefined): Date | undefined {
  if (!value) return undefined
  const parsed = new Date(`${value}T12:00:00`)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

export function AttributeFieldConstraints({
  type,
  constraints,
  disabled,
  onChange,
}: {
  type: CatalogAttributeType
  constraints: DirectoryAttributeConstraints
  disabled?: boolean
  onChange: (next: DirectoryAttributeConstraints) => void
}) {
  const { t } = useTranslation()
  if (type === 'checkbox') {
    return <p className="text-sm text-muted-foreground">{t('directories.catalog.constraints.checkbox-note')}</p>
  }

  const patch = (part: DirectoryAttributeConstraints) => onChange({ ...constraints, ...part })

  if (type === 'text' || type === 'textarea') {
    return (
      <BoundNumber
        id="attribute-max-length"
        label={t('directories.catalog.constraints.max-length')}
        value={constraints.maxLength ?? null}
        disabled={disabled}
        integer
        onChange={(maxLength) => patch({ maxLength })}
      />
    )
  }

  if (type === 'number') {
    return (
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <BoundNumber
            id="attribute-number-min"
            label={t('directories.catalog.constraints.min')}
            value={constraints.min ?? null}
            disabled={disabled}
            onChange={(min) => patch({ min })}
          />
          <BoundNumber
            id="attribute-number-max"
            label={t('directories.catalog.constraints.max')}
            value={constraints.max ?? null}
            disabled={disabled}
            onChange={(max) => patch({ max })}
          />
        </div>
        <BoundNumber
          id="attribute-number-step"
          label={t('directories.catalog.constraints.step')}
          value={constraints.step ?? null}
          disabled={disabled}
          onChange={(step) => patch({ step })}
        />
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={constraints.integer === true}
            disabled={disabled}
            onCheckedChange={(checked) => patch({ integer: checked === true })}
          />
          {t('directories.catalog.constraints.integer')}
        </label>
      </div>
    )
  }

  if (type === 'date') {
    return (
      <div className="space-y-3">
        <DatePicker
          id="attribute-min-date"
          label={t('directories.catalog.constraints.min-date')}
          disabled={disabled}
          value={dateFromIso(constraints.minDate)}
          onChange={(value) => patch({ minDate: isoFromDate(value) })}
        />
        <DatePicker
          id="attribute-max-date"
          label={t('directories.catalog.constraints.max-date')}
          disabled={disabled}
          value={dateFromIso(constraints.maxDate)}
          onChange={(value) => patch({ maxDate: isoFromDate(value) })}
        />
        <div className="grid gap-1.5">
          <Label htmlFor="attribute-date-format">{t('directories.catalog.constraints.date-format')}</Label>
          <Select
            value={constraints.dateFormat ?? 'default'}
            disabled={disabled}
            onValueChange={(value) => patch({
              dateFormat: value === 'default' ? null : value as DirectoryAttributeConstraints['dateFormat'],
            })}
          >
            <SelectTrigger id="attribute-date-format">
              <SelectValue placeholder={t('directories.catalog.constraints.date-format-placeholder')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">{t('directories.catalog.constraints.date-format-default')}</SelectItem>
              {CATALOG_DATE_DISPLAY_FORMATS.map((format) => (
                <SelectItem key={format} value={format}>{t(`directories.catalog.constraints.date-formats.${format}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    )
  }

  if (type === 'file') {
    return (
      <div className="space-y-3">
        <div className="grid gap-1.5">
          <Label htmlFor="attribute-file-extensions">{t('directories.catalog.constraints.extensions')}</Label>
          <Input
            id="attribute-file-extensions"
            disabled={disabled}
            placeholder={t('directories.catalog.constraints.extensions-placeholder')}
            value={constraints.extensions ?? ''}
            onChange={(event) => patch({ extensions: event.target.value })}
          />
        </div>
        <BoundNumber
          id="attribute-file-size"
          label={t('directories.catalog.constraints.max-file-size')}
          value={constraints.maxFileSizeMb ?? null}
          disabled={disabled}
          onChange={(maxFileSizeMb) => patch({ maxFileSizeMb })}
        />
        <BoundNumber
          id="attribute-file-count"
          label={t('directories.catalog.constraints.max-file-count')}
          value={constraints.maxFileCount ?? null}
          disabled={disabled}
          integer
          onChange={(maxFileCount) => patch({ maxFileCount })}
        />
      </div>
    )
  }

  if (type === 'photo') {
    return (
      <div className="space-y-3">
        <div className="grid gap-1.5">
          <Label htmlFor="attribute-photo-formats">{t('directories.catalog.constraints.photo-formats')}</Label>
          <Input
            id="attribute-photo-formats"
            disabled={disabled}
            placeholder={t('directories.catalog.constraints.photo-formats-placeholder')}
            value={constraints.photoFormats ?? ''}
            onChange={(event) => patch({ photoFormats: event.target.value })}
          />
        </div>
        <BoundNumber
          id="attribute-photo-size"
          label={t('directories.catalog.constraints.max-photo-size')}
          value={constraints.maxPhotoSizeMb ?? null}
          disabled={disabled}
          onChange={(maxPhotoSizeMb) => patch({ maxPhotoSizeMb })}
        />
        <BoundNumber
          id="attribute-photo-count"
          label={t('directories.catalog.constraints.max-photo-count')}
          value={constraints.maxPhotoCount ?? null}
          disabled={disabled}
          integer
          onChange={(maxPhotoCount) => patch({ maxPhotoCount })}
        />
      </div>
    )
  }

  if (type === 'phone') {
    return (
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={constraints.internationalPhone === true}
            disabled={disabled}
            onCheckedChange={(checked) => patch({ internationalPhone: checked === true })}
          />
          {t('directories.catalog.constraints.international-phone')}
        </label>
        <div className="grid gap-1.5">
          <Label htmlFor="attribute-phone-mask">{t('directories.catalog.constraints.phone-mask')}</Label>
          <Input
            id="attribute-phone-mask"
            disabled={disabled}
            placeholder={t('directories.catalog.constraints.phone-mask-placeholder')}
            value={constraints.phoneMask ?? ''}
            onChange={(event) => patch({ phoneMask: event.target.value || null })}
          />
        </div>
      </div>
    )
  }

  if (type === 'email') {
    return (
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={constraints.validateEmailFormat !== false}
            disabled={disabled}
            onCheckedChange={(checked) => patch({ validateEmailFormat: checked === true })}
          />
          {t('directories.catalog.constraints.validate-email')}
        </label>
        <BoundNumber
          id="attribute-email-length"
          label={t('directories.catalog.constraints.max-email-length')}
          value={constraints.maxEmailLength ?? constraints.maxLength ?? null}
          disabled={disabled}
          integer
          onChange={(maxEmailLength) => patch({ maxEmailLength })}
        />
      </div>
    )
  }

  return null
}

function BoundNumber({
  id,
  label,
  value,
  integer,
  disabled,
  onChange,
}: {
  id: string
  label: string
  value: number | null
  integer?: boolean
  disabled?: boolean
  onChange: (value: number | null) => void
}) {
  const pattern = integer ? /^(?:0|[1-9]\d*)$/ : /^-?(?:\d+|\d*\.\d+)$/
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        disabled={disabled}
        inputMode={integer ? 'numeric' : 'decimal'}
        value={value === null ? '' : String(value)}
        onChange={(event) => {
          const next = event.target.value
          if (next.trim() === '') onChange(null)
          else if (pattern.test(next)) onChange(Number(next))
        }}
      />
    </div>
  )
}
