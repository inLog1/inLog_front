import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select'

const NONE = 'none'

/** Eighty widely used countries: the most populous, plus energy hubs already used in the product. */
export const POPULAR_COUNTRY_CODES = [
  'CN', 'IN', 'US', 'ID', 'PK', 'NG', 'BR', 'BD', 'RU', 'MX',
  'JP', 'ET', 'PH', 'EG', 'CD', 'VN', 'IR', 'TR', 'DE', 'TH',
  'GB', 'TZ', 'FR', 'ZA', 'IT', 'KE', 'MM', 'CO', 'KR', 'SD',
  'UG', 'ES', 'DZ', 'IQ', 'AR', 'AF', 'YE', 'CA', 'PL', 'MA',
  'SA', 'UA', 'AO', 'UZ', 'PE', 'MY', 'MZ', 'GH', 'NP', 'VE',
  'MG', 'CI', 'CM', 'AU', 'NE', 'LK', 'BF', 'ML', 'RO', 'MW',
  'CL', 'KZ', 'ZM', 'GT', 'EC', 'SY', 'NL', 'SN', 'KH', 'TD',
  'AE', 'NO', 'QA', 'KW', 'AZ', 'OM', 'BY', 'SG', 'BE', 'TN',
] as const

export interface PopularCountry {
  code: string
  name: string
}

export function usePopularCountries(): PopularCountry[] {
  const { i18n } = useTranslation()
  const language = i18n.resolvedLanguage || i18n.language || 'ru'

  return useMemo(() => {
    const names = new Intl.DisplayNames([language], { type: 'region' })
    return POPULAR_COUNTRY_CODES
      .map((code) => ({ code, name: names.of(code) ?? code }))
      .sort((left, right) => left.name.localeCompare(right.name, language))
  }, [language])
}

export function matchCountryCode(value: string, countries: PopularCountry[]) {
  const trimmed = value.trim()
  if (!trimmed) return ''
  const upper = trimmed.toUpperCase()
  if (countries.some((country) => country.code === upper)) return upper
  const byName = countries.find((country) => country.name.toLowerCase() === trimmed.toLowerCase())
  return byName?.code ?? trimmed
}

export function CountryFlag({ code }: { code: string }) {
  const normalized = code.trim().toLowerCase()
  if (!/^[a-z]{2}$/.test(normalized)) return null

  return (
    <img
      src={`https://flagcdn.com/w40/${normalized}.png`}
      alt=""
      width={20}
      height={15}
      loading="lazy"
      className="h-3.5 w-5 shrink-0 rounded-[2px] object-cover ring-1 ring-black/10"
    />
  )
}

export function CountryValue({ code }: { code?: string | null }) {
  const countries = usePopularCountries()
  const value = (code || '').trim()
  if (!value) return <>—</>

  const matched = matchCountryCode(value, countries)
  const country = countries.find((item) => item.code === matched)
  const label = country?.name ?? value
  const flagCode = country?.code ?? (/^[a-z]{2}$/i.test(value) ? value : '')

  return (
    <span className="inline-flex items-center gap-2">
      {flagCode ? <CountryFlag code={flagCode} /> : null}
      <span>{label}</span>
    </span>
  )
}

interface CountrySelectProps {
  value: string
  onChange: (code: string) => void
  id?: string
}

export function CountrySelect({ value, onChange, id }: CountrySelectProps) {
  const { t } = useTranslation()
  const countries = usePopularCountries()
  const selected = value ? matchCountryCode(value, countries) : ''
  const known = countries.some((country) => country.code === selected)
  const options = known || !selected
    ? countries
    : [{ code: selected, name: selected }, ...countries]

  return (
    <Select value={selected || NONE} onValueChange={(next) => onChange(next === NONE ? '' : next)}>
      <SelectTrigger id={id}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        <SelectItem value={NONE}>{t('fields.country-not-selected')}</SelectItem>
        {options.map((country) => (
          <SelectItem key={country.code} value={country.code}>
            <span className="flex items-center gap-2">
              <CountryFlag code={country.code} />
              <span>{country.name}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
