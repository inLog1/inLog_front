import type { AdminUserBrief } from '../../../entities/platform-admin/model/types'
import { Avatar, AvatarFallback, AvatarImage } from '../../../shared/ui/avatar'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../../shared/ui/tooltip'
import {
  getAdminUserAvatarUrl,
  getAdminUserDisplayName,
  getAdminUserInitials,
} from '../lib/task-users'

interface AdminAvatarStackProps {
  users: AdminUserBrief[]
  max?: number
}

export function AdminAvatarStack({ users, max = 4 }: AdminAvatarStackProps) {
  if (users.length === 0) {
    return <span className="text-muted-foreground">—</span>
  }

  const visible = users.slice(0, max)
  const extra = users.length - visible.length

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center">
        <div className="flex -space-x-2">
          {visible.map((user) => {
            const displayName = getAdminUserDisplayName(user)

            return (
              <Tooltip key={user.id}>
                <TooltipTrigger asChild>
                  <Avatar className="h-7 w-7 border-2 border-background">
                    <AvatarImage src={getAdminUserAvatarUrl(user)} alt={displayName} />
                    <AvatarFallback className="bg-primary/10 text-[10px] font-medium">
                      {getAdminUserInitials(user)}
                    </AvatarFallback>
                  </Avatar>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>{displayName}</p>
                  {user.email && displayName !== user.email && (
                    <p className="text-primary-foreground/80">{user.email}</p>
                  )}
                </TooltipContent>
              </Tooltip>
            )
          })}
          {extra > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-muted text-[10px] font-medium text-muted-foreground">
                  +{extra}
                </div>
              </TooltipTrigger>
              <TooltipContent side="top">
                {users.slice(max).map((user) => (
                  <p key={user.id}>{getAdminUserDisplayName(user)}</p>
                ))}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        <span className="ml-2 text-xs text-muted-foreground">{users.length}</span>
      </div>
    </TooltipProvider>
  )
}
