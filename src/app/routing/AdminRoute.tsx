import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, Outlet, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useGetMeQuery } from '../../entities/user/model/userSlice'
import { isPlatformAdmin } from '../../shared/types/platform-role'
import { routes } from '../../shared/lib/routes'

export function AdminRoute() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data: user, isLoading, isError } = useGetMeQuery()

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
