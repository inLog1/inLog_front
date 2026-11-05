export function requestFailureCode(error: unknown): string | null {
  if (!error || typeof error !== 'object' || !('data' in error)) return null
  const data = error.data
  if (!data || typeof data !== 'object' || !('code' in data)) return null
  return typeof data.code === 'string' ? data.code : null
}

export function requestLabel(value: string, dash: string): string {
  const trimmed = value.trim()
  return trimmed ? trimmed : dash
}

export function formatRequestWhen(value: string, language: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(language.startsWith('en') ? 'en-GB' : 'ru', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export function formatRequestDay(value: string, language: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return ''
  const [year, month, date] = value.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, date))
  if (Number.isNaN(parsed.getTime())) return ''
  return new Intl.DateTimeFormat(language.startsWith('en') ? 'en-GB' : 'ru', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(parsed)
}

export function requestMatchesQuery(parts: readonly string[], query: string): boolean {
  const needle = query.trim().toLocaleLowerCase('ru')
  if (!needle) return true
  return parts.join(' ').toLocaleLowerCase('ru').includes(needle)
}
