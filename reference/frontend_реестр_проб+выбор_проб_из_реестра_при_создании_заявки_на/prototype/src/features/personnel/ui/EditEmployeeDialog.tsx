import { useEffect, useRef, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { hasUnsavedWork } from '../../../shared/session/unsaved-work'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../shared/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../shared/ui/dialog'
import { DirectoryCreatePanel } from './DirectoryValueField'
import { EmployeeForm, type DirectoryCreateRequest, type PendingDirectoryPick } from './EmployeeForm'

export function EditEmployeeDialog({
  open,
  organizationId,
  organizationName,
  employeeId,
  onOpenChange,
  onSaved,
}: {
  open: boolean
  organizationId: number
  organizationName: string
  employeeId: string
  onOpenChange: (open: boolean) => void
  onSaved: (savedId: string) => void
}) {
  const { t } = useTranslation()
  const [confirmClose, setConfirmClose] = useState(false)
  const [draft, setDraft] = useState<DirectoryCreateRequest | null>(null)
  const draftRef = useRef<DirectoryCreateRequest | null>(null)
  const [pendingDirectoryPick, setPendingDirectoryPick] = useState<PendingDirectoryPick | null>(null)
  const clearPendingDirectoryPick = useCallback(() => setPendingDirectoryPick(null), [])

  useEffect(() => {
    draftRef.current = draft
  }, [draft])

  useEffect(() => {
    if (!open) {
      setDraft(null)
      setPendingDirectoryPick(null)
    }
  }, [open])

  function requestClose() {
    if (hasUnsavedWork()) {
      setConfirmClose(true)
      return
    }
    onOpenChange(false)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => { if (!next) requestClose(); else onOpenChange(true) }}>
        <DialogContent className="flex h-[min(90vh,920px)] w-[min(1040px,calc(100%-1.5rem))] max-w-[1040px] flex-col gap-0 overflow-hidden p-0">
          <div className={draft ? 'hidden' : 'flex min-h-0 flex-1 flex-col'}>
            <DialogHeader className="shrink-0 space-y-1 border-b border-border px-6 py-4 pr-12 text-left">
              <DialogTitle>{t('personnel.dialog-edit')}</DialogTitle>
              <DialogDescription className="sr-only">
                {t('corporation.edit-in-organization', { name: organizationName })}
              </DialogDescription>
            </DialogHeader>
            <div className="flex min-h-0 flex-1 flex-col">
              <EmployeeForm
                key={`${organizationId}:${employeeId}`}
                organizationId={organizationId}
                organizationName={organizationName}
                employeeId={employeeId}
                layout="columns"
                hideOrganization
                onCreateOption={setDraft}
                pendingDirectoryPick={pendingDirectoryPick}
                onPendingDirectoryPickApplied={clearPendingDirectoryPick}
                onClose={(savedId) => {
                  if (savedId) {
                    onSaved(savedId)
                    onOpenChange(false)
                  } else requestClose()
                }}
              />
            </div>
          </div>
          {draft ? (
            <DirectoryCreatePanel
              organizationId={organizationId}
              organizationName={organizationName}
              option={draft.option}
              departments={draft.departments}
              onBack={() => setDraft(null)}
              onCreated={(record) => {
                const pending = draftRef.current
                if (pending) {
                  setPendingDirectoryPick({ fieldId: pending.fieldId, record })
                }
                setDraft(null)
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
      <AlertDialog open={confirmClose} onOpenChange={(next) => { if (!next) setConfirmClose(false) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('forms.leave-title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('corporation.leave-body')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('corporation.switch-stay')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setConfirmClose(false)
              onOpenChange(false)
            }}
            >
              {t('corporation.switch-discard')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
