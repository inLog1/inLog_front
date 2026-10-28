import { adminApi } from '../../entities/admin/model/adminSlice'
import { organizationApi } from '../../entities/organization/model/organizationSlice'
import { projectApi } from '../../entities/project/model/projectSlice'
import { taskApi } from '../../entities/task/model/taskSlice'
import { platformApi } from '../../shared/api/platformApi'

/**
 * Drops cached work that was loaded under an older access version.
 * Forms, table views and sections are included with the older task and constructor caches.
 * This is not a push channel: another tab learns the new version on its next session read.
 */
export function invalidateAfterAccessVersion(dispatch: (action: unknown) => void) {
  dispatch(organizationApi.util.invalidateTags(['Organization']))
  dispatch(projectApi.util.invalidateTags(['Project']))
  dispatch(taskApi.util.invalidateTags(['Tasks', 'Task']))
  dispatch(adminApi.util.invalidateTags(['Nodes', 'Node', 'NodeTabs', 'NodeGroups']))
  dispatch(platformApi.util.invalidateTags(['Forms', 'TableViews', 'Sections', 'AccessControl']))
}
