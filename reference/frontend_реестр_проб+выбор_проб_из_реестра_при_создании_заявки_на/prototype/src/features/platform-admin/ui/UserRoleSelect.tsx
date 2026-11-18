import { useTranslation } from 'react-i18next'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../shared/ui/select'
import {
  ASSIGNABLE_PLATFORM_ROLES,
  isSuperAdmin,
  type PlatformRole,
} from '../../../shared/types/platform-role'
import { PlatformRoleBadge } from './PlatformRoleBadge'

interface UserRoleSelectProps {
  role: string
  canManage: boolean
  disabled?: boolean
  onChange: (role: PlatformRole) => void
}

export function UserRoleSelect({ role, canManage, disabled, onChange }: UserRoleSelectProps) {
  const { t } = useTranslation()
  const isSuperAdminRole = role === 'super_admin'

  if (!canManage || isSuperAdminRole) {
    return <PlatformRoleBadge role={role} showSuperAdminHint={isSuperAdminRole} />
  }

  return (
    <Select
      value={role}
      disabled={disabled}
      onValueChange={(value) => onChange(value as PlatformRole)}
    >
      <SelectTrigger className="w-[160px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ASSIGNABLE_PLATFORM_ROLES.map((assignableRole) => (
          <SelectItem key={assignableRole} value={assignableRole}>
            {t(`admin-page.platform-roles.${assignableRole}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function canManageUserRoles(currentUserRole?: string | null) {
  return isSuperAdmin(currentUserRole)
}
