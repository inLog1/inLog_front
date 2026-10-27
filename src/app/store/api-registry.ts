import { authApi } from '../../features/auth/model/authSlice'
import { userApi } from '../../entities/user/model/userSlice'
import { organizationApi } from '../../entities/organization/model/organizationSlice'
import { projectApi } from '../../entities/project/model/projectSlice'
import { taskApi } from '../../entities/task/model/taskSlice'
import { adminApi } from '../../entities/admin/model/adminSlice'
import { platformAdminApi } from '../../entities/platform-admin/model/platformAdminSlice'
import { notificationApi } from '../../entities/notification/model/notificationSlice'
import { platformApi } from '../../shared/api/platformApi'

export const registeredApis = [
  authApi,
  userApi,
  organizationApi,
  projectApi,
  taskApi,
  adminApi,
  platformAdminApi,
  notificationApi,
  platformApi,
] as const

export function resetAllApiCaches(dispatch: (action: unknown) => void) {
  for (const api of registeredApis) {
    dispatch(api.util.resetApiState())
  }
}
