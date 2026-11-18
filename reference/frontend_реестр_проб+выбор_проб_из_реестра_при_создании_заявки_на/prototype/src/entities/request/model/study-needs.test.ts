import { describe, expect, it } from 'vitest'
import { draftFromRecord, emptyRequestDraft, inspectRequestDraft, inspectRequestForSend, type RequestDraftCatalogIds, type RequestDraftDetails } from './draft'
import {
  describeIntervalRemoval,
  describeWellRemoval,
  inspectNeedLinks,
  inspectPlannedQuantity,
  inspectResearchChoice,
  intervalsSelectedByNeed,
  wellsSelectedByNeed,
  withoutRequestInterval,
  withoutRequestWell,
} from './needs'
import { findWellById, inspectDepthInterval } from './study'
import { emptyProgramMeta } from './program'

const catalog: RequestDraftCatalogIds = {
  fields: ['field-north', 'field-east'],
  wells: ['well-12', 'well-18'],
  pads: ['pad-3'],
  formations: [],
  materials: [],
  fluidKinds: [],
  wellTypes: [],
  sampleKinds: ['sample-kind-depth'],
  workKinds: ['work-porosity'],
  units: ['unit-sample', 'unit-meter'],
  curators: [],
  samples: ['sample-k104'],
}

function porosityNeed(patch: Partial<RequestDraftDetails['needs'][number]> = {}): RequestDraftDetails['needs'][number] {
  return {
    id: 'need-porosity',
    targets: [],
    researchId: '',
    desiredResult: '',
    sampleTypeId: '',
    quantity: null,
    unitId: '',
    comment: '',
    clarification: '',
    legacyLineId: '',
    ...patch,
  }
}

/** Two fields, three wells, two interval selections and one whole well. */
function exampleStudy(): RequestDraftDetails {
  const details = emptyRequestDraft()
  details.projectName = 'Пористость керна'
  details.contractNumber = 'Д-14'
  details.subject.objectKind = 'core'
  details.plannedCompletion = '2026-12-20'
  details.fields = [
    {
      id: 'field-a',
      catalogFieldId: 'field-north',
      fieldName: 'Месторождение А',
      wells: [
        {
          id: 'well-101',
          catalogWellId: 'well-12',
          wellName: '101',
          intervals: [{ id: 'int-101', from: 1200, to: 1210, unit: 'm' }],
        },
        {
          id: 'well-102',
          catalogWellId: '',
          wellName: '102',
          intervals: [],
        },
      ],
    },
    {
      id: 'field-b',
      catalogFieldId: 'field-east',
      fieldName: 'Месторождение Б',
      wells: [
        {
          id: 'well-205',
          catalogWellId: 'well-18',
          wellName: '205',
          intervals: [{ id: 'int-205', from: 1400, to: 1420, unit: 'm' }],
        },
      ],
    },
  ]
  details.needs = [porosityNeed({
    researchId: 'work-porosity',
    desiredResult: 'Определить пористость керна',
    targets: [
      { wellId: 'well-101', selection: 'intervals', intervalIds: ['int-101'] },
      { wellId: 'well-102', selection: 'well', intervalIds: [] },
      { wellId: 'well-205', selection: 'intervals', intervalIds: ['int-205'] },
    ],
  })]
  return details
}

describe('study objects and research needs', () => {
  it('keeps one field and one well under stable ids', () => {
    const details = emptyRequestDraft()
    details.projectName = 'Северное'
    details.fields = [{
      id: 'field-a',
      catalogFieldId: 'field-north',
      fieldName: 'Северное',
      wells: [{ id: 'well-101', catalogWellId: 'well-12', wellName: '101', intervals: [] }],
    }]
    const parsed = inspectRequestDraft(details, catalog)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(findWellById(parsed.details.fields, 'well-101')?.field.id).toBe('field-a')
    expect(parsed.details.fields[0]?.wells[0]?.id).toBe('well-101')
  })

  it('accepts several fields, several wells and several intervals', () => {
    const parsed = inspectRequestDraft(exampleStudy(), catalog)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.details.fields.map((field) => field.id)).toEqual(['field-a', 'field-b'])
    expect(parsed.details.fields[0]?.wells.map((well) => well.id)).toEqual(['well-101', 'well-102'])
    expect(parsed.details.fields[0]?.wells[0]?.intervals).toHaveLength(1)
    expect(parsed.details.fields[0]?.wells[0]?.intervals.map((interval) => interval.id)).toEqual(['int-101'])
    const second = parsed.details.fields[0]?.wells[0]
    if (!second) return
    second.intervals = [
      { id: 'int-101', from: 1200, to: 1210, unit: 'm' },
      { id: 'int-101-b', from: 1300, to: 1310, unit: 'm' },
    ]
    expect(inspectRequestDraft(parsed.details, catalog).ok).toBe(true)
  })

  it('allows a well with no intervals and rejects a bad depth interval', () => {
    const details = exampleStudy()
    expect(details.fields[0]?.wells[1]?.intervals).toEqual([])
    expect(inspectRequestDraft(details, catalog).ok).toBe(true)
    expect(inspectDepthInterval({ from: 1200, to: 1210, unit: 'm' }).ok).toBe(true)
    expect(inspectDepthInterval({ from: 1210, to: 1200, unit: 'm' })).toEqual({ ok: false, code: 'invalid_bounds' })
    expect(inspectDepthInterval({ from: 10, to: 10, unit: 'm' }).ok).toBe(false)
    expect(inspectDepthInterval({ from: -1, to: 4, unit: 'm' })).toEqual({ ok: false, code: 'invalid_number' })
    expect(inspectDepthInterval({ from: 1, to: 2, unit: 'ft' })).toEqual({ ok: false, code: 'invalid_unit' })
    const broken = exampleStudy()
    const interval = broken.fields[0]?.wells[0]?.intervals[0]
    if (!interval) throw new Error('missing interval')
    interval.from = 1300
    interval.to = 1200
    const rejected = inspectRequestDraft(broken, catalog)
    expect(rejected.ok).toBe(false)
    if (!rejected.ok) expect(rejected.issues.some((issue) => issue.code === 'invalid_bounds')).toBe(true)
  })

  it('lets one need cover wells from both fields, including a whole well', () => {
    const details = exampleStudy()
    const parsed = inspectRequestDraft(details, catalog)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    const need = parsed.details.needs[0]
    if (!need) throw new Error('missing need')
    expect(wellsSelectedByNeed(parsed.details.fields, need).map((item) => item.well.wellName)).toEqual(['101', '102', '205'])
    expect(wellsSelectedByNeed(parsed.details.fields, need).map((item) => item.field.fieldName)).toEqual([
      'Месторождение А',
      'Месторождение А',
      'Месторождение Б',
    ])
    expect(intervalsSelectedByNeed(parsed.details.fields, need).map((item) => item.interval.id)).toEqual(['int-101', 'int-205'])
    expect(need.targets.find((target) => target.wellId === 'well-102')).toEqual({
      wellId: 'well-102',
      selection: 'well',
      intervalIds: [],
    })
    const whole = porosityNeed({
      id: 'need-one',
      targets: [{ wellId: 'well-102', selection: 'well', intervalIds: [] }],
      researchId: 'work-porosity',
    })
    details.needs = [whole]
    expect(inspectRequestDraft(details, catalog).ok).toBe(true)
    const ambiguous = porosityNeed({
      targets: [{ wellId: 'well-102', selection: 'intervals', intervalIds: [] }],
    })
    details.needs = [ambiguous]
    expect(inspectRequestDraft(details, catalog).ok).toBe(false)
    const mixed = porosityNeed({
      targets: [{ wellId: 'well-102', selection: 'well', intervalIds: ['int-101'] }],
    })
    details.needs = [mixed]
    expect(inspectRequestDraft(details, catalog).ok).toBe(false)
  })

  it('accepts a chosen research or a written result, and a quantity only together with a unit', () => {
    const chosen = exampleStudy()
    chosen.needs[0] = porosityNeed({
      researchId: 'work-porosity',
      targets: [{ wellId: 'well-101', selection: 'intervals', intervalIds: ['int-101'] }],
    })
    expect(inspectRequestDraft(chosen, catalog).ok).toBe(true)
    expect(inspectResearchChoice({ researchId: 'work-porosity', desiredResult: '', mode: 'send' }).ok).toBe(true)

    const described = exampleStudy()
    described.needs[0] = porosityNeed({
      desiredResult: 'Определить фильтрационно-ёмкостные свойства керна',
      targets: [{ wellId: 'well-102', selection: 'well', intervalIds: [] }],
    })
    expect(inspectRequestDraft(described, catalog).ok).toBe(true)
    expect(inspectResearchChoice({ researchId: '', desiredResult: described.needs[0].desiredResult, mode: 'send' }).ok).toBe(true)
    expect(inspectResearchChoice({ researchId: '', desiredResult: '', mode: 'draft' }).ok).toBe(true)
    expect(inspectResearchChoice({ researchId: '', desiredResult: '', mode: 'send' })).toEqual({ ok: false, code: 'missing_result' })

    const uncounted = exampleStudy()
    expect(uncounted.needs[0]?.quantity).toBeNull()
    expect(inspectRequestDraft(uncounted, catalog).ok).toBe(true)
    expect(inspectPlannedQuantity(null, '', catalog.units).ok).toBe(true)
    expect(inspectPlannedQuantity(4, 'unit-sample', catalog.units)).toEqual({ ok: true, quantity: 4, unitId: 'unit-sample' })
    expect(inspectPlannedQuantity(4, '', catalog.units)).toEqual({ ok: false, code: 'invalid_quantity' })
    expect(inspectPlannedQuantity(0, 'unit-sample', catalog.units).ok).toBe(false)
    expect(inspectPlannedQuantity(-2, 'unit-sample', catalog.units).ok).toBe(false)
    const counted = exampleStudy()
    counted.needs[0] = porosityNeed({
      ...counted.needs[0],
      quantity: 4,
      unitId: 'unit-sample',
    })
    expect(inspectRequestDraft(counted, catalog).ok).toBe(true)
    const bare = exampleStudy()
    bare.needs[0] = porosityNeed({ ...bare.needs[0], quantity: 4, unitId: '' })
    const rejected = inspectRequestDraft(bare, catalog)
    expect(rejected.ok).toBe(false)
    if (!rejected.ok) expect(rejected.issues.some((issue) => issue.code === 'invalid_quantity')).toBe(true)

    const send = inspectRequestForSend({
      customerOrganizationId: 201,
      executorOrganizationId: 101,
      details: described,
      hasBasisDocument: true,
    })
    expect(send.ok).toBe(true)
    const missingResult = exampleStudy()
    missingResult.needs[0] = porosityNeed({
      targets: [{ wellId: 'well-102', selection: 'well', intervalIds: [] }],
    })
    const gap = inspectRequestForSend({ customerOrganizationId: 201, executorOrganizationId: 101, details: missingResult })
    expect(gap.ok).toBe(false)
    if (!gap.ok) expect(gap.gaps).toContain('desired_result')
  })

  it('reports needs that use a well or interval and drops those links on removal', () => {
    const details = exampleStudy()
    expect(describeWellRemoval(details.needs, 'well-101').needIds).toEqual(['need-porosity'])
    expect(describeIntervalRemoval(details.needs, 'int-101').needIds).toEqual(['need-porosity'])
    expect(describeIntervalRemoval(details.needs, 'missing').needIds).toEqual([])
    const removedWell = withoutRequestWell(details, 'well-101')
    expect(findWellById(removedWell.fields, 'well-101')).toBeNull()
    expect(removedWell.needs[0]?.targets.map((target) => target.wellId)).toEqual(['well-102', 'well-205'])
    expect(inspectNeedLinks(removedWell.fields, removedWell.needs)).toEqual([])
    const dangling = exampleStudy()
    dangling.fields = dangling.fields.map((field) => ({
      ...field,
      wells: field.wells.filter((well) => well.id !== 'well-101'),
    }))
    expect(inspectNeedLinks(dangling.fields, dangling.needs).some((issue) => issue.code === 'missing_well')).toBe(true)
    expect(inspectRequestDraft(dangling, catalog).ok).toBe(false)

    const removedInterval = withoutRequestInterval(exampleStudy(), 'int-101')
    expect(removedInterval.needs[0]?.targets.map((target) => target.wellId)).toEqual(['well-102', 'well-205'])
    expect(removedInterval.needs[0]?.targets.some((target) => target.selection === 'well' && target.wellId === 'well-101')).toBe(false)
    const other = exampleStudy()
    const well = other.fields[0]?.wells[0]
    if (!well) throw new Error('missing well')
    well.intervals.push({ id: 'int-101-b', from: 1300, to: 1310, unit: 'm' })
    other.needs[0]?.targets.splice(0, 1, {
      wellId: 'well-101',
      selection: 'intervals',
      intervalIds: ['int-101', 'int-101-b'],
    })
    const kept = withoutRequestInterval(other, 'int-101')
    expect(kept.needs[0]?.targets[0]).toEqual({
      wellId: 'well-101',
      selection: 'intervals',
      intervalIds: ['int-101-b'],
    })
  })

  it('opens an old draft once, keeps its values, and does not invent a second copy', () => {
    const legacy = {
      projectName: 'Северное',
      contractNumber: 'Д-1',
      contractDate: '',
      contractUntil: '',
      workBasis: 'Договор',
      comment: '',
      plannedCompletion: '',
      subject: {
        objectKind: 'core',
        fieldId: 'field-north',
        wellId: 'well-12',
        padId: 'pad-3',
        formationId: '',
        objectNumber: '1',
        materialId: '',
        deliveryDate: '',
        note: '',
        core: { diameterMm: '30', recoveryPercent: '' },
        fluid: { fluidKindId: '', sampleVolumeMl: '' },
      },
      program: [{
        id: 'line-1',
        workKindId: 'work-porosity',
        unitId: 'unit-sample',
        quantity: '2',
        curatorId: '',
        dueDate: '',
        note: 'К-1',
      }],
      sampleIds: ['sample-k104'],
    }
    const opened = draftFromRecord({ title: 'Северное', details: legacy })
    expect(opened.projectName).toBe('Северное')
    expect(opened.subject.fieldId).toBe('field-north')
    expect(opened.subject.wellId).toBe('well-12')
    expect(opened.subject.padId).toBe('pad-3')
    expect(opened.subject.core.diameterMm).toBe('30')
    expect(opened.program.map((line) => line.id)).toEqual(['line-1'])
    expect(opened.program[0]?.note).toBe('К-1')
    expect(opened.sampleIds).toEqual(['sample-k104'])
    expect(opened.fields.map((field) => field.id)).toEqual(['legacy-field'])
    expect(opened.fields[0]?.wells.map((well) => well.id)).toEqual(['legacy-well'])
    expect(opened.fields[0]?.wells[0]?.intervals).toEqual([])
    expect(opened.fields[0]?.fieldName).toBe('')
    expect(opened.needs).toHaveLength(1)
    expect(opened.needs[0]?.targets).toEqual([])
    expect(opened.needs[0]?.clarification).toBe('unlinked_program_line')
    expect(opened.needs[0]?.desiredResult).toBe('')
    expect(opened.needs[0]?.researchId).toBe('work-porosity')
    expect(opened.needs[0]?.quantity).toBe(2)
    expect(opened.needs[0]?.unitId).toBe('unit-sample')
    expect(opened.clarifications.map((item) => item.id)).toEqual(['legacy-subject', 'legacy-program'])
    expect(opened.programMeta).toEqual(emptyProgramMeta())
    expect(inspectRequestDraft(opened, catalog).ok).toBe(true)

    const again = draftFromRecord({ title: 'Северное', details: opened })
    expect(again.fields.map((field) => field.id)).toEqual(['legacy-field'])
    expect(again.fields[0]?.wells).toHaveLength(1)
    expect(again.needs.map((need) => need.id)).toEqual(opened.needs.map((need) => need.id))
    expect(again.clarifications).toEqual(opened.clarifications)
    expect(again.program).toHaveLength(1)
    expect(again.sampleIds).toEqual(['sample-k104'])
    expect(JSON.stringify(again)).toBe(JSON.stringify(opened))
  })

  it('does not treat a title-only record as a new study and does not approve the programme', () => {
    const opened = draftFromRecord({ title: 'Черновик заказчика' })
    expect(opened.projectName).toBe('Черновик заказчика')
    expect(opened.fields).toEqual([])
    expect(opened.needs).toEqual([])
    expect(opened.programMeta.approval).toBe('unspecified')
    expect(opened.programMeta.authorUserId).toBeNull()
    const claimed = emptyRequestDraft()
    claimed.projectName = 'Черновик'
    claimed.programMeta = { ...emptyProgramMeta(), preparedBy: 'customer' }
    expect(inspectRequestDraft(claimed, catalog).ok).toBe(true)
    const approved = {
      ...emptyRequestDraft(),
      programMeta: { ...emptyProgramMeta(), approval: 'approved' as const },
    }
    expect(inspectRequestDraft(approved, catalog).ok).toBe(false)
  })
})
