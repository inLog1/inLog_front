import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../shared/ui/alert-dialog'
import { Button } from '../../../shared/ui/button'

type RoleDeleteDialogProps = {
  open: boolean
  name: string
  pending: boolean
  blocked: boolean
  usersHref: string
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

export function RoleDeleteDialog({ open, name, pending, blocked, usersHref, onOpenChange, onConfirm }: RoleDeleteDialogProps) {
  const { t } = useTranslation()
  return (
    <AlertDialog open={open} onOpenChange={(next) => { if (!pending) onOpenChange(next) }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {blocked ? t('access.delete-in-use-title', { name }) : t('access.delete-confirm-title', { name })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {blocked ? t('access.delete-in-use-body') : t('access.delete-confirm-body')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{t('access.cancel')}</AlertDialogCancel>
          {blocked ? (
            <Button asChild>
              <Link to={usersHref}>{t('access.open-users')}</Link>
            </Button>
          ) : (
            <Button type="button" variant="destructive" disabled={pending} onClick={onConfirm}>
              {t('access.delete-role')}
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
