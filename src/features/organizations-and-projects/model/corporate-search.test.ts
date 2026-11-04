import { describe, expect, it } from 'vitest'
import { omitWorkspaceSelection, readCorporateLocation, writeCorporateLocation } from './corporate-search'

describe('corporate overview location', () => {
  it('keeps filters and ignores an external return address', () => {
    const params = new URLSearchParams('corpTab=personnel&corpQ=иван&corpKind=laboratory&returnUrl=https://evil.example&org=101')
    expect(readCorporateLocation(params)).toMatchObject({
      tab: 'personnel',
      query: 'иван',
      kind: 'laboratory',
      personnelOrg: null,
      employee: null,
    })
    const next = writeCorporateLocation(params, { personnelOrg: 102, employee: 'new' })
    expect(next.get('returnUrl')).toBeNull()
    expect(next.get('org')).toBe('101')
    expect(next.get('personnelOrg')).toBe('102')
    expect(next.get('corpQ')).toBe('иван')
    expect(readCorporateLocation(new URLSearchParams('personnelOrg=0&employee=../admin'))).toMatchObject({
      personnelOrg: null,
      employee: null,
    })
  })

  it('drops a carried workspace organization from the corporation address', () => {
    const next = omitWorkspaceSelection(new URLSearchParams('org=1&project=10&corpTab=personnel&corpQ=иван'))
    expect(next?.get('org')).toBeNull()
    expect(next?.get('project')).toBeNull()
    expect(next?.get('corpTab')).toBe('personnel')
    expect(next?.get('corpQ')).toBe('иван')
    expect(omitWorkspaceSelection(new URLSearchParams('corpTab=organizations'))).toBeNull()
  })
})
