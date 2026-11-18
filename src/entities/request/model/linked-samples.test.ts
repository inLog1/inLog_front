import { describe, expect, it } from 'vitest'
import { emptyRequestDraft } from './draft'
import { requestActiveSampleLinkIds, requestLinkedSampleIds } from './linked-samples'
import { emptyResearchNeed } from './needs'
import { emptyProgramMeta } from './program'

describe('request linked sample ids', () => {
  it('collects needs, the current programme and the approved snapshot once', () => {
    const details = emptyRequestDraft()
    details.needs = [{ ...emptyResearchNeed('need-1'), sampleIds: ['need-sample', 'shared-sample'] }]
    details.programMeta = {
      ...emptyProgramMeta(),
      lines: [{
        id: 'line-1',
        needId: 'need-1',
        targets: [],
        researchId: 'work-porosity',
        sampleTypeId: '',
        quantity: null,
        unitId: '',
        note: '',
        sampleIds: ['shared-sample', 'line-sample'],
      }],
      approvedSnapshot: {
        version: 1,
        preparedBy: 'laboratory',
        authorUserId: 2,
        approvedByUserId: 5,
        approvedAt: '2026-11-17T00:00:00.000Z',
        note: '',
        lines: [{
          id: 'line-1',
          needId: 'need-1',
          targets: [],
          researchId: 'work-porosity',
          sampleTypeId: '',
          quantity: null,
          unitId: '',
          note: '',
          sampleIds: ['snapshot-sample', 'line-sample'],
        }],
      },
    }
    expect(requestActiveSampleLinkIds(details)).toEqual([
      'need-sample',
      'shared-sample',
      'line-sample',
    ])
    expect(requestLinkedSampleIds(details)).toEqual([
      'need-sample',
      'shared-sample',
      'line-sample',
      'snapshot-sample',
    ])
  })

  it('does not treat a snapshot-only id as an active link', () => {
    const details = emptyRequestDraft()
    details.programMeta = {
      ...emptyProgramMeta(),
      approvedSnapshot: {
        version: 1,
        preparedBy: 'customer',
        authorUserId: 5,
        approvedByUserId: 5,
        approvedAt: '2026-11-17T00:00:00.000Z',
        note: '',
        lines: [{
          id: 'line-1',
          needId: '',
          targets: [],
          researchId: 'work-porosity',
          sampleTypeId: '',
          quantity: null,
          unitId: '',
          note: '',
          sampleIds: ['snapshot-only'],
        }],
      },
    }
    expect(requestActiveSampleLinkIds(details)).toEqual([])
    expect(requestLinkedSampleIds(details)).toEqual(['snapshot-only'])
    expect(requestActiveSampleLinkIds(undefined)).toEqual([])
  })

  it('leaves an old request without registry links empty and ignores the legacy catalogue list', () => {
    const details = emptyRequestDraft()
    details.sampleIds = ['catalog-sample']
    expect(requestLinkedSampleIds(details)).toEqual([])
    expect(requestLinkedSampleIds(undefined)).toEqual([])
  })
})
