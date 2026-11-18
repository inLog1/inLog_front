import { useCallback, useEffect, useRef, useState } from 'react'
import { ensureMockState } from '../../../../app/mocks/db/repository'
import { useHasOrganizationGrant } from '../../../../features/org-project-selector/model/useWorkspaceSection'
import { documentMockNamespace, documentScenario } from '../../../../shared/config/mock-scenario'
import { initialSamples, SAMPLE_TYPES, withDetailedDemoSamples, type Sample } from '../../samples/model'
import { getRequestSampleFields, REQUEST_SAMPLE_FIELDS, type RequestSampleField } from '../../samples/requestFields'
import type { RequestListItem } from '../../../../entities/request'

export type RequestSampleRegistry = { records:Sample[]; fields:RequestSampleField[]; available:boolean; loading:boolean; failed:boolean; organizationId:number | null; refresh:()=>void }

export function useRequestSamples(organizationId: number | null): RequestSampleRegistry {
  const access = useHasOrganizationGrant('requests', 'read', organizationId)
  const [data, setData] = useState<{organizationId:number; records:Sample[]; fields:RequestSampleField[]} | null>(null)
  const [failed, setFailed] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const generation = useRef(0)
  const refresh = useCallback(() => {
    const current = ++generation.current
    if (organizationId == null || !access || import.meta.env.VITE_API_MODE !== 'mock') { setRefreshing(false); return }
    setRefreshing(true); setFailed(false)
    void ensureMockState(documentMockNamespace()).then(result => {
      if (current !== generation.current) return
      if (!result.ok) { setFailed(true); return }
      const demo = documentScenario() === 'demo'
      const records = withDetailedDemoSamples(result.state.samples ?? initialSamples(demo), demo).filter(sample => sample.organizationId === organizationId)
      setData({organizationId, records, fields:getRequestSampleFields(result.state, organizationId)})
    }).catch(() => { if (current === generation.current) setFailed(true) })
      .finally(() => { if (current === generation.current) setRefreshing(false) })
  }, [organizationId, access])
  useEffect(() => {
    let active = true
    const generationRef = generation
    queueMicrotask(() => { if (active) refresh() })
    return () => { active = false; generationRef.current++ }
  }, [refresh])
  const scoped = access && data?.organizationId === organizationId ? data : null
  return {records:scoped?.records ?? [], fields:scoped?.fields ?? [], available:access && import.meta.env.VITE_API_MODE === 'mock', loading:refreshing || (access && organizationId != null && scoped === null && !failed), failed, organizationId, refresh}
}

/** Show only registries the current user can read; selected links remain intact across parties. */
export function useRequestPartySamples(customerId: number, executorId: number, linked: RequestListItem['linkedSamples'] = []): RequestSampleRegistry {
  const customer = useRequestSamples(customerId)
  const executor = useRequestSamples(executorId === customerId ? null : executorId)
  const sources = [customer, executor].filter(source => source.available)
  const sharedFields = REQUEST_SAMPLE_FIELDS.map(field => field.key).filter(field => linked.some(sample => field in sample.values))
  const fields = [...new Set([...sources.flatMap(source => source.fields), ...sharedFields])]
  const visibleIds = new Set(sources.flatMap(source => source.records.map(sample => sample.id)))
  const sharedRecords: Sample[] = linked.filter(item => !visibleIds.has(item.id)).map(({id, parentId, linkedAncestorIds, values, deleted}) => ({
    id, organizationId:customerId, code:values.code ?? '', kind:values.sampleType === 'Керн' ? 'Керн' : 'Флюид',
    parentId, parentCode:values.parentCode, linkedAncestorIds,
    sampleType: SAMPLE_TYPES.find(type => type === values.sampleType), material:values.sampleType ?? '',
    field:values.field ?? '', well:values.well ?? '', formation:values.formation ?? '', interval:values.interval ?? '',
    collectedAt:values.collectedAt ?? '', receivedAt:values.receivedAt ?? '', container:values.container ?? '',
    quantity:values.quantity ?? '', supplier:values.supplier ?? '', document:values.document ?? '', conditions:values.conditions ?? '',
    location:values.location ?? '', externalCode:values.externalCode, inspection:(values.inspection as Sample['inspection']) || 'Не проведён',
    inspectionNote:values.inspectionNote ?? '', stage:values.stage as Sample['stage'], events:[], ...(deleted ? {deletedAt:'1'} : {}),
  }))
  return {
    records: [...sources.flatMap(source => source.records), ...sharedRecords], fields,
    available: sources.length > 0, loading: sources.some(source => source.loading),
    failed: sources.length > 0 && sources.every(source => source.failed), organizationId: customerId,
    refresh: () => { customer.refresh(); executor.refresh() },
  }
}

