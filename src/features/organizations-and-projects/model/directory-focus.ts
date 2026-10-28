/**
 * The directory filter is not the workspace organization.
 * An id that is not in the allowed set is rejected and is not replaced with another organization.
 */
export function resolveDirectoryFocus(
  raw: string | null,
  allowedOrganizationIds: readonly number[],
): { status: 'all' } | { status: 'open'; organizationId: number } | { status: 'rejected' } {
  if (raw == null || raw.trim() === '') return { status: 'all' }
  if (!/^[1-9]\d*$/.test(raw.trim())) return { status: 'rejected' }
  const organizationId = Number(raw)
  if (!allowedOrganizationIds.includes(organizationId)) return { status: 'rejected' }
  return { status: 'open', organizationId }
}

export const DIRECTORY_FOCUS_PARAM = 'directoryOrg'
