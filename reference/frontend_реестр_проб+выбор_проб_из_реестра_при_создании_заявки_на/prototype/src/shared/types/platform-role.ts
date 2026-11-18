export type PlatformRole = 'member' | 'admin' | 'super_admin'

export const PLATFORM_ADMIN_ROLES: PlatformRole[] = ['admin', 'super_admin']

/** Roles that super admin can assign via the admin UI / API */
export const ASSIGNABLE_PLATFORM_ROLES: PlatformRole[] = ['member', 'admin']

export function isPlatformAdmin(role?: string | null): role is PlatformRole {
  return role === 'admin' || role === 'super_admin'
}

export function isSuperAdmin(role?: string | null): boolean {
  return role === 'super_admin'
}

export function isAssignablePlatformRole(role: string): role is PlatformRole {
  return ASSIGNABLE_PLATFORM_ROLES.includes(role as PlatformRole)
}
