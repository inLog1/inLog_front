import { describe, expect, it } from 'vitest'
import {
  certificationTone,
  csvDocument,
  daysUntil,
  isLegacyPersonnelColumns,
  matchesQuery,
  matchesStatus,
  qualificationTone,
  registryMetrics,
  systemColumnVisible,
} from './registry'

const today = new Date('2026-11-04T12:00:00Z')

describe('personnel registry metrics', () => {
  it('counts people and certification dates without treating presence as a work permit', () => {
    expect(registryMetrics([
      { archived: false, certificationUntil: '2026-10-01' },
      { archived: false, certificationUntil: '2026-11-20' },
      { archived: false, certificationUntil: '' },
      { archived: true, certificationUntil: '2020-01-01' },
    ], today)).toEqual({ total: 3, overdueCertifications: 1, soonCertifications: 1 })
  })

  it('classifies a certification date around today', () => {
    expect(daysUntil('2026-11-14', today)).toBe(10)
    expect(certificationTone('2026-11-04', today)).toBe('current')
    expect(certificationTone('2026-11-05', today)).toBe('soon')
    expect(certificationTone('2026-12-04', today)).toBe('soon')
    expect(certificationTone('2026-12-05', today)).toBe('current')
    expect(certificationTone('2026-11-03', today)).toBe('overdue')
    expect(certificationTone('', today)).toBe('empty')
  })

  it('colors qualification from the stored status and does not invent one from a job title', () => {
    expect(qualificationTone('de:1:qualification-status:confirmed', '2027-01-01', today)).toBe('current')
    expect(qualificationTone('de:1:qualification-status:confirmed', '2026-11-20', today)).toBe('soon')
    expect(qualificationTone('de:1:qualification-status:confirmed', '2026-01-01', today)).toBe('overdue')
    expect(qualificationTone('de:1:qualification-status:needs-confirmation', '', today)).toBe('soon')
    expect(qualificationTone('de:1:qualification-status:unspecified', '2027-01-01', today)).toBe('neutral')
    expect(qualificationTone('', '', today)).toBe('neutral')
  })

  it('filters by name, email, personnel number, and certification state', () => {
    const row = { name: 'Иванов Иван', email: 'ivan@lab.test', personnelNumber: 'Т-10', qualificationId: 'de:1:qualification-status:confirmed', certificationUntil: '2026-10-01' }
    expect(matchesQuery(row, 'ivan@lab')).toBe(true)
    expect(matchesQuery(row, 'т-10')).toBe(true)
    expect(matchesQuery(row, 'петров')).toBe(false)
    expect(matchesStatus(row, 'overdue', today)).toBe(true)
    expect(matchesStatus(row, 'confirmed', today)).toBe(false)
    expect(matchesStatus({ ...row, certificationUntil: '2027-01-01' }, 'confirmed', today)).toBe(true)
  })

  it('keeps the previous default column set recognizable and still shows certification', () => {
    const columns = ['column.fio', 'pf:7:department', 'pf:7:position', 'pf:7:email', 'column.state']
    expect(isLegacyPersonnelColumns(columns, 7)).toBe(true)
    expect(systemColumnVisible(columns, 7, { id: 'pf:7:qualification-status', visible: true, archived: false })).toBe(true)
    const custom = columns.filter((id) => id !== 'pf:7:email')
    expect(systemColumnVisible(custom, 7, { id: 'pf:7:qualification-status', visible: true, archived: false })).toBe(false)
    expect(systemColumnVisible([...custom, 'pf:7:qualification-status'], 7, { id: 'pf:7:qualification-status', visible: true, archived: false })).toBe(true)
  })

  it('quotes csv cells that contain commas', () => {
    expect(csvDocument(['ФИО', 'Email'], [['Иванов, Иван', 'a@b.test']])).toBe('ФИО,Email\r\n"Иванов, Иван",a@b.test')
  })
})
