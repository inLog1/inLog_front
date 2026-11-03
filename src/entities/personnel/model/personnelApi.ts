import { platformApi } from '../../../shared/api/platformApi'
import { parseCorporateOverview, type CorporateOverview } from './overview'
import type {
  DirectoryCatalogSection,
  DirectoryDefinition,
  DirectoryField,
  DirectoryPermissions,
  DirectorySource,
  PersonnelConfig,
  PersonnelField,
  PersonnelPermissions,
  PersonnelTab,
  PersonnelValue,
  ReferenceOption,
} from './types'

export type DirectoryOptions = {
  directoryId: string
  title: string
  archived: boolean
  canAdd: boolean
  source: DirectorySource
  fields: DirectoryField[]
  records: ReferenceOption[]
}

export type PersonnelConfigResponse = {
  initialized: boolean
  canInitialize: boolean
  config?: PersonnelConfig
  options?: Record<string, DirectoryOptions>
  permissions?: PersonnelPermissions
}

export type EmployeeCard = {
  id: string
  organizationId: number
  revision: number
  archived: boolean
  source: 'manual' | 'integration'
  sourceId: string | null
  externalId: string | null
  accountVisible: boolean
  account: { id: number; email: string; name: string } | null
  roles: { id: string; displayName: string; assignmentId: string }[] | null
  values: Record<string, PersonnelValue>
  references: Record<string, ReferenceOption>
  permissions: PersonnelPermissions
}

export type EmployeeListSummary = {
  name: string
  email: string
  personnelNumber: string
  position: string
  positionId: string
  department: string
  departmentId: string
  qualification: string
  qualificationId: string
  certificationUntil: string
}

export type EmployeeListResponse = {
  initialized: boolean
  columns: string[]
  fields: PersonnelField[]
  employees: {
    id: string
    revision: number
    archived: boolean
    cells: Record<string, string>
    marks: Record<string, 'archived' | 'missing' | null>
    summary: EmployeeListSummary
  }[]
  permissions: PersonnelPermissions
}

export type DirectoryView = DirectoryDefinition & {
  permissions: DirectoryPermissions
}

export type DirectoryListResponse = {
  initialized: boolean
  canInitialize: boolean
  permissions: DirectoryPermissions
  directories: DirectoryView[]
}

export type DirectoryRecord = {
  id: string
  revision: number
  archived: boolean
  label: string
  name?: string
  code?: string
  parentId?: string | null
  parentLabel?: string | null
  departmentId?: string | null
  departmentLabel?: string | null
  values?: Record<string, string>
}

export type DirectoryDetailResponse = {
  directory: DirectoryView
  records: DirectoryRecord[]
  usedFieldIds: string[]
  permissions: DirectoryPermissions
}

export type ConfigWrite = {
  organizationId: number
  expectedRevision: number
  tabs: Pick<PersonnelTab, 'id' | 'label' | 'order'>[]
  fields: Pick<PersonnelField, 'id' | 'label' | 'tabId' | 'group' | 'type' | 'directoryKey' | 'required' | 'visible' | 'archived' | 'order'>[]
  columns: string[]
}

export const CORPORATE_OVERVIEW_TAG = { type: 'Personnel' as const, id: 'overview' }

export function personnelError(error: unknown): { code: string; fieldId?: string } {
  if (!error || typeof error !== 'object' || !('data' in error)) return { code: 'generic' }
  const data = (error as { data?: { code?: unknown; fieldId?: unknown } }).data
  return {
    code: typeof data?.code === 'string' ? data.code : 'generic',
    fieldId: typeof data?.fieldId === 'string' ? data.fieldId : undefined,
  }
}

export const personnelApi = platformApi.injectEndpoints({
  endpoints: (build) => ({
    getDirectories: build.query<DirectoryListResponse, { organizationId: number }>({
      query: ({ organizationId }) => `directories/?organization=${organizationId}`,
      providesTags: (_result, _error, arg) => [{ type: 'Directories', id: `org-${arg.organizationId}` }],
    }),
    getDirectory: build.query<DirectoryDetailResponse, { organizationId: number; directoryId: string }>({
      query: ({ organizationId, directoryId }) => `directories/${directoryId}/?organization=${organizationId}`,
      providesTags: (_result, _error, arg) => [{ type: 'Directories', id: arg.directoryId }],
    }),
    createDirectoryDefinition: build.mutation<
      DirectoryDefinition,
      { organizationId: number; title: string; description?: string; section?: DirectoryCatalogSection }
    >({
      query: ({ organizationId, title, description, section }) => ({
        url: 'directories/',
        method: 'POST',
        body: { organizationId, title, description: description ?? '', section: section ?? 'other' },
      }),
      invalidatesTags: (_result, _error, arg) => [{ type: 'Directories', id: `org-${arg.organizationId}` }],
    }),
    createDirectoryRecord: build.mutation<DirectoryRecord, { directoryId: string; body: Record<string, unknown> }>({
      query: ({ directoryId, body }) => ({ url: `directories/${directoryId}/records/`, method: 'POST', body }),
      invalidatesTags: [{ type: 'Directories' }, { type: 'Personnel' }],
    }),
    updateDirectoryRecord: build.mutation<DirectoryRecord, { directoryId: string; recordId: string; body: Record<string, unknown> }>({
      query: ({ directoryId, recordId, body }) => ({ url: `directories/${directoryId}/records/${recordId}/`, method: 'PATCH', body }),
      invalidatesTags: [{ type: 'Directories' }, { type: 'Personnel' }],
    }),
    archiveDirectoryRecord: build.mutation<DirectoryRecord, { directoryId: string; recordId: string; body: Record<string, unknown> }>({
      query: ({ directoryId, recordId, body }) => ({ url: `directories/${directoryId}/records/${recordId}/archive/`, method: 'POST', body }),
      invalidatesTags: [{ type: 'Directories' }, { type: 'Personnel' }],
    }),
    deleteDirectoryRecord: build.mutation<{ id: string }, { organizationId: number; directoryId: string; recordId: string; expectedRevision: number }>({
      query: ({ organizationId, directoryId, recordId, expectedRevision }) => ({
        url: `directories/${directoryId}/records/${recordId}/?organization=${organizationId}&expectedRevision=${expectedRevision}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, arg) => [{ type: 'Directories', id: arg.directoryId }],
    }),
    updateDirectoryDefinition: build.mutation<DirectoryDefinition, { directoryId: string; body: Record<string, unknown> }>({
      query: ({ directoryId, body }) => ({ url: `directories/${directoryId}/`, method: 'PATCH', body }),
      invalidatesTags: [
        { type: 'Directories' },
        { type: 'Personnel' },
      ],
    }),
    deleteDirectoryDefinition: build.mutation<
      { id: string },
      { organizationId: number; directoryId: string; expectedRevision: number }
    >({
      query: ({ organizationId, directoryId, expectedRevision }) => ({
        url: `directories/${directoryId}/?organization=${organizationId}&expectedRevision=${expectedRevision}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, arg) => [
        { type: 'Directories', id: `org-${arg.organizationId}` },
        { type: 'Directories', id: arg.directoryId },
        { type: 'Personnel' },
      ],
    }),
    initializePersonnelWorkspace: build.mutation<{ initialized: boolean }, { organizationId: number }>({
      query: (body) => ({ url: 'personnel/workspace/', method: 'POST', body }),
      invalidatesTags: [{ type: 'Personnel' }, { type: 'Directories' }],
    }),
    getPersonnelConfig: build.query<PersonnelConfigResponse, { organizationId: number }>({
      query: ({ organizationId }) => `personnel/config/?organization=${organizationId}`,
      providesTags: [{ type: 'Personnel', id: 'config' }],
    }),
    updatePersonnelConfig: build.mutation<PersonnelConfigResponse, ConfigWrite>({
      query: (body) => ({ url: 'personnel/config/', method: 'PUT', body }),
      invalidatesTags: [{ type: 'Personnel', id: 'config' }, { type: 'Personnel', id: 'list' }],
    }),
    getEmployees: build.query<EmployeeListResponse, { organizationId: number; archived: boolean; q: string }>({
      query: ({ organizationId, archived, q }) => {
        const params = new URLSearchParams({ organization: String(organizationId), archived: archived ? '1' : '0' })
        if (q.trim()) params.set('q', q.trim())
        return `personnel/employees/?${params.toString()}`
      },
      providesTags: [{ type: 'Personnel', id: 'list' }],
    }),
    getEmployee: build.query<{ employee: EmployeeCard; config: PersonnelConfig; options: Record<string, DirectoryOptions> }, { organizationId: number; employeeId: string }>({
      query: ({ organizationId, employeeId }) => `personnel/employees/${employeeId}/?organization=${organizationId}`,
      providesTags: (_result, _error, arg) => [{ type: 'Personnel', id: arg.employeeId }],
    }),
    createEmployee: build.mutation<{ employee: EmployeeCard }, { organizationId: number; values: Record<string, PersonnelValue> }>({
      query: (body) => ({ url: 'personnel/employees/', method: 'POST', body }),
      invalidatesTags: [{ type: 'Personnel', id: 'list' }, CORPORATE_OVERVIEW_TAG],
    }),
    updateEmployee: build.mutation<{ employee: EmployeeCard }, { employeeId: string; organizationId: number; expectedRevision: number; values: Record<string, PersonnelValue> }>({
      query: ({ employeeId, ...body }) => ({ url: `personnel/employees/${employeeId}/`, method: 'PUT', body }),
      invalidatesTags: (_result, _error, arg) => [{ type: 'Personnel', id: arg.employeeId }, { type: 'Personnel', id: 'list' }, CORPORATE_OVERVIEW_TAG],
    }),
    archiveEmployee: build.mutation<{ employee: EmployeeCard }, { employeeId: string; organizationId: number; expectedRevision: number; archived: boolean }>({
      query: ({ employeeId, ...body }) => ({ url: `personnel/employees/${employeeId}/archive/`, method: 'POST', body }),
      invalidatesTags: (_result, _error, arg) => [{ type: 'Personnel', id: arg.employeeId }, { type: 'Personnel', id: 'list' }, CORPORATE_OVERVIEW_TAG],
    }),
    linkEmployeeAccount: build.mutation<{ employee: EmployeeCard }, { employeeId: string; organizationId: number; expectedRevision: number; accountId: number | null }>({
      query: ({ employeeId, ...body }) => ({ url: `personnel/employees/${employeeId}/account/`, method: 'POST', body }),
      invalidatesTags: (_result, _error, arg) => [{ type: 'Personnel', id: arg.employeeId }, { type: 'Personnel', id: 'list' }, CORPORATE_OVERVIEW_TAG],
    }),
    getCorporateOverview: build.query<CorporateOverview, void>({
      query: () => 'personnel/overview/',
      transformResponse: (response: unknown) => parseCorporateOverview(response),
      providesTags: [CORPORATE_OVERVIEW_TAG],
    }),
    getLinkableAccounts: build.query<{ accounts: { id: number; email: string; name: string }[] }, { organizationId: number }>({
      query: ({ organizationId }) => `personnel/accounts/?organization=${organizationId}`,
    }),
  }),
})

export const {
  useGetDirectoriesQuery,
  useGetDirectoryQuery,
  useCreateDirectoryDefinitionMutation,
  useCreateDirectoryRecordMutation,
  useUpdateDirectoryRecordMutation,
  useArchiveDirectoryRecordMutation,
  useDeleteDirectoryRecordMutation,
  useDeleteDirectoryDefinitionMutation,
  useUpdateDirectoryDefinitionMutation,
  useInitializePersonnelWorkspaceMutation,
  useGetPersonnelConfigQuery,
  useUpdatePersonnelConfigMutation,
  useGetEmployeesQuery,
  useGetEmployeeQuery,
  useCreateEmployeeMutation,
  useUpdateEmployeeMutation,
  useArchiveEmployeeMutation,
  useLinkEmployeeAccountMutation,
  useGetLinkableAccountsQuery,
  useGetCorporateOverviewQuery,
} = personnelApi
