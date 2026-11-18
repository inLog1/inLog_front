import type { PlatformRole } from '../../../shared/types/platform-role'

export interface AdminAccess {
  role: PlatformRole
  is_platform_admin: boolean
  is_super_admin: boolean
  permissions: string[]
}

export interface AdminUser {
  id: number
  email: string
  role: PlatformRole | string
  full_name: string
  name: string
  surname: string
  is_active: boolean
  is_email_verified: boolean
  created_at: string
}

export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface AdminMember {
  id: number
  membership_type: 'project' | 'organization'
  role: string
  belonging?: string
  organization_id: number
  organization_name: string
  project_id?: number | null
  project_name?: string | null
  user: AdminUserBrief
  created_at: string
}

export interface UpdateAdminOrganizationBody {
  full_name?: string
  short_name?: string
  address?: string
  inn?: string | null
  kpp?: string | null
}

export interface UpdateAdminProjectBody {
  name?: string
  organization_id?: number
  reservoir?: string
  company_customer?: string
  contractor?: string
  country?: string
}

export interface AdminOrganization {
  id: number
  full_name: string
  short_name: string
  address: string
  inn: string | null
  kpp: string | null
  created_at: string
  members_count: number
  projects_count: number
}

export interface AdminProject {
  id: number
  name: string
  organization_id: number
  organization_name: string
  reservoir: string
  company_customer: string
  contractor: string
  country: string
  created_at: string
  members_count: number
}

export interface AdminUserBrief {
  id: number
  email: string
  full_name?: string
  name?: string
  surname?: string
  avatar?: {
    small?: string
    medium?: string
  }
}

export interface AdminTaskDoer {
  id: number
  user?: AdminUserBrief
}

export interface AdminTask {
  id: number
  name: string
  slug: string
  project_id: number
  project_name: string
  organization_id?: number
  organization_name?: string
  creator_id: number
  creator_email: string
  creator_name?: string
  creator?: AdminUserBrief
  doers?: AdminTaskDoer[]
  members?: AdminUserBrief[]
  status_id: number
  status_name_en: string
  status_name_ru: string
  priority: string
  archived: boolean
  is_template: boolean
  parent_id: number | null
  created_at: string
}

export interface AdminTaskStatus {
  id: number
  project_id: number
  project_name: string
  name_en: string
  name_ru: string
  position: number
  created_at: string
}

export interface AdminTaskTag {
  id: number
  project_id: number
  project_name: string
  name: string
  is_systemic: boolean
  is_orphan: boolean
  created_at: string
}
