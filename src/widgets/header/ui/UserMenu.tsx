import { useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import { LogOut, Settings, User, UserIcon } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../../shared/ui/dropdown-menu'
import { useLogoutMutation } from '../../../features/auth/model/authSlice'
import { beginLogout, clearAuthSession } from '../../../shared/api/auth-session'
import { routes } from '../../../shared/lib/routes'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { selectUser } from '../../../entities/user/model/selectors'
import { Avatar, AvatarFallback, AvatarImage } from '../../../shared/ui/avatar'

export function UserMenu() {
  const { t } = useTranslation()
  const user = useSelector(selectUser)
  const [logout] = useLogoutMutation()

  const handleLogout = async () => {
    beginLogout()
    try {
      await logout().unwrap()
      toast.success(t('notice-list.log-out-success'))
    } catch {
      toast.error(t('errors.error-logout'))
    } finally {
      clearAuthSession()
      localStorage.clear()
      window.location.href = routes.login()
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="outline-none">
        {/* <Avatar className="h-10 w-10 cursor-pointer">
          <AvatarImage src={user?.avatar?.medium} alt={user?.fullName} />
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar> */}
        <Avatar className="h-8 w-8 cursor-pointer border-2 border-white/30">
          <AvatarImage
            src={user?.avatar?.medium}
            alt={`${user?.surname} ${user?.name}`}
          />
          <AvatarFallback className="bg-primary/10">
            <UserIcon className="h-4 w-4 text-primary" />
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>

      <DropdownMenuContent side="top" align="start" className="w-56">
        <DropdownMenuLabel>
          {user?.full_name || user?.email || t('header.user-menu')}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to={routes.settings.profile()} className="flex items-center gap-2">
            <User className="h-4 w-4" />
            {t('header.profile')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to={routes.settings.notifications()} className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            {t('header.settings')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleLogout}
          className="text-destructive focus:text-destructive flex items-center gap-2"
        >
          <LogOut className="h-4 w-4" />
          {t('header.logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}