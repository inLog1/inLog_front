import { describe, expect, it } from 'vitest'
import { readCorporateLocation, writeCorporateLocation } from './corporate-search'

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
})
