import { describe, expect, it } from 'vitest'
import { organizationHeading, personWithPosition } from './requisites'

describe('organization requisites', () => {
  it('writes the short name in parentheses and keeps a single name when the other is empty', () => {
    expect(organizationHeading('Лаборатория Север', 'Север')).toBe('Лаборатория Север(Север)')
    expect(organizationHeading('Лаборатория Север', '  ')).toBe('Лаборатория Север')
    expect(organizationHeading('', 'Север')).toBe('Север')
  })

  it('requires surname, both initials and a position', () => {
    expect(personWithPosition({
      surname: 'Лебедев',
      name: 'Борис',
      patronymic: 'Ильич',
      position: 'Заведующий лабораторией',
    })).toBe('Лебедев Б.И. - Заведующий лабораторией')
    expect(personWithPosition({
      surname: 'Лебедев',
      name: 'Борис',
      patronymic: '',
      position: 'Заведующий лабораторией',
    })).toBeNull()
  })
})
