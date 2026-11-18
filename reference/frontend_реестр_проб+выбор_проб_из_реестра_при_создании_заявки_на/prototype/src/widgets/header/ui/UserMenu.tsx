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
import { requestLogout } from '../../../shared/api/session-events'
import { routes } from '../../../shared/lib/routes'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { selectUser } from '../../../entities/user/model/selectors'
import { useWorkspaceHref } from '../../../features/org-project-selector/model/useEnsureOrgProjectParams'
import { Avatar, AvatarFallback, AvatarImage } from '../../../shared/ui/avatar'

export function UserMenu() {
  const { t } = useTranslation()
  const user = useSelector(selectUser)
  const href = useWorkspaceHref()

  const handleLogout = async () => {
    await requestLogout({ reason: 'user', callApi: true })
    toast.success(t('notice-list.log-out-success'))
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={t('header.user-menu')}>
        {/* <Avatar className="h-10 w-10 cursor-pointer">
          <AvatarImage src={user?.avatar?.medium} alt={user?.fullName} />
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar> */}
        <Avatar className="h-8 w-8 cursor-pointer border border-border">
          <AvatarImage
            src={user?.avatar?.medium}
            alt={`${user?.surname} ${user?.name}`}
          />
          <AvatarFallback className="bg-primary/10">
            <UserIcon className="h-4 w-4 text-primary" />
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>

      <DropdownMenuContent side="bottom" align="end" className="w-56">
        <DropdownMenuLabel>
          {user?.full_name || user?.email || t('header.user-menu')}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to={href(routes.settings.profile(), 'app')} className="flex items-center gap-2">
            <User className="h-4 w-4" />
            {t('header.profile')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to={href(routes.settings.notifications(), 'app')} className="flex items-center gap-2">
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