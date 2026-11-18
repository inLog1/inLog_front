import { describe, expect, it } from 'vitest'
import { sampleOutsideStudyObjects } from './sampleWarnings'

describe('sample and study objects', () => {
  it('warns only when known field and well do not match any selected object', () => {
    const objects = [{field:'Северное', well:'101'}, {field:'Южное', well:'12'}]
    expect(sampleOutsideStudyObjects({field:'северное', well:'№ 101'}, objects)).toBe(false)
    expect(sampleOutsideStudyObjects({field:'Северное', well:'12'}, objects)).toBe(true)
    expect(sampleOutsideStudyObjects({field:'', well:'12'}, objects)).toBe(false)
    expect(sampleOutsideStudyObjects({field:'Северное', well:'101'}, [])).toBe(false)
  })
})
