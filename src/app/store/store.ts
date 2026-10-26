import { configureStore } from '@reduxjs/toolkit'
import { sessionReducer } from '../../entities/session'
import { authApi } from '../../features/auth/model/authSlice'
import { userApi } from '../../entities/user/model/userSlice'
import { organizationApi } from '../../entities/organization/model/organizationSlice'
import { projectApi } from '../../entities/project/model/projectSlice'
import { taskApi } from '../../entities/task/model/taskSlice'
import { adminApi } from '../../entities/admin/model/adminSlice'
import { platformAdminApi } from '../../entities/platform-admin/model/platformAdminSlice'
import { notificationApi } from '../../entities/notification/model/notificationSlice'
import { platformApi } from '../../shared/api/platformApi'
import '../../entities/access/model/accessApi'

export const store = configureStore({
  reducer: {
    session: sessionReducer,
    [authApi.reducerPath]: authApi.reducer,
    [userApi.reducerPath]: userApi.reducer,
    [organizationApi.reducerPath]: organizationApi.reducer,
    [projectApi.reducerPath]: projectApi.reducer,
    [taskApi.reducerPath]: taskApi.reducer,
    [adminApi.reducerPath]: adminApi.reducer,
    [platformAdminApi.reducerPath]: platformAdminApi.reducer,
    [notificationApi.reducerPath]: notificationApi.reducer,
    [platformApi.reducerPath]: platformApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(
      authApi.middleware,
      userApi.middleware,
      organizationApi.middleware,
      projectApi.middleware,
      taskApi.middleware,
      adminApi.middleware,
      platformAdminApi.middleware,
      notificationApi.middleware,
      platformApi.middleware,
    ),
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
