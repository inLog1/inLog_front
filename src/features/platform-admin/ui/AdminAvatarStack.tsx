import type { ReactNode } from 'react'
import type { AdminUserBrief } from '../../../entities/platform-admin/model/types'
import { cn } from '../../../shared/lib/utils'
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
  getPersonLetter,
  personColorClassUnique,
} from '../lib/task-users'

interface AdminAvatarStackProps {
  users: AdminUserBrief[]
  max?: number
  showCount?: boolean
  trailing?: ReactNode
  className?: string
}

export function AdminAvatarStack({ users, max = 5, showCount = true, trailing, className }: AdminAvatarStackProps) {
  if (users.length === 0 && !trailing) {
    return <span className="text-muted-foreground">—</span>
  }

  const visible = users.slice(0, max)
  const extra = users.length - visible.length
  const usedColors = new Set<number>()

  return (
    <TooltipProvider delayDuration={200}>
      <div className={cn('flex w-full items-center', className)}>
        <div className="flex -space-x-2">
          {visible.map((user) => {
            const displayName = getAdminUserDisplayName(user)
            const avatarUrl = getAdminUserAvatarUrl(user)
            const letter = getPersonLetter(displayName, user.email)
            const color = personColorClassUnique(user.email || displayName || String(user.id), usedColors)

            return (
              <Tooltip key={user.id}>
                <TooltipTrigger asChild>
                  <Avatar className="h-7 w-7 border-2 border-background">
                    {avatarUrl ? <AvatarImage src={avatarUrl} alt={displayName} /> : null}
                    <AvatarFallback className={`text-xs font-medium ${color}`}>
                      {letter}
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
        {showCount && users.length > 0 && (
          <span className="ml-2 text-xs text-muted-foreground">{users.length}</span>
        )}
        {trailing ? <div className="ml-auto flex shrink-0 pl-3">{trailing}</div> : null}
      </div>
    </TooltipProvider>
  )
}
