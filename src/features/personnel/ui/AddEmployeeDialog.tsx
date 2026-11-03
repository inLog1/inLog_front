import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  useGetPersonnelConfigQuery,
  useInitializePersonnelWorkspaceMutation,
} from '../../../entities/personnel'
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
import { Button } from '../../../shared/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../shared/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../shared/ui/select'
import { DirectoryCreatePanel } from './DirectoryValueField'
import { EmployeeForm, type DirectoryCreateRequest } from './EmployeeForm'

export interface EmployeeOrganizationTarget {
  id: number
  name: string
}

/** One-step create: organization and every employee field live in the same dialog. */
export function AddEmployeeDialog({
  open,
  targets,
  preferredOrganizationId,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  targets: EmployeeOrganizationTarget[]
  preferredOrganizationId?: number | null
  onOpenChange: (open: boolean) => void
  onCreated: (savedId: string) => void
}) {
  const { t } = useTranslation()
  const preferred = targets.some((item) => item.id === preferredOrganizationId) ? preferredOrganizationId : targets[0]?.id
  const [organizationId, setOrganizationId] = useState<number | null>(preferred ?? null)
  const [pendingOrganizationId, setPendingOrganizationId] = useState<number | null>(null)
  const [confirmClose, setConfirmClose] = useState(false)
  const [draft, setDraft] = useState<DirectoryCreateRequest | null>(null)
  useEffect(() => {
    if (!open) {
      setDraft(null)
      return
    }
    setOrganizationId((current) => (
      current != null && targets.some((item) => item.id === current) ? current : (preferred ?? null)
    ))
  }, [open, preferred, targets])
  const selected = targets.find((item) => item.id === organizationId) ?? targets[0] ?? null
  const activeId = selected?.id ?? 0
  const config = useGetPersonnelConfigQuery({ organizationId: activeId }, { skip: !open || activeId === 0 })
  const [initialize, initializeState] = useInitializePersonnelWorkspaceMutation()

  function requestClose() {
    if (hasUnsavedWork()) {
      setConfirmClose(true)
      return
    }
    onOpenChange(false)
  }

  function chooseOrganization(next: number) {
    if (next === activeId) return
    if (hasUnsavedWork()) {
      setPendingOrganizationId(next)
      return
    }
    setOrganizationId(next)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => { if (!next) requestClose(); else onOpenChange(true) }}>
        <DialogContent className="flex max-h-[min(88vh,820px)] w-[calc(100%-2rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0">
          <div className={draft ? 'hidden' : 'contents'}>
          <DialogHeader className="shrink-0 space-y-1 border-b border-border px-6 py-4 pr-12 text-left">
            <DialogTitle>{t('corporation.add-employee')}</DialogTitle>
            <DialogDescription>
              {targets.length === 1 && selected
                ? t('corporation.add-in-organization', { name: selected.name })
                : t('corporation.pick-organization-note')}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            {targets.length > 1 ? (
              <label className="mb-4 grid max-w-sm gap-1 text-sm">
                {t('corporation.pick-organization')}
                <Select value={selected ? String(selected.id) : undefined} onValueChange={(value) => chooseOrganization(Number(value))}>
                  <SelectTrigger aria-label={t('corporation.pick-organization')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {targets.map((item) => (
                      <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
            ) : null}
            {selected && config.data?.initialized ? (
              <EmployeeForm
                key={selected.id}
                organizationId={selected.id}
                organizationName={selected.name}
                employeeId={null}
                layout="columns"
                hideOrganization
                onCreateOption={setDraft}
                onClose={(savedId) => {
                  if (savedId) onCreated(savedId)
                  else requestClose()
                }}
              />
            ) : selected && config.isError ? (
              <p className="text-sm text-destructive" role="alert">{t('personnel.errors.generic')}</p>
            ) : selected && config.data && !config.data.initialized ? (
              <div className="grid max-w-lg gap-3">
                <p className="text-sm text-muted-foreground">{t('personnel.missing')}</p>
                {config.data.canInitialize ? (
                  <Button
                    className="w-fit"
                    disabled={initializeState.isLoading}
                    onClick={() => void initialize({ organizationId: selected.id })}
                  >
                    {t('directories.prepare')}
                  </Button>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t('personnel.loading')}</p>
            )}
          </div>
          </div>
          {draft && selected ? (
            <DirectoryCreatePanel
              organizationId={selected.id}
              organizationName={selected.name}
              option={draft.option}
              departments={draft.departments}
              onBack={() => setDraft(null)}
              onCreated={(id) => {
                draft.apply(id)
                setDraft(null)
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
      <AlertDialog open={confirmClose || pendingOrganizationId != null} onOpenChange={(next) => { if (!next) { setConfirmClose(false); setPendingOrganizationId(null) } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t(pendingOrganizationId != null ? 'corporation.switch-title' : 'forms.leave-title')}</AlertDialogTitle>
            <AlertDialogDescription>{t(pendingOrganizationId != null ? 'corporation.switch-body' : 'corporation.leave-body')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('corporation.switch-stay')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (pendingOrganizationId != null) {
                setOrganizationId(pendingOrganizationId)
                setPendingOrganizationId(null)
                return
              }
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
