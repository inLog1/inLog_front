import { describe, expect, it } from 'vitest'
import { emptyRequestDraft } from './draft'
import { emptyProgramMeta, inspectProgramForApproval, lineFromNeed } from './program'

const catalog = {
  workKinds: ['work-porosity', 'work-permeability'],
  sampleKinds: ['sample-kind-core'],
  units: ['unit-sample'],
}

function openNeed() {
  const details = emptyRequestDraft()
  details.fields = [{
    id: 'field-1',
    catalogFieldId: 'field-north',
    fieldName: 'Северное',
    wells: [{ id: 'well-1', catalogWellId: 'well-12', wellName: '12', intervals: [] }],
  }]
  details.needs = [{
    id: 'need-1',
    targets: [{ wellId: 'well-1', selection: 'well', intervalIds: [] }],
    researchId: '',
    desiredResult: 'Определить фильтрационно-ёмкостные свойства керна',
    sampleTypeId: '',
    quantity: null,
    unitId: '',
    comment: '',
    clarification: '',
    legacyLineId: '',
  }]
  return details
}

describe('study programme approval', () => {
  it('accepts a customer programme and rejects a need that still has no research', () => {
    const ready = emptyRequestDraft()
    ready.fields = openNeed().fields
    ready.needs = [{ ...openNeed().needs[0]!, researchId: 'work-porosity' }]
    const agreed = inspectProgramForApproval({
      fields: ready.fields,
      needs: ready.needs,
      meta: emptyProgramMeta(),
      catalog,
    })
    expect(agreed.ok).toBe(true)
    if (agreed.ok) expect(agreed.lines[0]?.researchId).toBe('work-porosity')

    const open = inspectProgramForApproval({
      fields: openNeed().fields,
      needs: openNeed().needs,
      meta: emptyProgramMeta(),
      catalog,
    })
    expect(open.ok).toBe(false)
  })

  it('keeps the customer wording and requires a catalogue research on the laboratory line', () => {
    const details = openNeed()
    const missing = inspectProgramForApproval({
      fields: details.fields,
      needs: details.needs,
      meta: { ...emptyProgramMeta(), preparedBy: 'laboratory', lines: [{ ...lineFromNeed(details.needs[0]!), researchId: 'missing' }] },
      catalog,
    })
    expect(missing.ok).toBe(false)
    const covered = inspectProgramForApproval({
      fields: details.fields,
      needs: details.needs,
      meta: {
        ...emptyProgramMeta(),
        preparedBy: 'laboratory',
        lines: [{ ...lineFromNeed(details.needs[0]!), researchId: 'work-permeability', quantity: 2, unitId: 'unit-sample' }],
      },
      catalog,
    })
    expect(covered.ok).toBe(true)
    expect(details.needs[0]?.desiredResult).toContain('фильтрационно')
  })

  it('rejects a quantity without a unit and allows a line with no quantity', () => {
    const details = openNeed()
    const line = { ...lineFromNeed(details.needs[0]!), researchId: 'work-porosity', quantity: 2, unitId: '' }
    expect(inspectProgramForApproval({
      fields: details.fields,
      needs: details.needs,
      meta: { ...emptyProgramMeta(), lines: [line] },
      catalog,
    }).ok).toBe(false)
    expect(inspectProgramForApproval({
      fields: details.fields,
      needs: details.needs,
      meta: { ...emptyProgramMeta(), lines: [{ ...line, quantity: null }] },
      catalog,
    }).ok).toBe(true)
  })
})
