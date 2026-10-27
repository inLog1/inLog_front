import { grantAllows } from '../../entities/access/model/grants'
import { sectionsMode, useGetSectionNavigationQuery, visibleOrganizationSections, type SectionNavItem } from '../../entities/section'

const mode = sectionsMode(import.meta.env.VITE_API_MODE)

/**
 * Published sections for the organization in the URL.
 * Live mode does not call the proposed endpoint.
 * A missing organization or a failed request yields an empty list, so the previous organization does not stay on screen.
 */
export function useOrganizationSectionLinks(
  organizationId: number | null,
  grants: Parameters<typeof grantAllows>[0],
  enforceGrants: boolean,
): { items: SectionNavItem[]; pending: boolean } {
  const canRead = !enforceGrants || (
    organizationId != null && grantAllows(grants, 'sections', 'read', { organizationId, projectId: null })
  )
  const skipped = mode !== 'mock' || organizationId == null || (enforceGrants && !canRead)
  const query = useGetSectionNavigationQuery(
    { organizationId: organizationId ?? 0 },
    { skip: skipped },
  )
  return {
    items: visibleOrganizationSections({
      organizationId: mode === 'mock' ? organizationId : null,
      failed: query.isError,
      items: query.isError ? null : query.currentData?.sections ?? null,
    }),
    pending: !skipped && !query.isError && query.currentData == null,
  }
}
