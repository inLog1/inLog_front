import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  personnelError,
  useGetPersonnelConfigQuery,
  useInitializePersonnelWorkspaceMutation,
  type CorporateCreateTarget,
} from '../../../../entities/personnel'
import { EmployeeForm } from '../../../../features/personnel'
import { hasUnsavedWork } from '../../../../shared/session/unsaved-work'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../../shared/ui/alert-dialog'
import { Button } from '../../../../shared/ui/button'
import { Label } from '../../../../shared/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../shared/ui/select'

export function PersonnelComposer({
  organizationId,
  employeeId,
  organizationName,
  createTargets,
  onOrganizationChange,
  onClose,
  closeLabel,
}: {
  organizationId: number
  employeeId: string | null
  organizationName: string
  createTargets: CorporateCreateTarget[]
  onOrganizationChange: (organizationId: number) => void
  onClose: (savedId?: string) => void
  closeLabel?: string
}) {
  const { t } = useTranslation()
  const creating = employeeId == null
  const config = useGetPersonnelConfigQuery({ organizationId }, { skip: !creating })
  const [initialize, initializeState] = useInitializePersonnelWorkspaceMutation()
  const [pendingOrg, setPendingOrg] = useState<number | null>(null)
  const [leaving, setLeaving] = useState(false)
  const [initError, setInitError] = useState('')

  const requestOrganization = (next: number) => {
    if (next === organizationId) return
    if (hasUnsavedWork()) setPendingOrg(next)
    else onOrganizationChange(next)
  }

  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold">{creating ? t('corporation.add-employee') : t('corporation.edit')}</h2>
        <Button type="button" variant="outline" onClick={() => { if (hasUnsavedWork()) setLeaving(true); else onClose() }}>
          {closeLabel ?? t('corporation.back')}
        </Button>
      </div>
      {creating && createTargets.length > 1 ? (
        <div className="grid max-w-md gap-1.5">
          <Label htmlFor="personnel-organization">{t('corporation.pick-organization')}</Label>
          <Select value={String(organizationId)} onValueChange={(value) => requestOrganization(Number(value))}>
            <SelectTrigger id="personnel-organization">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {createTargets.map((target) => (
                <SelectItem key={target.id} value={String(target.id)}>{target.fullName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">{t('corporation.pick-organization-note')}</p>
        </div>
      ) : null}
      {creating && config.isLoading ? <p className="text-sm text-muted-foreground">{t('personnel.loading')}</p> : null}
      {creating && config.isError ? (
        <p className="text-sm text-destructive" role="alert">
          {t(`personnel.errors.${personnelError(config.error).code}`, { defaultValue: t('personnel.errors.generic') })}
        </p>
      ) : null}
      {creating && config.data && !config.data.initialized ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{t('personnel.missing')}</p>
          {config.data.canInitialize ? (
            <Button
              type="button"
              disabled={initializeState.isLoading}
              onClick={() => {
                setInitError('')
                void initialize({ organizationId }).unwrap().catch((caught) => {
                  setInitError(t(`personnel.errors.${personnelError(caught).code}`, { defaultValue: t('personnel.errors.generic') }))
                })
              }}
            >
              {t('directories.prepare')}
            </Button>
          ) : null}
          {initError ? <p className="text-sm text-destructive" role="alert">{initError}</p> : null}
        </div>
      ) : null}
      {!creating || config.data?.initialized ? (
        <EmployeeForm
          key={`${organizationId}:${employeeId ?? 'new'}`}
          organizationId={organizationId}
          organizationName={organizationName}
          employeeId={employeeId}
          onClose={onClose}
        />
      ) : null}
      <AlertDialog open={pendingOrg != null} onOpenChange={(open) => { if (!open) setPendingOrg(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('corporation.switch-title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('corporation.switch-body')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">{t('corporation.switch-stay')}</AlertDialogCancel>
            <Button type="button" variant="destructive" onClick={() => {
              if (pendingOrg == null) return
              const next = pendingOrg
              setPendingOrg(null)
              onOrganizationChange(next)
            }}
            >
              {t('corporation.switch-discard')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={leaving} onOpenChange={setLeaving}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('forms.leave-title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('corporation.leave-body')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">{t('corporation.switch-stay')}</AlertDialogCancel>
            <Button type="button" variant="destructive" onClick={() => { setLeaving(false); onClose() }}>
              {t('corporation.switch-discard')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
