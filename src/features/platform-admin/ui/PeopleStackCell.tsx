import { Settings2 } from 'lucide-react'
import type { AdminUserBrief } from '../../../entities/platform-admin/model/types'
import { Button } from '../../../shared/ui/button'
import { AdminAvatarStack } from './AdminAvatarStack'

interface PeopleStackCellProps {
    users: AdminUserBrief[]
    label: string
    onOpen: () => void
}

export function PeopleStackCell({ users, label, onOpen }: PeopleStackCellProps) {
    return (
        <div className="w-[10.5rem]">
            <AdminAvatarStack
                users={users}
                max={5}
                showCount={false}
                trailing={
                    <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="relative z-10 h-7 w-7 rounded-full border-2 border-background bg-muted"
                        aria-label={label}
                        onClick={onOpen}
                    >
                        <Settings2 className="h-3.5 w-3.5" />
                    </Button>
                }
            />
        </div>
    )
}
