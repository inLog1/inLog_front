import { AlertTriangle, Loader2, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
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
import { cn } from '../../../shared/lib/utils'

export type AdminDeleteEntityType =
  | 'user'
  | 'organization'
  | 'project'
  | 'task'
  | 'task-status'
  | 'task-tag'

interface AdminDeleteConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  entityType: AdminDeleteEntityType
  entityName: string
  isDeleting?: boolean
  onConfirm: () => void | Promise<void>
}

const titleKeyByType: Record<AdminDeleteEntityType, string> = {
  user: 'admin-page.delete-dialog.title-user',
  organization: 'admin-page.delete-dialog.title-organization',
  project: 'admin-page.delete-dialog.title-project',
  task: 'admin-page.delete-dialog.title-task',
  'task-status': 'admin-page.delete-dialog.title-task-status',
  'task-tag': 'admin-page.delete-dialog.title-task-tag',
}

const warningKeyByType: Partial<Record<AdminDeleteEntityType, string>> = {
  user: 'admin-page.delete-dialog.warning-user',
  organization: 'admin-page.delete-dialog.warning-organization',
  project: 'admin-page.delete-dialog.warning-project',
  task: 'admin-page.delete-dialog.warning-task',
  'task-status': 'admin-page.delete-dialog.warning-task-status',
  'task-tag': 'admin-page.delete-dialog.warning-task-tag',
}

export function AdminDeleteConfirmDialog({
  open,
  onOpenChange,
  entityType,
  entityName,
  isDeleting = false,
  onConfirm,
}: AdminDeleteConfirmDialogProps) {
  const { t } = useTranslation()
  const warningKey = warningKeyByType[entityType]

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
        <div className="border-b border-border bg-muted/30 px-6 py-5">
          <AlertDialogHeader className="space-y-4 text-left">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <Trash2 className="h-5 w-5" />
              </div>
              <div className="min-w-0 space-y-1">
                <AlertDialogTitle className="text-lg">
                  {t(titleKeyByType[entityType])}
                </AlertDialogTitle>
                <AlertDialogDescription className="text-sm leading-relaxed">
                  {t('admin-page.delete-dialog.description', { name: entityName })}
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="rounded-lg border border-border bg-background px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t('admin-page.delete-dialog.entity-label')}
            </p>
            <p className="mt-1 break-words text-sm font-semibold text-foreground">{entityName}</p>
          </div>

          {warningKey && (
            <div className="flex gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <p className="text-sm leading-relaxed text-muted-foreground">{t(warningKey)}</p>
            </div>
          )}
        </div>

        <AlertDialogFooter className="border-t border-border bg-muted/20 px-6 py-4 sm:space-x-2">
          <AlertDialogCancel disabled={isDeleting} className="mt-0">
            {t('buttons.cancel')}
          </AlertDialogCancel>
          <Button
            type="button"
            variant="destructive"
            disabled={isDeleting}
            className={cn(isDeleting && 'pointer-events-none')}
            onClick={() => void onConfirm()}
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('buttons.deleting')}
              </>
            ) : (
              t('buttons.delete')
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
