import type { SampleCodeCounters } from './types'

/**
 * Registration numbers are pure functions of the records and counters the caller supplies.
 * Nothing in this module remembers the last issued number.
 * The mock service will pass its document on the next stage; production allocation belongs to the server.
 */

const ROOT_CODE = /^PRB-(\d{4})-(\d+)$/i
const SAMPLE_CODE = /^PRB-\d{4}-\d{6,}(?:-\d{2,})*$/i

export function registrationYear(at: string): string {
  const date = new Date(at)
  if (Number.isNaN(date.getTime())) throw new Error('invalid-date')
  return String(date.getFullYear())
}

export function isRootSampleCode(code: string): boolean {
  const match = ROOT_CODE.exec(code.trim())
  return Boolean(match && match[2].length >= 6)
}

export function isSampleCode(code: string): boolean {
  return SAMPLE_CODE.test(code.trim())
}

export function sameSampleCode(left: string, right: string): boolean {
  return left.trim().toLocaleLowerCase('ru') === right.trim().toLocaleLowerCase('ru')
}

export function formatRootSampleCode(year: number, sequence: number): string {
  if (!Number.isInteger(year) || year < 1000 || year > 9999) throw new Error('invalid-date')
  if (!Number.isSafeInteger(sequence) || sequence < 1) throw new Error('counter-overflow')
  return `PRB-${year}-${String(sequence).padStart(6, '0')}`
}

/** Appends the next suffix to the parent number as it is already stored. */
export function formatChildSampleCode(parentCode: string, sequence: number): string {
  const parent = parentCode.trim()
  if (!parent) throw new Error('invalid-parent')
  if (!Number.isSafeInteger(sequence) || sequence < 1) throw new Error('counter-overflow')
  return `${parent}-${String(sequence).padStart(2, '0')}`
}

/** Highest root sequence already used for the year, including logically deleted rows. */
export function rootSequenceFloor(
  records: readonly { code: string }[],
  counters: SampleCodeCounters,
  year: string,
): number {
  let last = counters[year] ?? 0
  for (const record of records) {
    const match = ROOT_CODE.exec(record.code.trim())
    if (match?.[1] !== year) continue
    const value = Number(match[2])
    if (Number.isSafeInteger(value)) last = Math.max(last, value)
  }
  return last
}

/** Highest direct-child suffix of this parent, including logically deleted children. Nested tails are ignored. */
export function childSequenceFloor(records: readonly { code: string }[], parentCode: string): number {
  const prefix = `${parentCode}-`
  const lower = prefix.toLocaleLowerCase('ru')
  let suffix = 0
  for (const record of records) {
    if (!record.code.toLocaleLowerCase('ru').startsWith(lower)) continue
    const tail = record.code.slice(prefix.length)
    if (!/^\d+$/.test(tail)) continue
    const value = Number(tail)
    if (Number.isSafeInteger(value)) suffix = Math.max(suffix, value)
  }
  return suffix
}

/** Code that would be issued next. Calling it again with the same input returns the same code. */
export function previewRootSampleCode(
  records: readonly { code: string }[],
  counters: SampleCodeCounters,
  at: string,
): string {
  const year = registrationYear(at)
  const last = rootSequenceFloor(records, counters, year)
  if (!Number.isSafeInteger(last + 1)) throw new Error('counter-overflow')
  return formatRootSampleCode(Number(year), last + 1)
}
