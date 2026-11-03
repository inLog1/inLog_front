import { describe, expect, it } from 'vitest'
import type { DirectoryDefinition } from '../../../entities/personnel/model/types'
import {
  directorySections,
  filterDirectoriesBySection,
  sectionCounts,
} from './directory-sections'

function definition(key: string): DirectoryDefinition {
  return {
    id: `dir:101:${key}`,
    organizationId: 101,
    key,
    title: key,
    description: '',
    revision: 1,
    fields: [],
    source: { type: 'manual' },
    archived: false,
  }
}

describe('directorySections', () => {
  it('maps starter keys to sections and counts a directory in each linked section once', () => {
    const items = [definition('departments'), definition('positions'), definition('custom')]
    expect(directorySections(items[0])).toEqual(['org-structure', 'personnel'])
    expect(sectionCounts(items)).toMatchObject({
      all: 3,
      'org-structure': 1,
      personnel: 2,
      other: 1,
    })
    expect(filterDirectoriesBySection(items, 'personnel').map((item) => item.key).sort()).toEqual(['departments', 'positions'])
  })

  it('uses stored sections when they are set on the definition', () => {
    const custom = { ...definition('custom'), sections: ['equipment' as const] }
    expect(directorySections(custom)).toEqual(['equipment'])
    expect(filterDirectoriesBySection([custom], 'equipment')).toHaveLength(1)
    expect(filterDirectoriesBySection([custom], 'other')).toHaveLength(0)
  })
})
