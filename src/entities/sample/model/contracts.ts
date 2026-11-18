import type { AttachmentType } from './attachments'
import type { Sample, SampleEvent } from './types'

/** Stored organization kind. The registry uses the same two values as the organization catalog. */
export type SampleOrganizationKind = 'laboratory' | 'customer'

export type SampleDocumentView = {
  id: string
  organizationId: number
  sampleIds: string[]
  type: AttachmentType
  filename: string
  mimeType: string
  size: number
  documentNumber: string
  documentDate: string
  uploadedAt: string
  uploadedBy: string
}

export type SampleListResponse = {
  samples: Sample[]
  organizationKind: SampleOrganizationKind
}

export type SampleResponse = {
  sample: Sample
}

export type SampleHistoryResponse = {
  events: SampleEvent[]
}

export type SampleDocumentsResponse = {
  documents: SampleDocumentView[]
}

export type SampleBatchResponse = {
  samples: Sample[]
}

export type RegisterSampleInput = {
  organizationId: number
  sampleType: string
  field: string
  well: string
  formation?: string
  interval?: string
  collectedAt?: string
  receivedAt?: string
  location?: string
  stage?: string
  inspection?: string
  inspectionNote?: string
  material?: string
  container?: string
  quantity?: string
  supplier?: string
  document?: string
  conditions?: string
  externalCode?: string
}

export type RegisterSubsampleInput = {
  organizationId: number
  parentId: string
  receivedAt?: string
  location?: string
  stage?: string
  inspection?: string
  inspectionNote?: string
  subsampleInterval?: string
  material?: string
  container?: string
  quantity?: string
  supplier?: string
  document?: string
  conditions?: string
  externalCode?: string
  sampleType?: string
  field?: string
  well?: string
  formation?: string
  interval?: string
  collectedAt?: string
}

export type RegisterSampleBatchInput = {
  organizationId: number
  csv: string
}

export type ChangeSampleStatusInput = {
  organizationId: number
  sampleId: string
  stage: string
  location?: string
  receivedAt?: string
}

export type ChangeSampleInspectionInput = {
  organizationId: number
  sampleId: string
  inspection: string
  inspectionNote: string
}

export type ChangeSamplePlaceInput = {
  organizationId: number
  sampleId: string
  location: string
  receivedAt: string
}

export type SampleFileInput = {
  filename: string
  mimeType: string
  bytes: Uint8Array
}

export type AddSampleDocumentsInput = {
  organizationId: number
  sampleIds: string[]
  type: string
  documentNumber?: string
  documentDate?: string
  files: SampleFileInput[]
}

export type SampleDocumentLinkInput = {
  organizationId: number
  sampleId: string
  fileId: string
}
