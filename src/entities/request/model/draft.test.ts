import { describe, expect, it } from 'vitest'
import { draftFromRecord, emptyRequestDraft, inspectRequestDraft, inspectRequestForSend, type RequestDraftCatalogIds } from './draft'

const catalog: RequestDraftCatalogIds = {
  fields: ['field-north'],
  wells: ['well-12'],
  pads: [],
  formations: [],
  materials: ['material-sandstone'],
  fluidKinds: ['fluid-oil'],
  wellTypes: ['well-type-production'],
  sampleKinds: ['sample-kind-depth'],
  workKinds: ['work-porosity'],
  units: ['unit-sample'],
  curators: ['curator-petrova'],
  samples: ['sample-k104'],
}

describe('request draft details', () => {
  it('accepts an empty draft and keeps a title-only record readable', () => {
    const empty = inspectRequestDraft(emptyRequestDraft(), catalog)
    expect(empty.ok).toBe(true)
    const opened = draftFromRecord({ title: 'Черновик заказчика' })
    expect(opened.projectName).toBe('Черновик заказчика')
    expect(opened.program).toEqual([])
    expect(opened.sampleIds).toEqual([])
    expect(inspectRequestDraft(opened, catalog).ok).toBe(true)
  })

  it('rejects a bad quantity, an unknown sample and a reversed contract', () => {
    const quantity = emptyRequestDraft()
    quantity.program = [{
      id: 'line-1',
      workKindId: 'work-porosity',
      unitId: 'unit-sample',
      quantity: '0',
      demand: '',
      curatorId: '',
      dueDate: '',
      code: '',
      note: '',
    }]
    const rejected = inspectRequestDraft(quantity, catalog)
    expect(rejected.ok).toBe(false)
    if (!rejected.ok) expect(rejected.issues.some((item) => item.code === 'invalid_quantity')).toBe(true)

    const sample = emptyRequestDraft()
    sample.sampleIds = ['missing']
    const unknown = inspectRequestDraft(sample, catalog)
    expect(unknown.ok).toBe(false)

    const dates = emptyRequestDraft()
    dates.contractDate = '2026-12-02'
    dates.contractUntil = '2026-12-01'
    const range = inspectRequestDraft(dates, catalog)
    expect(range.ok).toBe(false)
    if (!range.ok) expect(range.issues.some((item) => item.code === 'invalid_contract_range')).toBe(true)
  })

  it('keeps core and fluid fields and refuses an unknown key', () => {
    const details = emptyRequestDraft()
    details.subject.objectKind = 'fluid'
    details.subject.fluid.fluidKindId = 'fluid-oil'
    details.subject.fluid.sampleVolumeMl = '12.5'
    details.subject.core.diameterMm = '30'
    const parsed = inspectRequestDraft(details, catalog)
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.details.subject.fluid.sampleVolumeMl).toBe('12.5')
      expect(parsed.details.subject.core.diameterMm).toBe('30')
    }
    const extra = { ...emptyRequestDraft(), unexpected: true }
    expect(inspectRequestDraft(extra, catalog).ok).toBe(false)
  })

  it('reads a saved draft that has none of the newer fields', () => {
    const legacy = {
      projectName: 'Северное',
      contractNumber: '',
      contractDate: '',
      contractUntil: '',
      workBasis: '',
      comment: '',
      plannedCompletion: '',
      subject: {
        objectKind: 'core',
        fieldId: 'field-north',
        wellId: '',
        padId: '',
        formationId: '',
        objectNumber: '',
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
    const parsed = inspectRequestDraft(legacy, catalog)
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.details.subsoilUser).toBe('')
      expect(parsed.details.priority).toBe('')
      expect(parsed.details.corePlan.totalRecovery).toBe('')
      expect(parsed.details.program[0]?.demand).toBe('')
      expect(parsed.details.program[0]?.code).toBe('')
    }
    const opened = draftFromRecord({ title: 'Северное', details: legacy })
    expect(opened.subject.core.diameterMm).toBe('30')
    expect(opened.program[0]?.code).toBe('К-1')
    expect(inspectRequestDraft(opened, catalog).ok).toBe(true)
  })

  it('keeps entered core figures consistent and allows an unfinished plan', () => {
    const plan = emptyRequestDraft()
    plan.corePlan = { ...plan.corePlan, totalRecovery: '10', consolidated: '4', unconsolidated: '6' }
    expect(inspectRequestDraft(plan, catalog).ok).toBe(true)

    plan.corePlan = { ...plan.corePlan, totalRecovery: '12', consolidated: '10', unconsolidated: '5' }
    const over = inspectRequestDraft(plan, catalog)
    expect(over.ok).toBe(false)
    if (!over.ok) expect(over.issues.some((item) => item.code === 'inconsistent_core')).toBe(true)

    plan.corePlan = { ...plan.corePlan, totalRecovery: '20', consolidated: '5', unconsolidated: '4', jurassic: '8' }
    const jurassic = inspectRequestDraft(plan, catalog)
    expect(jurassic.ok).toBe(false)

    plan.corePlan = { ...plan.corePlan, jurassic: '', totalRecovery: '-1' }
    const negative = inspectRequestDraft(plan, catalog)
    expect(negative.ok).toBe(false)
    if (!negative.ok) expect(negative.issues.some((item) => item.code === 'invalid_number')).toBe(true)
  })

  it('reports what a future send still needs without rejecting an empty draft', () => {
    const empty = emptyRequestDraft()
    expect(inspectRequestDraft(empty, catalog).ok).toBe(true)
    const missing = inspectRequestForSend({ customerOrganizationId: null, executorOrganizationId: null, details: empty })
    expect(missing.ok).toBe(false)
    if (!missing.ok) {
      expect(missing.gaps).toContain('parties')
      expect(missing.gaps).toContain('project_name')
      expect(missing.gaps).toContain('basis_document')
      expect(missing.gaps).toContain('program')
    }
    const ready = emptyRequestDraft()
    ready.projectName = 'Северное'
    ready.contractNumber = 'Д-14'
    ready.priority = 'medium'
    ready.subject.objectKind = 'core'
    ready.subject.fieldId = 'field-north'
    ready.subject.wellId = 'well-12'
    ready.program = [{
      id: 'line-1',
      workKindId: 'work-porosity',
      unitId: 'unit-sample',
      quantity: '2',
      demand: '1',
      curatorId: '',
      dueDate: '',
      code: '',
      note: '',
    }]
    ready.fields = [{
      id: 'field-1',
      catalogFieldId: 'field-north',
      fieldName: '',
      wells: [{ id: 'well-1', catalogWellId: 'well-12', wellName: '', intervals: [] }],
    }]
    ready.needs = [{
      id: 'need-1',
      researchId: 'work-porosity',
      desiredResult: '',
      sampleTypeId: '',
      quantity: null,
      unitId: '',
      comment: '',
      clarification: '',
      legacyLineId: '',
      targets: [{ wellId: 'well-1', selection: 'well', intervalIds: [] }],
    }]
    const complete = inspectRequestForSend({
      customerOrganizationId: 201,
      executorOrganizationId: 101,
      details: ready,
      hasBasisDocument: true,
    })
    expect(complete.ok).toBe(true)
    expect(ready.plannedCompletion).toBe('')
  })

  it('keeps the four priorities and still reads an older priority without remapping it', () => {
    const next = emptyRequestDraft()
    next.priority = 'medium'
    const parsed = inspectRequestDraft(next, catalog)
    expect(parsed.ok).toBe(true)
    if (parsed.ok) expect(parsed.details.priority).toBe('medium')

    const legacy = emptyRequestDraft()
    legacy.priority = 'urgent'
    const kept = inspectRequestDraft(legacy, catalog)
    expect(kept.ok).toBe(true)
    if (kept.ok) expect(kept.details.priority).toBe('urgent')

    const opened = draftFromRecord({
      title: 'Северное',
      details: { ...emptyRequestDraft(), priority: 'normal' },
    })
    expect(opened.priority).toBe('normal')
    expect(inspectRequestDraft({ ...opened, priority: 'soon' }, catalog).ok).toBe(false)
  })
})
