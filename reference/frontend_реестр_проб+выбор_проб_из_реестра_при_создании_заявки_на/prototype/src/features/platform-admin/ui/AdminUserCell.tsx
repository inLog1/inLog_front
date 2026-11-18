import type { AdminUserBrief } from '../../../entities/platform-admin/model/types'
import { Avatar, AvatarFallback, AvatarImage } from '../../../shared/ui/avatar'
import {
  getAdminUserAvatarUrl,
  getAdminUserDisplayName,
  getAdminUserInitials,
} from '../lib/task-users'

interface AdminUserCellProps {
  user?: AdminUserBrief | null
  compact?: boolean
}

export function AdminUserCell({ user, compact = false }: AdminUserCellProps) {
  const displayName = getAdminUserDisplayName(user)

  if (!displayName) {
    return <span className="text-muted-foreground">—</span>
  }

  return (
    <div className="flex min-w-0 items-center gap-2">
      <Avatar className={compact ? 'h-6 w-6 border border-border' : 'h-7 w-7 border border-border'}>
        <AvatarImage src={getAdminUserAvatarUrl(user)} alt={displayName} />
        <AvatarFallback className="bg-primary/10 text-[10px] font-medium">
          {getAdminUserInitials(user)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className={compact ? 'truncate text-xs font-medium' : 'truncate text-sm font-medium'}>
          {displayName}
        </p>
        {user?.email && displayName !== user.email && (
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        )}
      </div>
    </div>
  )
}
