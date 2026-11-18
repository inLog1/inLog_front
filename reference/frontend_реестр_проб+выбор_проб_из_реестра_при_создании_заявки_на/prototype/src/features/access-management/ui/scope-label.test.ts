import { describe, expect, it } from 'vitest'
import type { TFunction } from 'i18next'
import { accessOrganizationDisplayName, roleDefinitionLabel } from './scope-label'

const t = ((key: string, options?: { id?: number }) => {
  if (key === 'access.scope.organization' && options?.id != null) return `Org #${options.id}`
  return key
}) as TFunction

describe('accessOrganizationDisplayName', () => {
  it('prefers full organization name over short name', () => {
    expect(accessOrganizationDisplayName(
      { shortName: 'делаем всякое', fullName: 'ООО Тестовая лаборатория' },
      42,
      t,
    )).toBe('ООО Тестовая лаборатория')
  })

  it('falls back to short name when full name is empty', () => {
    expect(accessOrganizationDisplayName({ shortName: 'Лаб. А', fullName: '' }, 1, t)).toBe('Лаб. А')
  })
})

describe('roleDefinitionLabel', () => {
  it('shows full names for organization roles', () => {
    const label = roleDefinitionLabel(
      { type: 'organization', organizationId: 10, corporationId: 1 },
      [{ id: 10, shortName: 'кратко', fullName: 'Полное название' }],
      t,
    )
    expect(label).toBe('Полное название')
  })
})
