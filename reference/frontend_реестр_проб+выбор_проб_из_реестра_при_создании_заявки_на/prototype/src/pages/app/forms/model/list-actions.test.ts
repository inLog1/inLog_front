import { describe, expect, it } from 'vitest'
import { formListActions, type FormListActionInput } from './list-actions'

const hrefs: FormListActionInput['hrefs'] = {
  configure: '/forms/form-1?org=101',
  fill: '/forms/form-1/fill?org=101',
  records: '/forms/form-1/records?org=101',
  tables: '/forms/form-1/views?org=101',
}

function actions(patch: Partial<FormListActionInput>) {
  return formListActions({
    canUpdate: false,
    canRecords: false,
    canViews: false,
    published: false,
    hrefs,
    ...patch,
  })
}

describe('form list actions', () => {
  it('keeps configure as the author action and moves the other routes into the menu', () => {
    const result = actions({ canUpdate: true, canRecords: true, canViews: true, published: true })
    expect(result.primary).toEqual({ kind: 'configure', href: hrefs.configure })
    expect(result.menu.map((item) => item.kind)).toEqual(['fill', 'records', 'tables'])
    expect(result.menu.map((item) => item.href)).toEqual([hrefs.fill, hrefs.records, hrefs.tables])
  })

  it('does not offer the editor when update is missing and prefers published filling', () => {
    const result = actions({ canRecords: true, canViews: true, published: true })
    expect(result.primary).toEqual({ kind: 'fill', href: hrefs.fill })
    expect(result.menu.map((item) => item.kind)).toEqual(['records', 'tables'])
    expect(result.primary?.kind).not.toBe('configure')
    expect(result.menu.some((item) => item.kind === 'configure')).toBe(false)
  })

  it('hides filling until a published version exists and falls back to records', () => {
    const result = actions({ canRecords: true, canViews: true, published: false })
    expect(result.primary).toEqual({ kind: 'records', href: hrefs.records })
    expect(result.menu.map((item) => item.kind)).toEqual(['tables'])
  })

  it('uses tables when that is the only permitted route', () => {
    const result = actions({ canViews: true })
    expect(result.primary).toEqual({ kind: 'tables', href: hrefs.tables })
    expect(result.menu).toEqual([])
  })

  it('offers no action when none of the previous routes are allowed', () => {
    expect(actions({})).toEqual({ primary: null, menu: [] })
  })
})
