import { describe, expect, it } from 'vitest'
import { emptyRequestDraft } from './draft'
import { copyProgramSnapshot, emptyProgramMeta, inspectProgramForApproval, inspectProgramStudyLines, lineFromNeed, programLinesRepeatNeeds, readProgramMeta } from './program'

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

  it('treats a copied study line as the same need, and a changed quantity as a laboratory decision', () => {
    const details = openNeed()
    const need = { ...details.needs[0]!, researchId: 'work-porosity', quantity: 15, unitId: 'unit-sample' }
    expect(programLinesRepeatNeeds([need], [lineFromNeed(need)])).toBe(true)
    expect(programLinesRepeatNeeds([need], [])).toBe(false)
    expect(programLinesRepeatNeeds([need], [{ ...lineFromNeed(need), quantity: 4 }])).toBe(false)
    expect(programLinesRepeatNeeds([need], [{ ...lineFromNeed(need), note: 'Уточнение' }])).toBe(false)
  })

  it('stores registry ids on a line and leaves an approved snapshot unchanged', () => {
    const details = openNeed()
    const need = { ...details.needs[0]!, researchId: 'work-porosity', sampleIds: ['sample-a'] }
    const copied = lineFromNeed(need)
    expect(copied.sampleIds).toEqual(['sample-a'])
    expect(programLinesRepeatNeeds([need], [copied])).toBe(true)
    expect(programLinesRepeatNeeds([need], [{ ...copied, sampleIds: ['sample-b'] }])).toBe(false)
    expect(programLinesRepeatNeeds([{ ...need, sampleIds: [] }], [{ ...copied, sampleIds: [] }])).toBe(true)

    const parsed = inspectProgramStudyLines([{ ...copied, sampleIds: ['sample-a', 'sample-b'] }], catalog)
    expect(parsed.ok).toBe(true)
    if (parsed.ok) expect(parsed.lines[0]?.sampleIds).toEqual(['sample-a', 'sample-b'])
    const plain = inspectProgramStudyLines([lineFromNeed(details.needs[0]!)], catalog)
    expect(plain.ok).toBe(true)
    if (plain.ok) expect(plain.lines[0]).not.toHaveProperty('sampleIds')
    expect(inspectProgramStudyLines([{ ...copied, sampleIds: ['bad id'] }], catalog).ok).toBe(false)

    const lines = [{ ...copied, sampleIds: ['sample-a'] }]
    const meta = { ...emptyProgramMeta(), preparedBy: 'laboratory' as const, authorUserId: 4, version: 2, lines }
    const snapshot = copyProgramSnapshot(meta, lines, 7, '2026-11-17T00:00:00.000Z')
    lines[0]?.sampleIds?.push('sample-c')
    expect(snapshot?.lines[0]?.sampleIds).toEqual(['sample-a'])
    const opened = readProgramMeta({
      ...meta,
      lines: [{ ...copied, sampleIds: ['sample-c'] }],
      approvedSnapshot: snapshot,
    })
    expect(opened.lines[0]?.sampleIds).toEqual(['sample-c'])
    expect(opened.approvedSnapshot?.lines[0]?.sampleIds).toEqual(['sample-a'])
  })
})
