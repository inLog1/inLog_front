const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

/** Calendar date digits only; not shifted through the local timezone when parsing. */
export function isCalendarDate(value: string): boolean {
  const match = DATE_PATTERN.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12) return false
  const utc = new Date(Date.UTC(year, month - 1, day))
  return utc.getUTCFullYear() === year && utc.getUTCMonth() === month - 1 && utc.getUTCDate() === day
}

/** Local Date for calendar widgets; undefined when the string is empty or invalid. */
export function dateFromCalendarDate(value: string | null | undefined): Date | undefined {
  if (value == null || value === '' || !isCalendarDate(value)) return undefined
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

/** Writes local calendar components as YYYY-MM-DD. */
export function calendarDateFromDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
