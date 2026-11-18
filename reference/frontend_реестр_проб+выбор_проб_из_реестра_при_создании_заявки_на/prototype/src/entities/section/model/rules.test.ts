import { describe, expect, it } from 'vitest'
import { sectionsMode } from './availability'
import { acceptReturnTo, sectionReturnPath } from './return-to'
import {
  parseSectionConfig,
  sectionStatus,
  sectionTableSearch,
  visibleOrganizationSections,
} from './rules'

const item = {
  id: 'sec-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  title: 'Образцы',
  description: '',
  iconKey: 'samples',
  order: 2,
}

describe('section rules', () => {
  it('requires a published link and keeps an empty draft', () => {
    const draft = parseSectionConfig({
      schemaVersion: 1,
      title: 'Образцы',
      description: '',
      iconKey: 'samples',
      formId: '',
      tableViewId: '',
      showCreate: false,
      createLabel: '',
      order: 0,
    }, 'draft')
    expect(draft.ok).toBe(true)
    const published = parseSectionConfig({
      schemaVersion: 1,
      title: 'Образцы',
      description: '',
      iconKey: 'samples',
      formId: '',
      tableViewId: '',
      showCreate: true,
      createLabel: '',
      order: 0,
    }, 'publish')
    expect(published.ok).toBe(false)
    expect(parseSectionConfig({ schemaVersion: 2, title: 'Образцы' }, 'draft').ok).toBe(false)
    if (!parseSectionConfig({ schemaVersion: 2, title: 'Образцы' }, 'draft').ok) {
      expect(parseSectionConfig({ schemaVersion: 2, title: 'Образцы' }, 'draft')).toMatchObject({ code: 'unknown_schema' })
    }
  })

  it('separates draft, published, dirty and withdrawn states', () => {
    expect(sectionStatus({ active: true, publishedSourceRevision: null, draftRevision: 1 })).toBe('draft')
    expect(sectionStatus({ active: true, publishedSourceRevision: 2, draftRevision: 2 })).toBe('published')
    expect(sectionStatus({ active: true, publishedSourceRevision: 2, draftRevision: 3 })).toBe('published-dirty')
    expect(sectionStatus({ active: false, publishedSourceRevision: 2, draftRevision: 3 })).toBe('unpublished')
  })

  it('hides navigation without an organization and drops another section filter', () => {
    expect(visibleOrganizationSections({ organizationId: null, failed: false, items: [item] })).toEqual([])
    expect(visibleOrganizationSections({ organizationId: 101, failed: true, items: [item] })).toEqual([])
    const ordered = visibleOrganizationSections({
      organizationId: 101,
      failed: false,
      items: [item, { ...item, id: 'sec-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeef', order: 2, title: 'А' }],
    })
    expect(ordered.map((entry) => entry.title)).toEqual(['Образцы', 'А'])
    const foreign = sectionTableSearch(item.id, new URLSearchParams('org=101&for=sec-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeef&filters=[]'))
    expect(foreign.changed).toBe(true)
    expect(foreign.params.get('filters')).toBeNull()
    expect(foreign.params.get('org')).toBe('101')
    const own = sectionTableSearch(item.id, new URLSearchParams(`for=${item.id}&page=2`))
    expect(own.changed).toBe(false)
  })

  it('accepts only a relative return to the same organization', () => {
    const back = sectionReturnPath(item.id, 101)
    expect(acceptReturnTo(back, 101)).toBe(back)
    expect(acceptReturnTo('https://example.test/workspace/sections/' + item.id, 101)).toBeNull()
    expect(acceptReturnTo(`//example.test/workspace/sections/${item.id}?org=101`, 101)).toBeNull()
    expect(acceptReturnTo(`/workspace/sections/${item.id}?org=102`, 101)).toBeNull()
    expect(acceptReturnTo('/forms/form-sample1?org=101', 101)).toBeNull()
    expect(acceptReturnTo(`${back}&project=1001`, 101)).toBe(`${back}&project=1001`)
    expect(sectionsMode('live')).toBe('unavailable')
    expect(sectionsMode(undefined)).toBe('unavailable')
  })
})
