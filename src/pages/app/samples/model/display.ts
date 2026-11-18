import { formatSampleDate } from '../../../../entities/sample'

export function sampleDay(value: string, dash: string): string {
  const text = value.trim()
  if (!text) return dash
  return formatSampleDate(text)
}

export function formatSampleEventWhen(value: string, language: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return formatSampleDate(value)
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(language.startsWith('en') ? 'en-GB' : 'ru', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
}

export function sampleFailureCode(error: unknown): string | null {
  if (!error || typeof error !== 'object' || !('data' in error)) return null
  const data = error.data
  if (!data || typeof data !== 'object' || !('code' in data)) return null
  const code = data.code
  return typeof code === 'string' ? code : null
}

export function sampleQueryStatus(error: unknown): number | null {
  if (!error || typeof error !== 'object' || !('status' in error)) return null
  return typeof error.status === 'number' ? error.status : null
}
