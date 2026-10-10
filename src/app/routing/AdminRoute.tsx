import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import { Navigate, Outlet, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  useGetAdminAccessQuery,
  useGetAdminResourcesQuery,
} from '../../entities/platform-admin/model/platformAdminSlice'
import { selectUser } from '../../entities/user/model/selectors'
import { useGetMeQuery } from '../../entities/user/model/userSlice'
import { firstAccessiblePlatformPath } from '../../shared/lib/available-features'
import { isPlatformAdmin } from '../../shared/types/platform-role'
import { routes } from '../../shared/lib/routes'

export function AdminRoute() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data: user, isLoading, isError } = useGetMeQuery()
  const canEnterAdmin = !isLoading && !isError && !!user && isPlatformAdmin(user.role)

  useGetAdminAccessQuery(undefined, { skip: !canEnterAdmin })
  useGetAdminResourcesQuery(undefined, { skip: !canEnterAdmin })

  useEffect(() => {
    if (!isLoading && !isError && user && !isPlatformAdmin(user.role)) {
      toast.error(t('admin-page.access-denied'))
      navigate(routes.dashboard())
    }
  }, [isLoading, isError, user, navigate, t])

  if (isLoading) {
    return null
  }

  if (isError || !user || !isPlatformAdmin(user.role)) {
    return <Navigate to={routes.dashboard()} replace />
  }

  return <Outlet />
}

export function AdminIndexRedirect() {
  const user = useSelector(selectUser)
  return <Navigate to={firstAccessiblePlatformPath(user)} replace />
}
