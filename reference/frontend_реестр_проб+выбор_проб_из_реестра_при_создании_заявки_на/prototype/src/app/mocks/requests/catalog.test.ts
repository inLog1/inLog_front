import { describe, expect, it } from 'vitest'
import { emptyRequestDraft, inspectRequestDraft } from '../../../entities/request/model/draft'
import { emptyProgramMeta, inspectProgramForApproval, lineFromNeed } from '../../../entities/request/model/program'
import { sampleTypeOptions } from '../../../pages/app/requests/ui/draft/draft-labels'
import { SAMPLE_TYPES } from '../../../shared/lib/sample-types'
import { requestDraftCatalogIds, requestDraftOptions } from './catalog'

describe('sample types in the research program', () => {
  it('offers the registry types and retains an older saved value when selected', () => {
    const catalog = requestDraftOptions()
    expect(sampleTypeOptions(catalog.sampleKinds, '').map(item => item.label)).toEqual([...SAMPLE_TYPES])
    expect(sampleTypeOptions(catalog.sampleKinds, 'sample-kind-depth').map(item => item.id)).toContain('sample-kind-depth')
    expect(requestDraftCatalogIds().sampleKinds).toContain('sample-kind-depth')
  })
  it('accepts and preserves each sample type in an approved program line', () => {
    const draft = emptyRequestDraft()
    draft.projectName = 'Исследование проб'
    draft.fields = [{id:'field-1', catalogFieldId:'', fieldName:'Поле', wells:[{id:'well-1', catalogWellId:'', wellName:'1', intervals:[]}]}]
    draft.needs = [{id:'need-1', targets:[{wellId:'well-1', selection:'well', intervalIds:[]}], researchId:'work-porosity', desiredResult:'', sampleTypeId:'', quantity:null, unitId:'', comment:'', clarification:'', legacyLineId:''}]
    const ids = requestDraftCatalogIds()
    for (const option of sampleTypeOptions(requestDraftOptions().sampleKinds, '')) {
      draft.needs[0].sampleTypeId = option.id
      const draftResult = inspectRequestDraft(draft, ids)
      expect(draftResult.ok, JSON.stringify(draftResult)).toBe(true)
      if (draftResult.ok) expect(draftResult.details.needs[0].sampleTypeId).toBe(option.id)
      const line = {...lineFromNeed(draft.needs[0]), sampleTypeId:option.id}
      const result = inspectProgramForApproval({fields:draft.fields, needs:draft.needs, meta:{...emptyProgramMeta(), preparedBy:'laboratory', lines:[line]}, catalog:{workKinds:ids.workKinds, sampleKinds:ids.sampleKinds, units:ids.units}})
      expect(result.ok).toBe(true)
      if (result.ok) expect(result.lines[0].sampleTypeId).toBe(option.id)
    }
    draft.needs[0].sampleTypeId = 'sample-kind-depth'
    const oldDraft = inspectRequestDraft(draft, ids)
    expect(oldDraft.ok).toBe(true)
    if (oldDraft.ok) expect(oldDraft.details.needs[0].sampleTypeId).toBe('sample-kind-depth')
  })
})
