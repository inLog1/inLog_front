import { routes } from '../../../shared/lib/routes'

/** Fresh search for the new organization. The previous project is not carried over. */
export function createdOrganizationPersonnelPath(organizationId: number): string {
  const search = new URLSearchParams()
  search.set('org', String(organizationId))
  search.set('directoryOrg', String(organizationId))
  return `${routes.settings.organizationPersonnel(organizationId)}?${search.toString()}`
}
