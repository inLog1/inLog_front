import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, FileSpreadsheet, PenLine } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { WorkspaceStatus } from '../../../../features/org-project-selector'
import { useWorkspaceSection } from '../../../../features/org-project-selector/model/useWorkspaceSection'
import { routes } from '../../../../shared/lib/routes'
import { useUnsavedSource } from '../../../../shared/session/unsaved-work'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../../shared/ui/alert-dialog'
import { Button } from '../../../../shared/ui/button'
import { Card } from '../../../../shared/ui/card'
import { PageHeader, WorkPage } from '../../../../shared/ui/page'
import { useLeaveGuard } from '../../forms/model/use-leave-guard'
import { SamplesBoundary } from './SamplesBoundary'
import { RegistrationForm } from './RegistrationForm'

export function SampleRegisterPage() {
  return (
    <SamplesBoundary>
      <RegisterGate />
    </SamplesBoundary>
  )
}

function RegisterGate() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [search, setSearch] = useSearchParams()
  const section = useWorkspaceSection('organization', { resource: 'requests', action: 'create' })
  const readyOrg = section.kind === 'ready' ? section.organizationId : null
  const [lockedOrg, setLockedOrg] = useState<number | null>(null)
  const [dirty, setDirty] = useState(false)
  const [step, setStep] = useState<'choose' | 'manual'>(() => search.get('parent') ? 'manual' : 'choose')
  const [localLeave, setLocalLeave] = useState<'choose' | 'list' | null>(null)
  const ignoreDirty = useRef(false)
  if (readyOrg != null && lockedOrg == null) setLockedOrg(readyOrg)
  const urlOrg = Number(search.get('org'))
  const switched = lockedOrg != null && Number.isInteger(urlOrg) && urlOrg > 0 && urlOrg !== lockedOrg
  if (switched && !dirty) setLockedOrg(urlOrg)
  const leave = useLeaveGuard(dirty && step === 'manual')
  const reportDirty = useCallback((value: boolean) => {
    if (ignoreDirty.current) return
    setDirty(value)
  }, [])
  useUnsavedSource('sample-registration', dirty && step === 'manual')
  useEffect(() => {
    ignoreDirty.current = false
  }, [lockedOrg, step])

  if (lockedOrg == null || (!switched && section.kind !== 'ready')) {
    return (
      <WorkspaceStatus
        status={section.kind === 'ready' ? 'loading' : section.status}
        reason={section.kind === 'ready' ? null : section.reason}
        onRetry={section.kind === 'ready' ? undefined : section.refetch}
      />
    )
  }

  const listHref = `${routes.samples.list()}?org=${lockedOrg}`
  const parentId = search.get('parent') ?? ''

  function restoreOrg() {
    setSearch((prev) => {
      const next = new URLSearchParams(prev)
      next.set('org', String(lockedOrg))
      next.delete('project')
      return next
    }, { replace: true })
  }

  function discardOrg() {
    ignoreDirty.current = true
    setDirty(false)
    setLockedOrg(urlOrg)
  }

  function discardLeave() {
    ignoreDirty.current = true
    setDirty(false)
    const url = leave.nextUrl
    const local = localLeave
    leave.dismiss()
    setLocalLeave(null)
    if (url) navigate(url)
    else if (local === 'choose') setStep('choose')
    else if (local === 'list') navigate(listHref)
  }

  function ask(action: 'choose' | 'list') {
    if (!dirty || step !== 'manual') {
      if (action === 'choose') setStep('choose')
      else navigate(listHref)
      return
    }
    setLocalLeave(action)
  }

  return (
    <WorkPage>
      <div>
        <Button type="button" variant="ghost" onClick={() => ask('list')}>
          <ChevronLeft aria-hidden />
          {t('samples.back')}
        </Button>
      </div>
      <PageHeader
        breadcrumbs={[{ label: t('samples.page-title'), to: listHref }, { label: t('samples.registration.title') }]}
        title={t('samples.registration.title')}
        description={step === 'choose' ? t('samples.registration.lead') : undefined}
      />
      {step === 'choose' ? <MethodChoice onManual={() => setStep('manual')} /> : (
        <RegistrationForm
          key={lockedOrg}
          organizationId={lockedOrg}
          initialParentId={parentId}
          suspended={switched && dirty}
          onDirty={reportDirty}
          onBack={() => ask('choose')}
          onCancel={() => ask('list')}
          onOpen={(sampleId) => {
            ignoreDirty.current = true
            setDirty(false)
            navigate(`${routes.samples.detail(sampleId)}?org=${lockedOrg}`)
          }}
        />
      )}
      <AlertDialog open={leave.nextUrl != null || localLeave != null}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('samples.registration.leave-title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('samples.registration.leave-body')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button type="button" variant="outline" onClick={() => { leave.dismiss(); setLocalLeave(null) }}>{t('samples.registration.leave-stay')}</Button>
            <Button type="button" variant="outline" onClick={discardLeave}>{t('samples.registration.leave-discard')}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={switched && dirty && leave.nextUrl == null && localLeave == null}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('samples.registration.org-title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('samples.registration.org-body')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button type="button" variant="outline" onClick={restoreOrg}>{t('samples.registration.leave-stay')}</Button>
            <Button type="button" variant="outline" onClick={discardOrg}>{t('samples.registration.leave-discard')}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </WorkPage>
  )
}

function MethodChoice({ onManual }: { onManual: () => void }) {
  const { t } = useTranslation()
  return (
    <Card className="grid gap-3 p-6 shadow-sm sm:grid-cols-2">
      <Button type="button" variant="outline" className="h-auto justify-start gap-3 whitespace-normal p-5 text-left" onClick={onManual}>
        <PenLine aria-hidden />
        <span>
          <span className="block font-semibold">{t('samples.registration.manual.title')}</span>
          <span className="mt-1 block text-xs font-normal text-muted-foreground">{t('samples.registration.manual.lead')}</span>
        </span>
      </Button>
      <Button
        type="button"
        variant="outline"
        disabled
        aria-describedby="sample-import-later"
        className="h-auto justify-start gap-3 whitespace-normal p-5 text-left"
      >
        <FileSpreadsheet aria-hidden />
        <span>
          <span className="block font-semibold">{t('samples.registration.import.title')}</span>
          <span id="sample-import-later" className="mt-1 block text-xs font-normal text-muted-foreground">{t('samples.registration.import.later')}</span>
        </span>
      </Button>
    </Card>
  )
}
