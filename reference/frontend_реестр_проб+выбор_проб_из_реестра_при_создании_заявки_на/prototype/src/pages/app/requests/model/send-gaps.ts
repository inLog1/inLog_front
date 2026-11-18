import type { SendGap } from '../../../../entities/request'

export type SendGapFocus = {
  sectionId?: string
  field?: string
}

/** Maps a send readiness gap to a form section or field for scroll and focus. */
export function sendGapFocus(gap: SendGap): SendGapFocus {
  switch (gap) {
    case 'parties':
      return { field: 'executorOrganizationId' }
    case 'project_name':
      return { field: 'projectName' }
    case 'basis_document':
      return { sectionId: 'request-basis', field: 'basisDocument' }
    case 'well':
      return { sectionId: 'request-objects', field: 'fields' }
    case 'program':
    case 'desired_result':
    case 'need_targets':
    case 'quantity':
    case 'need_links':
      return { sectionId: 'request-program', field: 'needs' }
    default:
      return { field: 'projectName' }
  }
}
